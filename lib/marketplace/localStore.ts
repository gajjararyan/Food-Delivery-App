import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChefApplication, MakerProfile, MealSlot, MenuItem, ServingUnit, ThaliComponent, Uuid } from '../types';
import { logger } from '../logger';
import {
  createStarterMenu,
  defaultThaliComponents,
  EMPTY_MARKETPLACE,
  kitchenSlug,
  type MarketplaceSnapshot,
  uniqueKitchenSlug,
} from './types';
import { isKitchenDiscoverable, sortMakersForDiscover } from './kitchenStatus';
import { finalizeComponentQuantities, migrateStoredComponent } from './componentNormalize';
import { defaultServingSize, normalizeServingAmount, normalizeServingUnit } from '../servingSize';

const STORAGE_KEY = 'gharkaswad_marketplace_v1';

let cache: MarketplaceSnapshot = { ...EMPTY_MARKETPLACE };
let hydrated = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (cause) {
    logger.warn('marketplace persist failed', cause);
  }
  notify();
}

export function subscribeMarketplace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function migrateMarketplaceSnapshot(snapshot: MarketplaceSnapshot): MarketplaceSnapshot {
  const menus: MarketplaceSnapshot['menus'] = {};
  for (const [makerId, menu] of Object.entries(snapshot.menus)) {
    const componentsByMenuId: Record<Uuid, ThaliComponent[]> = {};
    for (const [menuItemId, components] of Object.entries(menu.componentsByMenuId)) {
      componentsByMenuId[menuItemId] = components.map(migrateStoredComponent);
    }
    menus[makerId] = { ...menu, componentsByMenuId };
  }
  return {
    ...snapshot,
    menus,
    activationErrors: snapshot.activationErrors ?? {},
  };
}

export async function hydrateMarketplace(): Promise<MarketplaceSnapshot> {
  if (hydrated) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...EMPTY_MARKETPLACE, ...(JSON.parse(raw) as MarketplaceSnapshot) };
      cache = migrateMarketplaceSnapshot(parsed);
    }
  } catch (cause) {
    logger.warn('marketplace hydrate failed', cause);
    cache = { ...EMPTY_MARKETPLACE };
  }
  hydrated = true;
  return cache;
}

export async function getMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  await hydrateMarketplace();
  return cache;
}

export async function resetMarketplaceForTests(): Promise<void> {
  cache = { ...EMPTY_MARKETPLACE };
  hydrated = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}

export async function addChefApplication(
  application: ChefApplication,
): Promise<ChefApplication> {
  await hydrateMarketplace();
  cache = {
    ...cache,
    applications: [application, ...cache.applications.filter((a) => a.id !== application.id)],
  };
  await persist();
  return application;
}

