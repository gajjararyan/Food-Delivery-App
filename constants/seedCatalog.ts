/**
 * Offline / pre-migration catalog mirroring
 * supabase/migrations/20260708120200_seed_nani_geeta.sql
 * Used when Supabase is unset or seed rows are missing.
 */
import type { MakerProfile, MenuItem, ThaliComponent } from '../lib/types';
import { migrateStoredComponent } from '../lib/marketplace/componentNormalize';
import { SEED } from './seed';

const now = '2026-07-08T00:00:00.000Z';

type SeedComponent = Omit<ThaliComponent, 'serving_amount' | 'serving_unit'> &
  Partial<Pick<ThaliComponent, 'serving_amount' | 'serving_unit' | 'component_type'>>;

function seedComponent(row: SeedComponent): ThaliComponent {
  return migrateStoredComponent(row as ThaliComponent);
}

export const SEED_MAKER: MakerProfile = {
  id: SEED.makerId,
  display_name: 'Nani Geeta',
  kitchen_name: "Nani Geeta's Kitchen",
  bio: 'Traditional Gujarati recipes, cooked fresh each morning. Jain-friendly swaps available on every thali.',
  photo_url: null,
  kitchen_address: 'Bandra West, Mumbai',
  lat: 19.0596,
  lng: 72.8295,
  tier: 'verified',
  cuisine_tags: ['Gujarati', 'Home-style', 'Vegetarian'],
  rating_avg: 4.9,
  rating_count: 128,
  is_active: true,
  is_open: true,
  created_at: now,
};

export const SEED_LUNCH_THALI: MenuItem = {
  id: SEED.lunchThaliId,
  maker_id: SEED.makerId,
  name: 'Gujarati Thali',
  description:
    'Roti, rice, dal, sabzi, papad & sweet — customize quantities to your appetite.',
  image_url: null,
  base_price: 149,
  meal_slot: 'lunch',
  is_available: true,
  has_jain_variant: true,
  created_at: now,
};

export const SEED_DINNER_THALI: MenuItem = {
  id: SEED.dinnerThaliId,
  maker_id: SEED.makerId,
  name: 'Gujarati Thali (Dinner)',
  description: 'Evening thali with the same customizable components.',
  image_url: null,
  base_price: 159,
  meal_slot: 'dinner',
  is_available: true,
  has_jain_variant: true,
  created_at: now,
};

const LUNCH_COMPONENTS: ThaliComponent[] = [
  seedComponent({
    id: '33333333-3333-4333-8333-333333333301',
    menu_item_id: SEED.lunchThaliId,
    name: 'Roti',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 3,
    min_qty: 1,
    max_qty: 6,
    unit_price_delta: 8,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 1,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333302',
    menu_item_id: SEED.lunchThaliId,
    name: 'Rice',
    serving_amount: 500,
    serving_unit: 'gm',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 15,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 2,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333303',
    menu_item_id: SEED.lunchThaliId,
    name: 'Dal',
    serving_amount: 1,
    serving_unit: 'bowl',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 20,
    has_jain_variant: true,
    jain_substitute: 'Moong dal (no onion/garlic)',
    sort_order: 3,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333304',
    menu_item_id: SEED.lunchThaliId,
    name: 'Sabzi',
    serving_amount: 1,
    serving_unit: 'bowl',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 25,
    has_jain_variant: true,
    jain_substitute: 'Mixed veg (no root vegetables)',
    sort_order: 4,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333305',
    menu_item_id: SEED.lunchThaliId,
    name: 'Papad',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 1,
    min_qty: 0,
    max_qty: 3,
    unit_price_delta: 5,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 5,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333306',
    menu_item_id: SEED.lunchThaliId,
    name: 'Sweet',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 20,
    has_jain_variant: true,
    jain_substitute: 'Jain shrikhand',
    sort_order: 6,
  }),
];

const DINNER_COMPONENTS: ThaliComponent[] = [
  seedComponent({
    id: '33333333-3333-4333-8333-333333333311',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Roti',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 3,
    min_qty: 1,
    max_qty: 6,
    unit_price_delta: 8,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 1,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333312',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Rice',
    serving_amount: 500,
    serving_unit: 'gm',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 15,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 2,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333313',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Dal',
    serving_amount: 1,
    serving_unit: 'bowl',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 20,
    has_jain_variant: true,
    jain_substitute: 'Moong dal (no onion/garlic)',
    sort_order: 3,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333314',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Sabzi',
    serving_amount: 1,
    serving_unit: 'bowl',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 25,
    has_jain_variant: true,
    jain_substitute: 'Mixed veg (no root vegetables)',
    sort_order: 4,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333315',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Papad',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 1,
    min_qty: 0,
    max_qty: 3,
    unit_price_delta: 5,
    has_jain_variant: false,
    jain_substitute: null,
    sort_order: 5,
  }),
  seedComponent({
    id: '33333333-3333-4333-8333-333333333316',
    menu_item_id: SEED.dinnerThaliId,
    name: 'Sweet',
    serving_amount: 1,
    serving_unit: 'piece',
    included_qty: 1,
    min_qty: 0,
    max_qty: 2,
    unit_price_delta: 20,
    has_jain_variant: true,
    jain_substitute: 'Jain shrikhand',
    sort_order: 6,
  }),
];

export function resolveMakerId(param: string): string {
  if (param === 'nani-geeta' || param === SEED.makerId) {
    return SEED.makerId;
  }
  return param;
}

export function resolveMenuItemId(param: string): string {
  if (param === 'gujarati-thali' || param === SEED.lunchThaliId) {
    return SEED.lunchThaliId;
  }
  if (param === 'gujarati-thali-dinner' || param === SEED.dinnerThaliId) {
    return SEED.dinnerThaliId;
  }
  return param;
}

export function seedMakerById(id: string): MakerProfile | null {
  if (resolveMakerId(id) === SEED.makerId) return SEED_MAKER;
  return null;
}

/** Sync lookup after marketplace hydrate — used from menu API async paths. */
export function seedMenuForMaker(makerId: string): MenuItem[] {
  if (resolveMakerId(makerId) !== SEED.makerId) return [];
  return [SEED_LUNCH_THALI, SEED_DINNER_THALI];
}

export function seedMenuItemWithComponents(menuItemId: string): {
  menuItem: MenuItem;
  components: ThaliComponent[];
} | null {
  const id = resolveMenuItemId(menuItemId);
  if (id === SEED.lunchThaliId) {
    return { menuItem: SEED_LUNCH_THALI, components: LUNCH_COMPONENTS };
  }
  if (id === SEED.dinnerThaliId) {
    return { menuItem: SEED_DINNER_THALI, components: DINNER_COMPONENTS };
  }
  return null;
}
