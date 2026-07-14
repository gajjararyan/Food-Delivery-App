import type { ChefApplication, MakerProfile, MealSlot, MenuItem, ThaliComponent, Uuid } from '../types';

export type StoredMenu = {
  items: MenuItem[];
  componentsByMenuId: Record<Uuid, ThaliComponent[]>;
};

export type MarketplaceSnapshot = {
  applications: ChefApplication[];
  makers: MakerProfile[];
  menus: Record<Uuid, StoredMenu>;
  /** E.164 phone → maker id for chef dashboard login. */
  phoneToMakerId: Record<string, Uuid>;
  /** URL slug → maker id for customer chef pages. */
  slugToMakerId: Record<string, Uuid>;
  /** applicationId → last kitchen-activation failure message (ops retry). */
  activationErrors: Record<string, string>;
};

export const EMPTY_MARKETPLACE: MarketplaceSnapshot = {
  applications: [],
  makers: [],
  menus: {},
  phoneToMakerId: {},
  slugToMakerId: {},
  activationErrors: {},
};

export function kitchenSlug(kitchenName: string): string {
  return kitchenName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function uniqueKitchenSlug(
  kitchenName: string,
  taken: Set<string>,
): string {
  const base = kitchenSlug(kitchenName) || 'home-kitchen';
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function defaultThaliComponents(menuItemId: Uuid): ThaliComponent[] {
  const rows: Array<Omit<ThaliComponent, 'menu_item_id' | 'id'>> = [
    { name: 'Roti', serving_amount: 1, serving_unit: 'piece', component_type: 'included', included_qty: 3, min_qty: 1, max_qty: 6, unit_price_delta: 8, has_jain_variant: false, jain_substitute: null, sort_order: 1 },
    { name: 'Rice', serving_amount: 500, serving_unit: 'gm', component_type: 'included', included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 15, has_jain_variant: false, jain_substitute: null, sort_order: 2 },
    { name: 'Dal', serving_amount: 1, serving_unit: 'bowl', component_type: 'included', included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 20, has_jain_variant: true, jain_substitute: 'Moong dal (no onion/garlic)', sort_order: 3 },
    { name: 'Sabzi', serving_amount: 1, serving_unit: 'bowl', component_type: 'included', included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 25, has_jain_variant: true, jain_substitute: 'Mixed veg (no root vegetables)', sort_order: 4 },
    { name: 'Papad', serving_amount: 1, serving_unit: 'piece', component_type: 'addon_toggle', included_qty: 0, min_qty: 0, max_qty: 1, unit_price_delta: 10, has_jain_variant: false, jain_substitute: null, sort_order: 5 },
    { name: 'Chaas', serving_amount: 250, serving_unit: 'ml', component_type: 'addon_stepper', included_qty: 0, min_qty: 0, max_qty: 2, unit_price_delta: 20, has_jain_variant: false, jain_substitute: null, sort_order: 6 },
    { name: 'Sweet', serving_amount: 1, serving_unit: 'piece', component_type: 'included', included_qty: 1, min_qty: 0, max_qty: 2, unit_price_delta: 20, has_jain_variant: true, jain_substitute: 'Jain shrikhand', sort_order: 7 },
  ];
  return rows.map((row) => ({ ...row, id: crypto.randomUUID(), menu_item_id: menuItemId }));
}

export function createStarterMenu(
  makerId: Uuid,
  kitchenName: string,
  cuisineTags: string[],
  mealSlot: MealSlot = 'lunch',
  basePrice = 149,
): { menuItem: MenuItem; components: ThaliComponent[] } {
  const menuItemId = crypto.randomUUID();
  const now = new Date().toISOString();
  const cuisineLabel = cuisineTags[0] ?? 'Home-style';
  const menuItem: MenuItem = {
    id: menuItemId,
    maker_id: makerId,
    name: `${cuisineLabel} Thali`,
    description: `Fresh home-style thali from ${kitchenName}. Customize roti, rice, dal, sabzi & add extras like papad or chaas.`,
    image_url: null,
    base_price: basePrice,
    meal_slot: mealSlot,
    is_available: true,
    has_jain_variant: true,
    created_at: now,
  };
  return { menuItem, components: defaultThaliComponents(menuItemId) };
}
