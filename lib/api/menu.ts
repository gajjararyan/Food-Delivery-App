import type { MakerProfile, MenuItem, Review, ThaliComponent, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import {
  fetchCommunityMaker,
  fetchCommunityMenu,
  fetchCommunityMenuItem,
  fetchCommunityMakers,
  makerPublicSlug,
} from './chefs';
import { sortMakersForDiscover } from '../marketplace/kitchenStatus';
import { migrateStoredComponent } from '../marketplace/componentNormalize';
import { kitchenSlug } from '../marketplace/types';
import {
  resolveMakerId,
  resolveMenuItemId,
  seedMakerById,
  seedMenuForMaker,
  seedMenuItemWithComponents,
  SEED_MAKER,
} from '../../constants/seedCatalog';
import { SEED } from '../../constants/seed';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chef profile URLs use slugs (`dixit-s-kitchen`), but Supabase keys are UUIDs.
 * Resolve either form so menu / reviews queries hit the right kitchen.
 */
async function resolveMakerUuid(param: string): Promise<string | null> {
  const resolved = resolveMakerId(param.trim());
  if (!resolved) return null;
  if (UUID_RE.test(resolved)) return resolved;

  const community = await fetchCommunityMaker(resolved);
  if (community.ok) return community.data.id;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('maker_profiles')
      .select('id, kitchen_name')
      .eq('is_active', true);
    if (!error && data) {
      const needle = kitchenSlug(resolved);
      const match = data.find((row) => kitchenSlug(String(row.kitchen_name)) === needle);
      if (match?.id) return String(match.id);
    }
  }

  return null;
}

/** PostgREST may return numeric columns as strings — normalize for UI. */
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

function normalizeMenuItem(raw: MenuItem): MenuItem {
  return {
    ...raw,
    base_price: Number(raw.base_price) || 0,
  };
}

/** Keep one row per name — prefer included plate over leftover addon duplicates. */
function dedupeThaliComponents(list: ThaliComponent[]): ThaliComponent[] {
  const byName = new Map<string, ThaliComponent>();
  const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order);
  for (const component of sorted) {
    const key = component.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, component);
      continue;
    }
    const existingIncluded = (existing.component_type ?? 'included') === 'included';
    const nextIncluded = (component.component_type ?? 'included') === 'included';
    if (!existingIncluded && nextIncluded) {
      byName.set(key, component);
    }
  }
  return [...byName.values()].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Merge local pilot kitchens with remote rows.
 * When Supabase is configured, Discover is remote-only — a kitchen that only
 * exists in this device's AsyncStorage must not appear "live" to customers.
 * Offline/dev without Supabase still merges the local community cache.
 */
async function mergeMakers(remote: MakerProfile[]): Promise<MakerProfile[]> {
  if (isSupabaseConfigured) {
    return sortMakersForDiscover(remote.map(normalizeMaker));
  }

  const community = await fetchCommunityMakers();
  const byId = new Map<string, MakerProfile>();

  if (community.ok) {
    for (const maker of community.data) {
      byId.set(maker.id, normalizeMaker(maker));
    }
  }
  for (const maker of remote) {
    byId.set(maker.id, normalizeMaker(maker));
  }

  return sortMakersForDiscover([...byId.values()]);
}

/**
 * Live kitchens only when Supabase is configured — no fake catalog injection.
 * Offline/dev without Supabase still uses the local seed kitchen.
 */
export async function listMakers(): Promise<Result<MakerProfile[]>> {
  if (!isSupabaseConfigured) {
    return ok(await mergeMakers([SEED_MAKER]));
  }

  const { data, error } = await supabase
    .from('maker_profiles')
    .select('*')
    .eq('is_active', true)
    .order('rating_avg', { ascending: false });

  if (error) {
    logger.warn('listMakers failed', error);
    return ok(await mergeMakers([]));
  }

  return ok(await mergeMakers((data ?? []) as MakerProfile[]));
}

export async function getMaker(makerId: string): Promise<Result<MakerProfile>> {
  const uuid = await resolveMakerUuid(makerId);
  if (!uuid) {
    return err('NOT_FOUND', 'Kitchen not found');
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('maker_profiles')
      .select('*')
      .eq('id', uuid)
      .maybeSingle();

    if (!error && data) return ok(normalizeMaker(data as MakerProfile));
    if (error) logger.warn('getMaker failed', error);
  }

  const community = await fetchCommunityMaker(uuid);
  if (community.ok) return ok(normalizeMaker(community.data));

  if (!isSupabaseConfigured) {
    const seed = seedMakerById(uuid);
    return seed ? ok(seed) : err('NOT_FOUND', 'Kitchen not found');
  }

  return err('NOT_FOUND', 'Kitchen not found');
}

