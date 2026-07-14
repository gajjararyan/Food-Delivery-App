import type { MealSlot, Subscription, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import { SEED } from '../../constants/seed';
import { readJsonMap, writeJsonMap } from '../offlineStore';

const SUBS_KEY = 'gharkaswad_offline_subs_v1';
let memorySubs: Map<string, Subscription> | null = null;

async function offlineSubs(): Promise<Map<string, Subscription>> {
  if (!memorySubs) {
    memorySubs = await readJsonMap<Subscription>(SUBS_KEY);
  }
  return memorySubs;
}

async function persistOfflineSubs(map: Map<string, Subscription>): Promise<void> {
  memorySubs = map;
  await writeJsonMap(SUBS_KEY, map);
}

export async function listSubscriptions(customerId: Uuid): Promise<Result<Subscription[]>> {
  if (!isSupabaseConfigured) {
    const map = await offlineSubs();
    return ok(
      [...map.values()]
        .filter((s) => s.customer_id === customerId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listSubscriptions failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok((data ?? []) as Subscription[]);
}

export async function getSubscription(
  subscriptionId: Uuid,
  customerId: Uuid,
): Promise<Result<Subscription>> {
  if (!isSupabaseConfigured) {
    const map = await offlineSubs();
    const hit = map.get(subscriptionId);
    if (!hit || hit.customer_id !== customerId) return err('NOT_FOUND', 'Subscription not found');
    return ok(hit);
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) return err('UNKNOWN', error.message, error);
  if (!data) return err('NOT_FOUND', 'Subscription not found');
  return ok(data as Subscription);
}

export async function createWeeklySubscription(params: {
  customerId: Uuid;
  makerId?: Uuid;
  menuItemId?: Uuid;
  mealSlot?: MealSlot;
  deliveryWindow?: Subscription['delivery_window'];
}): Promise<Result<Subscription>> {
  const now = new Date();
  const starts = now.toISOString().slice(0, 10);
  const ends = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const mealSlot = params.mealSlot ?? 'lunch';
  const deliveryWindow = params.deliveryWindow ?? (mealSlot === 'dinner' ? '19:00-19:15' : '13:00-13:15');

  const draft: Omit<Subscription, 'id' | 'created_at'> & { created_at?: string } = {
    customer_id: params.customerId,
    maker_id: params.makerId ?? SEED.makerId,
    menu_item_id: params.menuItemId ?? SEED.lunchThaliId,
    plan_days: 7,
    meal_slot: mealSlot,
    delivery_window: deliveryWindow,
    status: 'active',
    paused_dates: [],
    starts_on: starts,
    ends_on: ends,
  };

  if (!isSupabaseConfigured) {
    const local: Subscription = {
      ...draft,
      id: crypto.randomUUID(),
      created_at: now.toISOString(),
    };
    const map = await offlineSubs();
    map.set(local.id, local);
    await persistOfflineSubs(map);
    return ok(local);
  }

  const { data, error } = await supabase.from('subscriptions').insert(draft).select('*').single();
  if (error || !data) {
    logger.error('createWeeklySubscription failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not create subscription', error);
  }
  return ok(data as Subscription);
}

/** Offline helper used by applySkip when Supabase is unset. */
export async function pauseSubscriptionDateLocal(
  subscriptionId: Uuid,
  customerId: Uuid,
  date: string,
): Promise<Result<Subscription>> {
  const map = await offlineSubs();
  const hit = map.get(subscriptionId);
  if (!hit || hit.customer_id !== customerId) {
    return err('NOT_FOUND', 'Subscription not found');
  }
  if (hit.paused_dates.includes(date)) {
    return err('VALIDATION', 'This meal is already paused/skipped');
  }
  const next: Subscription = {
    ...hit,
    paused_dates: [...hit.paused_dates, date],
  };
  map.set(subscriptionId, next);
  await persistOfflineSubs(map);
  return ok(next);
}

/** Next N calendar dates for an active subscription, marking pauses. */
export function buildMealCalendar(
  subscription: Subscription,
  days = 14,
): { date: string; paused: boolean; status: 'scheduled' | 'paused' | 'past' }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const paused = new Set(subscription.paused_dates ?? []);
  const results: { date: string; paused: boolean; status: 'scheduled' | 'paused' | 'past' }[] = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (subscription.starts_on && iso < subscription.starts_on) continue;
    if (subscription.ends_on && iso > subscription.ends_on) continue;
    const isPaused = paused.has(iso);
    results.push({
      date: iso,
      paused: isPaused,
      status: isPaused ? 'paused' : 'scheduled',
    });
  }
  return results;
}