export async function listChefApplications(): Promise<ChefApplication[]> {
  await hydrateMarketplace();
  return [...cache.applications]
    .map(enrichApplicationActivationError)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function enrichApplicationActivationError(application: ChefApplication): ChefApplication {
  const activationError = cache.activationErrors[application.id] ?? null;
  return { ...application, activation_error: activationError };
}

export async function setApplicationActivationError(
  applicationId: Uuid,
  message: string,
): Promise<void> {
  await hydrateMarketplace();
  cache = {
    ...cache,
    activationErrors: { ...cache.activationErrors, [applicationId]: message },
  };
  await persist();
}

export async function clearApplicationActivationError(applicationId: Uuid): Promise<void> {
  await hydrateMarketplace();
  if (!(applicationId in cache.activationErrors)) return;
  const next = { ...cache.activationErrors };
  delete next[applicationId];
  cache = { ...cache, activationErrors: next };
  await persist();
}

export async function getApplicationActivationError(
  applicationId: Uuid,
): Promise<string | null> {
  await hydrateMarketplace();
  return cache.activationErrors[applicationId] ?? null;
}

/** Merge local activation-failure notes onto remote application rows. */
export async function attachActivationErrors(
  applications: ChefApplication[],
): Promise<ChefApplication[]> {
  await hydrateMarketplace();
  return applications.map((application) => {
    const activationError = cache.activationErrors[application.id] ?? null;
    return { ...application, activation_error: activationError };
  });
}

export async function getChefApplicationByPhone(
  phone: string,
): Promise<ChefApplication | null> {
  await hydrateMarketplace();
  const hit = cache.applications.find((a) => a.phone === phone) ?? null;
  return hit ? enrichApplicationActivationError(hit) : null;
}

export async function listActiveMakers(): Promise<MakerProfile[]> {
  await hydrateMarketplace();
  return sortMakersForDiscover(cache.makers.filter((m) => isKitchenDiscoverable(m)));
}

export async function getMakerById(id: Uuid): Promise<MakerProfile | null> {
  await hydrateMarketplace();
  return cache.makers.find((m) => m.id === id) ?? null;
}

export async function getMakerBySlug(slug: string): Promise<MakerProfile | null> {
  await hydrateMarketplace();
  const id = cache.slugToMakerId[slug] ?? cache.slugToMakerId[kitchenSlug(slug)];
  if (!id) return null;
  return getMakerById(id);
}

export async function getMakerForPhone(phone: string): Promise<MakerProfile | null> {
  await hydrateMarketplace();
  const id = cache.phoneToMakerId[phone];
  if (!id) return null;
  return getMakerById(id);
}

export async function getPhoneForMaker(makerId: Uuid): Promise<string | null> {
  await hydrateMarketplace();
  const entry = Object.entries(cache.phoneToMakerId).find(([, id]) => id === makerId);
  return entry?.[0] ?? null;
}

export async function resolveMakerParam(param: string): Promise<MakerProfile | null> {
  await hydrateMarketplace();
  const byId = await getMakerById(param);
  if (byId) return byId;
  return getMakerBySlug(param);
}

export async function listMenuItemsForMaker(makerId: Uuid): Promise<MenuItem[]> {
  await hydrateMarketplace();
  return (cache.menus[makerId]?.items ?? []).filter((item) => item.is_available);
}

/** Chef dashboard — includes hidden/unavailable items. */
export async function listAllMenuItemsForMaker(makerId: Uuid): Promise<MenuItem[]> {
  await hydrateMarketplace();
  return [...(cache.menus[makerId]?.items ?? [])];
}

/**
 * Replace local kitchen cache with remote (Supabase) data so chef edits
 * and customer Discover stay on the same source of truth.
 */
export async function replaceMakerKitchenFromRemote(input: {
  maker: MakerProfile;
  ownerPhone?: string | null;
  items: MenuItem[];
  componentsByMenuId: Record<Uuid, ThaliComponent[]>;
}): Promise<void> {
  await hydrateMarketplace();
  const { maker, ownerPhone, items, componentsByMenuId } = input;

  const existingSlug = Object.entries(cache.slugToMakerId).find(([, id]) => id === maker.id)?.[0];
  const taken = new Set(
    Object.entries(cache.slugToMakerId)
      .filter(([, id]) => id !== maker.id)
      .map(([slug]) => slug),
  );
  const slug = existingSlug ?? uniqueKitchenSlug(maker.kitchen_name, taken);

  const nextPhoneMap = { ...cache.phoneToMakerId };
  // Drop stale phone links for this maker, then set the current owner phone.
  for (const [phone, id] of Object.entries(nextPhoneMap)) {
    if (id === maker.id) delete nextPhoneMap[phone];
  }
  if (ownerPhone) nextPhoneMap[ownerPhone] = maker.id;

  cache = {
    ...cache,
    makers: [maker, ...cache.makers.filter((m) => m.id !== maker.id)],
    menus: {
      ...cache.menus,
      [maker.id]: {
        items: [...items],
        componentsByMenuId: { ...componentsByMenuId },
      },
    },
    phoneToMakerId: nextPhoneMap,
    slugToMakerId: { ...cache.slugToMakerId, [slug]: maker.id },
  };
  await persist();
}

export async function getMenuItemBundle(
  menuItemId: Uuid,
): Promise<{ menuItem: MenuItem; components: ThaliComponent[] } | null> {
  await hydrateMarketplace();
  for (const menu of Object.values(cache.menus)) {
    const menuItem = menu.items.find((item) => item.id === menuItemId);
    if (!menuItem) continue;
    const components = menu.componentsByMenuId[menuItemId] ?? [];
    return { menuItem, components };
  }
  return null;
}

export async function approveChefApplication(applicationId: Uuid): Promise<MakerProfile> {
  await hydrateMarketplace();
  const application = cache.applications.find((a) => a.id === applicationId);
  if (!application) throw new Error('Application not found');
  if (application.status === 'accepted') {
    const existing = cache.makers.find((m) => cache.phoneToMakerId[application.phone] === m.id);
    if (existing) return existing;
  }

  const makerId = crypto.randomUUID();
  const kitchenName = `${application.full_name.split(' ')[0] ?? application.full_name}'s Kitchen`;
  const slug = uniqueKitchenSlug(kitchenName, new Set(Object.keys(cache.slugToMakerId)));
  const cuisineTags = application.cuisine_experience
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (cuisineTags.length === 0) cuisineTags.push('Home-style', 'Vegetarian');

  const maker: MakerProfile = {
    id: makerId,
    display_name: application.full_name,
    kitchen_name: kitchenName,
    bio: application.message?.trim() || application.cuisine_experience,
    photo_url: null,
    cover_url: null,
    kitchen_address: application.city ? `${application.city}, India` : null,
    lat: null,
    lng: null,
    tier: 'unverified',
    cuisine_tags: cuisineTags,
    rating_avg: 0,
    rating_count: 0,
    is_active: true,
    is_open: true,
    created_at: new Date().toISOString(),
  };

  const { menuItem, components } = createStarterMenu(
    makerId,
    kitchenName,
    cuisineTags,
    'lunch',
    149,
  );

  cache = {
    ...cache,
    makers: [maker, ...cache.makers],
    applications: cache.applications.map((a) =>
      a.id === applicationId ? { ...a, status: 'accepted' as const } : a,
    ),
    menus: {
      ...cache.menus,
      [makerId]: { items: [menuItem], componentsByMenuId: { [menuItem.id]: components } },
    },
    phoneToMakerId: { ...cache.phoneToMakerId, [application.phone]: makerId },
    slugToMakerId: { ...cache.slugToMakerId, [slug]: makerId },
  };
  await persist();
  return maker;
}

export async function rejectChefApplication(applicationId: Uuid): Promise<void> {
  await hydrateMarketplace();
  cache = {
    ...cache,
    applications: cache.applications.map((a) =>
      a.id === applicationId ? { ...a, status: 'rejected' as const } : a,
    ),
  };
  await persist();
}

export async function updateMakerProfile(
  makerId: Uuid,
  patch: Partial<
    Pick<
      MakerProfile,
      | 'kitchen_name'
      | 'bio'
      | 'is_active'
      | 'is_open'
      | 'cuisine_tags'
      | 'photo_url'
      | 'cover_url'
      | 'kitchen_address'
      | 'lat'
      | 'lng'
    >
  >,
): Promise<MakerProfile> {
  await hydrateMarketplace();
  const current = cache.makers.find((m) => m.id === makerId);
  if (!current) throw new Error('Kitchen not found');

  const next = { ...current, ...patch };
  cache = {
    ...cache,
    makers: cache.makers.map((m) => (m.id === makerId ? next : m)),
  };
  await persist();
  return next;
}

export async function updateMenuItem(
  makerId: Uuid,
  menuItemId: Uuid,
  patch: Partial<
    Pick<MenuItem, 'name' | 'description' | 'base_price' | 'is_available' | 'meal_slot' | 'has_jain_variant' | 'image_url'>
  >,
): Promise<MenuItem> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) throw new Error('Menu not found');
  const current = menu.items.find((item) => item.id === menuItemId);
  if (!current) throw new Error('Menu item not found');

  const next = { ...current, ...patch };
  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        items: menu.items.map((item) => (item.id === menuItemId ? next : item)),
      },
    },
  };
  await persist();
  return next;
}

