import type { Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import { canSkipMeal, sumCreditLedger } from '../credits';
import { pauseSubscriptionDateLocal } from './subscriptions';
import { readJsonMap, writeJsonMap } from '../offlineStore';

export type CreditLedgerEntry = {
  id: Uuid;
  amount: number;
  reason: string;
  order_id?: Uuid | null;
  created_at?: string;
};

type CreditRow = CreditLedgerEntry;

const CREDITS_KEY = 'gharkaswad_offline_credits_v1';
let memoryCredits: Map<string, CreditRow[]> | null = null;

async function offlineCredits(): Promise<Map<string, CreditRow[]>> {
  if (!memoryCredits) {
    memoryCredits = await readJsonMap<CreditRow[]>(CREDITS_KEY);
  }
  return memoryCredits;
}

async function persistOfflineCredits(map: Map<string, CreditRow[]>): Promise<void> {
  memoryCredits = map;
  await writeJsonMap(CREDITS_KEY, map);
}

/** Grant wallet credits (e.g. kitchen declined a paid order). */
export async function grantCredit(params: {
  customerId: Uuid;
  amount: number;
  reason: string;
  orderId?: Uuid | null;
}): Promise<Result<{ creditId: Uuid }>> {
  const amount = Math.round(params.amount * 100) / 100;
  if (!(amount > 0)) {
    return err('VALIDATION', 'Credit amount must be positive');
  }

  if (!isSupabaseConfigured) {
    const creditId = crypto.randomUUID();
    const map = await offlineCredits();
    const rows = map.get(params.customerId) ?? [];
    rows.push({
      id: creditId,
      amount,
      reason: params.reason,
      order_id: params.orderId ?? null,
      created_at: new Date().toISOString(),
    });
    map.set(params.customerId, rows);
    await persistOfflineCredits(map);
    return ok({ creditId });
  }

  const { data, error } = await supabase.rpc('grant_credit', {
    payload: {
      customer_id: params.customerId,
      amount,
      reason: params.reason,
      order_id: params.orderId ?? null,
    },
  });

  if (error || !data) {
    // Fallback insert if RPC not migrated yet.
    const inserted = await supabase
      .from('credits')
      .insert({
        customer_id: params.customerId,
        amount,
        reason: params.reason,
        order_id: params.orderId ?? null,
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      logger.error('grantCredit failed', error ?? inserted.error);
      return err(
        'UNKNOWN',
        error?.message ?? inserted.error?.message ?? 'Could not grant credit',
        error ?? inserted.error,
      );
    }
    return ok({ creditId: inserted.data.id as Uuid });
  }

  return ok({ creditId: (data as { id: string }).id as Uuid });
}

export async function listCredits(customerId: Uuid): Promise<Result<CreditLedgerEntry[]>> {
  if (!customerId) return ok([]);

  if (!isSupabaseConfigured) {
    const map = await offlineCredits();
    const rows = [...(map.get(customerId) ?? [])].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
    return ok(rows);
  }

  const { data, error } = await supabase
    .from('credits')
    .select('id, amount, reason, order_id, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listCredits failed', error);
    return err('UNKNOWN', error.message, error);
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id as Uuid,
      amount: Number(row.amount) || 0,
      reason: String(row.reason ?? ''),
      order_id: (row.order_id as Uuid | null) ?? null,
      created_at: String(row.created_at ?? ''),
    })),
  );
}

export async function getCreditBalance(customerId: Uuid): Promise<Result<number>> {
  if (!isSupabaseConfigured) {
    const map = await offlineCredits();
    const rows = map.get(customerId) ?? [];
    return ok(sumCreditLedger(rows.map((r) => r.amount)));
  }

  const { data, error } = await supabase
    .from('credits')
    .select('amount')
    .eq('customer_id', customerId);

  if (error) {
    logger.error('getCreditBalance failed', error);
    return err('UNKNOWN', error.message, error);
  }

  const total = sumCreditLedger((data ?? []).map((row) => Number(row.amount)));
  return ok(total);
}

export async function applySkip(params: {
  customerId: Uuid;
  subscriptionId: Uuid;
  date: string;
  reason: string;
  mealValue: number;
  mealSlot: 'lunch' | 'dinner';
}): Promise<Result<{ creditId: Uuid }>> {
  const { customerId, subscriptionId, date, reason, mealValue, mealSlot } = params;

  const cutoff = canSkipMeal({ mealDate: date, mealSlot });
  if (!cutoff.allowed) {
    return err('VALIDATION', cutoff.message ?? 'Skip not allowed');
  }

  if (!isSupabaseConfigured) {
    const paused = await pauseSubscriptionDateLocal(subscriptionId, customerId, date);
    if (!paused.ok) return paused;
    const creditId = crypto.randomUUID();
    const map = await offlineCredits();
    const rows = map.get(customerId) ?? [];
    rows.push({ id: creditId, amount: mealValue, reason: reason || `Skip meal ${date}` });
    map.set(customerId, rows);
    await persistOfflineCredits(map);
    return ok({ creditId });
  }

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('id, customer_id, paused_dates, status')
    .eq('id', subscriptionId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (subError) {
    return err('UNKNOWN', subError.message, subError);
  }
  if (!sub) {
    return err('NOT_FOUND', 'Subscription not found');
  }
  if (sub.status === 'cancelled') {
    return err('VALIDATION', 'Cannot skip a cancelled subscription');
  }

  const paused: string[] = Array.isArray(sub.paused_dates) ? [...sub.paused_dates] : [];
  if (paused.includes(date)) {
    return err('VALIDATION', 'This meal is already paused/skipped');
  }

  paused.push(date);

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({ paused_dates: paused })
    .eq('id', subscriptionId)
    .eq('customer_id', customerId);

  if (updateError) {
    return err('UNKNOWN', updateError.message, updateError);
  }

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .insert({
      customer_id: customerId,
      amount: mealValue,
      reason: reason || `Skip meal ${date}`,
      subscription_id: subscriptionId,
    })
    .select('id')
    .single();

  if (creditError || !credit) {
    await supabase
      .from('subscriptions')
      .update({ paused_dates: paused.filter((d) => d !== date) })
      .eq('id', subscriptionId);
    return err('UNKNOWN', creditError?.message ?? 'Failed to grant skip credit', creditError);
  }

  return ok({ creditId: credit.id as Uuid });
}