export async function makerChefHref(maker: MakerProfile): Promise<string> {
  if (maker.id === SEED.makerId) return '/(customer)/chef/nani-geeta';
  const slug = await makerPublicSlug(maker.id);
  return `/(customer)/chef/${slug}`;
}

/** Available dishes for one kitchen — only real menu rows, never fake gallery items. */
export async function listMenuForMaker(makerId: string): Promise<Result<MenuItem[]>> {
  const uuid = await resolveMakerUuid(makerId);
  if (!uuid) return ok([]);

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('maker_id', uuid)
      .eq('is_available', true)
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('listMenuForMaker failed', error);
      return err('UNKNOWN', error.message, error);
    }
    return ok(((data ?? []) as MenuItem[]).map(normalizeMenuItem));
  }

  const community = await fetchCommunityMenu(uuid);
  if (community.ok && community.data.length > 0) return community;

  return ok(seedMenuForMaker(uuid));
}

/** Live specials = available items across active kitchens (no hardcoded demos). */
export async function listLiveSpecials(limit = 12): Promise<
  Result<Array<MenuItem & { kitchen_name: string; maker_id: Uuid }>>
> {
  if (!isSupabaseConfigured) {
    const seedMenu = seedMenuForMaker(SEED.makerId);
    return ok(
      seedMenu.slice(0, limit).map((item) => ({
        ...item,
        kitchen_name: SEED_MAKER.kitchen_name,
      })),
    );
  }

  const { data, error } = await supabase
    .from('menu_items')
    .select('*, maker_profiles!inner(kitchen_name, is_active, is_open)')
    .eq('is_available', true)
    .eq('maker_profiles.is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn('listLiveSpecials failed', error);
    return err('UNKNOWN', error.message, error);
  }

  const rows = (data ?? []) as Array<
    MenuItem & { maker_profiles: { kitchen_name: string; is_active: boolean; is_open: boolean } }
  >;

  return ok(
    rows.map((row) => {
      const { maker_profiles, ...item } = row;
      return {
        ...normalizeMenuItem(item),
        kitchen_name: maker_profiles.kitchen_name,
      };
    }),
  );
}

export async function listReviewsForMaker(makerId: string): Promise<Result<Review[]>> {
  if (!isSupabaseConfigured) return ok([]);

  const uuid = await resolveMakerUuid(makerId);
  if (!uuid) return ok([]);

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('maker_id', uuid)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.warn('listReviewsForMaker failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok((data ?? []) as Review[]);
}

export async function getMenuItemWithComponents(
  menuItemId: string,
): Promise<Result<{ menuItem: MenuItem; components: ThaliComponent[] }>> {
  const id = resolveMenuItemId(menuItemId);

  if (isSupabaseConfigured) {
    const { data: menuItem, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (menuError) {
      logger.warn('getMenuItemWithComponents menu failed', menuError);
      return err('UNKNOWN', menuError.message, menuError);
    }
    if (!menuItem) {
      return err('NOT_FOUND', 'Menu item not found');
    }

    const { data: components, error: compError } = await supabase
      .from('thali_components')
      .select('*')
      .eq('menu_item_id', id)
      .order('sort_order', { ascending: true });

    if (compError) {
      logger.warn('getMenuItemWithComponents components failed', compError);
    }

    const list = (!compError ? (components ?? []) : []) as ThaliComponent[];
    // Prefer plate items; drop duplicate names that are leftover sync junk.
    const deduped = dedupeThaliComponents(list);
    return ok({
      menuItem: normalizeMenuItem(menuItem as MenuItem),
      // Normalize qty rules so mis-seeded addon rows can't invent negative deltas.
      components: deduped.map((c) =>
        migrateStoredComponent({
          ...c,
          serving_amount: Number(c.serving_amount) || 1,
          unit_price_delta: Number(c.unit_price_delta) || 0,
          included_qty: Number(c.included_qty) || 0,
          min_qty: Number(c.min_qty) || 0,
          max_qty: Number(c.max_qty) || 0,
        }),
      ),
    });
  }

  const community = await fetchCommunityMenuItem(id);
  if (community.ok) return community;

  const seed = seedMenuItemWithComponents(id);
  return seed ? ok(seed) : err('NOT_FOUND', 'Menu item not found');
}