export async function addMenuItem(
  makerId: Uuid,
  input: {
    name: string;
    description?: string | null;
    base_price: number;
    meal_slot?: MealSlot;
    has_jain_variant?: boolean;
    image_url?: string | null;
    is_available?: boolean;
    enable_customization?: boolean;
    /** Chef-defined components at create time (replaces default starter set). */
    components?: ThaliComponentInput[];
  },
): Promise<MenuItem> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) throw new Error('Menu not found');

  const menuItemId = crypto.randomUUID();
  const now = new Date().toISOString();
  const menuItem: MenuItem = {
    id: menuItemId,
    maker_id: makerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    base_price: input.base_price,
    meal_slot: input.meal_slot ?? 'lunch',
    is_available: input.is_available ?? true,
    has_jain_variant: input.has_jain_variant ?? true,
    created_at: now,
  };

  let components: ThaliComponent[] = [];
  if (input.enable_customization !== false) {
    if (input.components && input.components.length > 0) {
      const seen = new Set<string>();
      components = input.components
        .filter((c) => {
          const key = c.name.trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c, index) => normalizeComponentInput(menuItemId, c, index + 1));
    } else {
      components = defaultThaliComponents(menuItemId);
    }
  }

  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        items: [...menu.items, menuItem],
        componentsByMenuId: { ...menu.componentsByMenuId, [menuItemId]: components },
      },
    },
  };
  await persist();
  return menuItem;
}

