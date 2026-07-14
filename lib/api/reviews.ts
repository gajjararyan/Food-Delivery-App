import type { Review, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import { readJsonMap, writeJsonMap } from '../offlineStore';

const REVIEWS_KEY = 'gharkaswad_offline_reviews_v1';

let memoryReviews: Map<string, Review> | null = null;

async function offlineReviews(): Promise<Map<string, Review>> {
  if (!memoryReviews) {
    memoryReviews = await readJsonMap<Review>(REVIEWS_KEY);
  }
  return memoryReviews;
}

async function persistOfflineReviews(map: Map<string, Review>): Promise<void> {
  memoryReviews = map;
  await writeJsonMap(REVIEWS_KEY, map);
}

export async function getReviewForOrder(orderId: Uuid): Promise<Result<Review | null>> {
  if (!isSupabaseConfigured) {
    const map = await offlineReviews();
    return ok(map.get(orderId) ?? null);
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) return err('UNKNOWN', error.message, error);
  return ok((data as Review | null) ?? null);
}

export async function submitReview(params: {
  customerId: Uuid;
  orderId: Uuid;
  makerId: Uuid;
  rating: number;
  comment?: string;
}): Promise<Result<Review>> {
  const rating = Math.min(5, Math.max(1, Math.round(params.rating)));
  if (!isSupabaseConfigured) {
    const local: Review = {
      id: crypto.randomUUID(),
      customer_id: params.customerId,
      order_id: params.orderId,
      maker_id: params.makerId,
      rating,
      comment: params.comment?.trim() || null,
      created_at: new Date().toISOString(),
    };
    const map = await offlineReviews();
    map.set(params.orderId, local);
    await persistOfflineReviews(map);
    return ok(local);
  }

  // Security-definer RPC — works with DEV_AUTH (no real JWT for RLS).
  const { data, error } = await supabase.rpc('submit_review', {
    payload: {
      customer_id: params.customerId,
      order_id: params.orderId,
      maker_id: params.makerId,
      rating,
      comment: params.comment?.trim() || null,
    },
  });

  if (error || !data) {
    logger.error('submitReview failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not submit review', error);
  }
  return ok(data as Review);
}
