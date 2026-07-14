import type { ChefApplication, MakerProfile, Order, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { isSupabaseConfigured, supabase } from '../supabase';
import { logger } from '../logger';
import { listActiveMakers, listChefApplications, attachActivationErrors } from '../marketplace/localStore';
import { listOrdersForMaker } from './orders';

export type AdminStats = {
  pendingApplications: number;
  totalApplications: number;
  activeKitchens: number;
  closedKitchens: number;
  totalKitchens: number;
  openOrders: number;
  completedOrders: number;
  totalOrders: number;
  revenueDelivered: number;
};

function normalizeMaker(raw: MakerProfile): MakerProfile {
  return {
    ...raw,
    cuisine_tags: Array.isArray(raw.cuisine_tags) ? raw.cuisine_tags : [],
    rating_avg: Number(raw.rating_avg) || 0,
    rating_count: Number(raw.rating_count) || 0,
    is_active: Boolean(raw.is_active),
    is_open: raw.is_open !== false,
  };
}

function normalizeOrder(raw: Order): Order {
  return {
    ...raw,
    subtotal: Number(raw.subtotal) || 0,
    credits_applied: Number(raw.credits_applied) || 0,
    total: Number(raw.total) || 0,
  };
}

/** All chef applications (Supabase first, local fallback). */
export async function adminListApplications(): Promise<Result<ChefApplication[]>> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('list_chef_applications');
    if (!error && data) {
      return ok(await attachActivationErrors(data as ChefApplication[]));
    }
    if (error) logger.warn('adminListApplications rpc failed', error);

    const { data: rows, error: selectError } = await supabase
      .from('chef_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (!selectError && rows) {
      return ok(await attachActivationErrors(rows as ChefApplication[]));
    }
  }

  return ok(await listChefApplications());
}

export async function adminSetApplicationStatus(
  applicationId: Uuid,
  status: ChefApplication['status'],
): Promise<Result<ChefApplication>> {
  if (!isSupabaseConfigured) {
    return err('UNKNOWN', 'Supabase required to update application status');
  }
  const { data, error } = await supabase.rpc('set_chef_application_status', {
    p_id: applicationId,
    p_status: status,
  });
  if (error || !data) {
    logger.error('adminSetApplicationStatus failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not update application', error);
  }
  return ok(data as ChefApplication);
}

/** All kitchens including closed / inactive. */
export async function adminListKitchens(): Promise<Result<MakerProfile[]>> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('list_all_makers_admin');
    if (!error && data) {
      return ok((data as MakerProfile[]).map(normalizeMaker));
    }
    if (error) logger.warn('adminListKitchens rpc failed', error);

    const { data: rows, error: selectError } = await supabase
      .from('maker_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!selectError && rows) {
      return ok((rows as MakerProfile[]).map(normalizeMaker));
    }
  }

  return ok((await listActiveMakers()).map(normalizeMaker));
}

/** Recent marketplace orders across all kitchens. */
export async function adminListOrders(): Promise<Result<Order[]>> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('list_all_orders_admin');
    if (!error && data) {
      return ok((data as Order[]).map(normalizeOrder));
    }
    if (error) logger.warn('adminListOrders rpc failed', error);

    const { data: rows, error: selectError } = await supabase
      .from('orders')
      .select('*')
      .neq('status', 'payment_pending')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!selectError && rows) {
      return ok((rows as Order[]).map(normalizeOrder));
    }
  }

  const makers = await listActiveMakers();
  const all: Order[] = [];
  for (const maker of makers) {
    const result = await listOrdersForMaker(maker.id);
    if (result.ok) all.push(...result.data);
  }
  return ok(all.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function adminGetStats(): Promise<Result<AdminStats>> {
  const [apps, kitchens, orders] = await Promise.all([
    adminListApplications(),
    adminListKitchens(),
    adminListOrders(),
  ]);

  if (!apps.ok) return apps;
  if (!kitchens.ok) return kitchens;
  if (!orders.ok) return orders;

  const applications = apps.data;
  const makers = kitchens.data;
  const orderRows = orders.data;

  const openStatuses = new Set(['placed', 'accepted', 'cooking', 'out_for_delivery']);
  const completed = orderRows.filter((o) => o.status === 'delivered');

  return ok({
    pendingApplications: applications.filter((a) => a.status === 'new' || a.status === 'reviewing')
      .length,
    totalApplications: applications.length,
    activeKitchens: makers.filter((m) => m.is_active && m.is_open !== false).length,
    closedKitchens: makers.filter((m) => m.is_active && m.is_open === false).length,
    totalKitchens: makers.length,
    openOrders: orderRows.filter((o) => openStatuses.has(o.status)).length,
    completedOrders: completed.length,
    totalOrders: orderRows.length,
    revenueDelivered: completed.reduce((sum, o) => sum + Number(o.total), 0),
  });
}