export async function deleteMenuItem(makerId: Uuid, menuItemId: Uuid): Promise<void> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) return;
  if (!menu.items.some((item) => item.id === menuItemId)) return;

  const { [menuItemId]: _removed, ...restComponents } = menu.componentsByMenuId;
  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        items: menu.items.filter((item) => item.id !== menuItemId),
        componentsByMenuId: restComponents,
      },
    },
  };
  await persist();
}

export async function listThaliComponents(makerId: Uuid, menuItemId: Uuid): Promise<ThaliComponent[]> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) return [];
  return [...(menu.componentsByMenuId[menuItemId] ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export type ThaliComponentInput = {
  name: string;
  serving_amount?: number;
  serving_unit?: ServingUnit;
  included_qty?: number;
  min_qty?: number;
  max_qty?: number;
  unit_price_delta?: number;
  has_jain_variant?: boolean;
  jain_substitute?: string | null;
  component_type?: ThaliComponent['component_type'];
};

function normalizeComponentInput(
  menuItemId: Uuid,
  input: ThaliComponentInput,
  sortOrder: number,
): ThaliComponent {
  const componentType = input.component_type ?? 'included';
  const qty = finalizeComponentQuantities({
    component_type: componentType,
    included_qty: input.included_qty ?? (componentType === 'included' ? 1 : 0),
    min_qty: input.min_qty ?? 0,
    max_qty: input.max_qty ?? (componentType === 'addon_toggle' ? 1 : componentType === 'addon_stepper' ? 3 : 3),
  });
  const serving = defaultServingSize({
    serving_amount: input.serving_amount,
    serving_unit: input.serving_unit,
  });

  return {
    id: crypto.randomUUID(),
    menu_item_id: menuItemId,
    name: input.name.trim(),
    ...serving,
    ...qty,
    unit_price_delta: Math.max(0, input.unit_price_delta ?? 0),
    has_jain_variant: input.has_jain_variant ?? false,
    jain_substitute: input.jain_substitute?.trim() || null,
    sort_order: sortOrder,
  };
}

export async function addThaliComponent(
  makerId: Uuid,
  menuItemId: Uuid,
  input: ThaliComponentInput,
): Promise<ThaliComponent> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) throw new Error('Menu not found');
  if (!menu.items.some((item) => item.id === menuItemId)) throw new Error('Menu item not found');
  if (!input.name.trim()) throw new Error('Component name is required');

  const existing = menu.componentsByMenuId[menuItemId] ?? [];
  const nameKey = input.name.trim().toLowerCase();
  const duplicate = existing.find((c) => c.name.trim().toLowerCase() === nameKey);
  if (duplicate) return duplicate;

  const sortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sort_order)) + 1 : 1;
  const component = normalizeComponentInput(menuItemId, input, sortOrder);

  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        componentsByMenuId: {
          ...menu.componentsByMenuId,
          [menuItemId]: [...existing, component],
        },
      },
    },
  };
  await persist();
  return component;
}

export async function updateThaliComponent(
  makerId: Uuid,
  menuItemId: Uuid,
  componentId: Uuid,
  patch: Partial<
    Pick<
      ThaliComponent,
      | 'name'
      | 'serving_amount'
      | 'serving_unit'
      | 'included_qty'
      | 'min_qty'
      | 'max_qty'
      | 'unit_price_delta'
      | 'has_jain_variant'
      | 'jain_substitute'
      | 'sort_order'
      | 'component_type'
    >
  >,
): Promise<ThaliComponent> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) throw new Error('Menu not found');
  const components = menu.componentsByMenuId[menuItemId] ?? [];
  const current = components.find((c) => c.id === componentId);
  if (!current) throw new Error('Component not found');

  const merged = { ...current, ...patch };
  const qty = finalizeComponentQuantities(merged);
  const serving = defaultServingSize(merged);
  const next: ThaliComponent = {
    ...merged,
    name: merged.name.trim(),
    ...serving,
    ...qty,
    serving_amount: normalizeServingAmount(patch.serving_amount ?? merged.serving_amount),
    serving_unit: normalizeServingUnit(patch.serving_unit ?? merged.serving_unit),
    unit_price_delta: Math.max(0, merged.unit_price_delta),
    jain_substitute: merged.has_jain_variant ? merged.jain_substitute?.trim() || null : null,
  };

  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        componentsByMenuId: {
          ...menu.componentsByMenuId,
          [menuItemId]: components.map((c) => (c.id === componentId ? next : c)),
        },
      },
    },
  };
  await persist();
  return next;
}

export async function deleteThaliComponent(
  makerId: Uuid,
  menuItemId: Uuid,
  componentId: Uuid,
): Promise<void> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId];
  if (!menu) return;
  const components = menu.componentsByMenuId[menuItemId] ?? [];
  if (!components.some((c) => c.id === componentId)) return;

  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        componentsByMenuId: {
          ...menu.componentsByMenuId,
          [menuItemId]: components.filter((c) => c.id !== componentId),
        },
      },
    },
  };
  await persist();
}

/** Overwrite local components for one menu item (after remote fetch). */
export async function setMenuItemComponents(
  makerId: Uuid,
  menuItemId: Uuid,
  components: ThaliComponent[],
): Promise<void> {
  await hydrateMarketplace();
  const menu = cache.menus[makerId] ?? { items: [], componentsByMenuId: {} };
  cache = {
    ...cache,
    menus: {
      ...cache.menus,
      [makerId]: {
        ...menu,
        componentsByMenuId: {
          ...menu.componentsByMenuId,
          [menuItemId]: components.map(migrateStoredComponent),
        },
      },
    },
  };
  await persist();
}

export async function slugForMaker(makerId: Uuid): Promise<string | null> {
  await hydrateMarketplace();
  const entry = Object.entries(cache.slugToMakerId).find(([, id]) => id === makerId);
  return entry?.[0] ?? null;
}
