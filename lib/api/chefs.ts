import type { ChefApplication, MakerProfile, MealSlot, MenuItem, ThaliComponent, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { isSupabaseConfigured, supabase } from '../supabase';
import { logger } from '../logger';
import { persistImageUrl } from '../images/uploadKitchenImage';
import { toE164India } from '../phone';
import {
  addChefApplication,
  addMenuItem,
  addThaliComponent,
  approveChefApplication,
  attachActivationErrors,
  clearApplicationActivationError,
  deleteMenuItem,
  deleteThaliComponent,
  getChefApplicationByPhone,
  getMakerById,
  getMakerForPhone,
  getMenuItemBundle,
  getPhoneForMaker,
  listActiveMakers,
  listAllMenuItemsForMaker,
  listChefApplications,
  listMenuItemsForMaker,
  listThaliComponents,
  rejectChefApplication,
  replaceMakerKitchenFromRemote,
  resolveMakerParam,
  setApplicationActivationError,
  setMenuItemComponents,
  slugForMaker,
  type ThaliComponentInput,
  updateMakerProfile,
  updateMenuItem,
  updateThaliComponent,
} from '../marketplace/localStore';
import { migrateStoredComponent } from '../marketplace/componentNormalize';

async function syncLocalComponents(
  makerId: Uuid,
  menuItemId: Uuid,
  components: ThaliComponent[],
): Promise<void> {
  await setMenuItemComponents(makerId, menuItemId, components);
}

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
    is_available: Boolean(raw.is_available),
    has_jain_variant: Boolean(raw.has_jain_variant),
  };
}

function normalizeComponent(raw: ThaliComponent): ThaliComponent {
  return migrateStoredComponent({
    ...raw,
    serving_amount: Number(raw.serving_amount) || 1,
    included_qty: Number(raw.included_qty) || 0,
    min_qty: Number(raw.min_qty) || 0,
    max_qty: Number(raw.max_qty) || 1,
    unit_price_delta: Number(raw.unit_price_delta) || 0,
    sort_order: Number(raw.sort_order) || 0,
    has_jain_variant: Boolean(raw.has_jain_variant),
  });
}

type RemoteKitchen = {
  maker: MakerProfile;
  ownerPhone: string | null;
  items: MenuItem[];
  componentsByMenuId: Record<Uuid, ThaliComponent[]>;
};

/** Load kitchen + full menu from Supabase and mirror into local cache. */
async function pullKitchenFromSupabase(
  makerIdOrPhone: { makerId?: Uuid; phone?: string },
): Promise<RemoteKitchen | null> {
  if (!isSupabaseConfigured) return null;

  let makerRow: (MakerProfile & { owner_phone?: string | null }) | null = null;

  if (makerIdOrPhone.makerId) {
    const { data, error } = await supabase
      .from('maker_profiles')
      .select('*')
      .eq('id', makerIdOrPhone.makerId)
      .maybeSingle();
    if (error) {
      logger.warn('pullKitchenFromSupabase maker by id failed', error);
      return null;
    }
    makerRow = data as (MakerProfile & { owner_phone?: string | null }) | null;
  } else if (makerIdOrPhone.phone) {
    const phoneResult = toE164India(makerIdOrPhone.phone);
    if (!phoneResult.ok) return null;
    const { data, error } = await supabase
      .from('maker_profiles')
      .select('*')
      .eq('owner_phone', phoneResult.data)
      .maybeSingle();
    if (error) {
      logger.warn('pullKitchenFromSupabase maker by phone failed', error);
      return null;
    }
    makerRow = data as (MakerProfile & { owner_phone?: string | null }) | null;
  }

  if (!makerRow) return null;

  const maker = normalizeMaker(makerRow);
  const ownerPhone = makerRow.owner_phone ?? makerIdOrPhone.phone ?? null;

  const { data: menuRows, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
    .eq('maker_id', maker.id)
    .order('created_at', { ascending: true });

  if (menuError) {
    logger.warn('pullKitchenFromSupabase menu failed', menuError);
    return null;
  }

  const items = ((menuRows ?? []) as MenuItem[]).map(normalizeMenuItem);
  const componentsByMenuId: Record<Uuid, ThaliComponent[]> = {};

  if (items.length > 0) {
    const { data: componentRows, error: componentError } = await supabase
      .from('thali_components')
      .select('*')
      .in(
        'menu_item_id',
        items.map((item) => item.id),
      )
      .order('sort_order', { ascending: true });

    if (componentError) {
      logger.warn('pullKitchenFromSupabase components failed', componentError);
    } else {
      for (const raw of (componentRows ?? []) as ThaliComponent[]) {
        const component = normalizeComponent(raw);
        const list = componentsByMenuId[component.menu_item_id] ?? [];
        list.push(component);
        componentsByMenuId[component.menu_item_id] = list;
      }
    }
  }

  for (const item of items) {
    if (!componentsByMenuId[item.id]) componentsByMenuId[item.id] = [];
  }

  await replaceMakerKitchenFromRemote({
    maker,
    ownerPhone,
    items,
    componentsByMenuId,
  });

  return { maker, ownerPhone, items, componentsByMenuId };
}

export async function submitChefApplication(input: {
  fullName: string;
  phone: string;
  city: string;
  cuisineExperience: string;
  message?: string;
}): Promise<Result<{ id: string }>> {
  const full_name = input.fullName.trim();
  const city = input.city.trim();
  const cuisine_experience = input.cuisineExperience.trim();
  if (!full_name || !city || !cuisine_experience) {
    return err('VALIDATION', 'Name, city, and cuisine experience are required');
  }

  const phoneResult = toE164India(input.phone);
  if (!phoneResult.ok) return phoneResult;

  const application: ChefApplication = {
    id: crypto.randomUUID(),
    full_name,
    phone: phoneResult.data,
    city,
    cuisine_experience,
    message: input.message?.trim() || null,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('chef_applications')
      .insert({
        full_name,
        phone: phoneResult.data,
        city,
        cuisine_experience,
        message: application.message,
        status: 'new',
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('submitChefApplication failed', error);
      return err('UNKNOWN', error?.message ?? 'Could not submit application', error);
    }
    application.id = data.id as string;
  }

  await addChefApplication(application);
  return ok({ id: application.id });
}

export async function fetchChefApplicationForPhone(
  phone: string,
): Promise<Result<ChefApplication | null>> {
  const phoneResult = toE164India(phone);
  if (!phoneResult.ok) return phoneResult;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('chef_applications')
      .select('*')
      .eq('phone', phoneResult.data)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('fetchChefApplicationForPhone remote failed', error);
      return err(
        'UNKNOWN',
        error.message || "Couldn't load application status — check connection and try again",
        error,
      );
    }

    if (data) {
      const remote = data as ChefApplication;
      await addChefApplication(remote);
      const [enriched] = await attachActivationErrors([remote]);
      return ok(enriched ?? remote);
    }
    return ok(null);
  }

  const application = await getChefApplicationByPhone(phoneResult.data);
  return ok(application);
}

export async function fetchMakerForCurrentPhone(
  phone: string | undefined,
): Promise<Result<MakerProfile | null>> {
  if (!phone) return ok(null);

  const remote = await pullKitchenFromSupabase({ phone });
  if (remote) return ok(remote.maker);

  const maker = await getMakerForPhone(phone);
  return ok(maker);
}

/** Seed local cache when the application only exists in Supabase. */
async function ensureLocalApplication(applicationId: Uuid): Promise<void> {
  const existing = (await listChefApplications()).find((a) => a.id === applicationId);
  if (existing) return;

  if (!isSupabaseConfigured) throw new Error('Application not found');

  const { data, error } = await supabase
    .from('chef_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !data) throw new Error('Application not found');
  await addChefApplication(data as ChefApplication);
}

async function syncApplicationStatusRemote(
  applicationId: Uuid,
  status: ChefApplication['status'],
): Promise<Result<true>> {
  if (!isSupabaseConfigured) return ok(true);
  const { error } = await supabase.rpc('set_chef_application_status', {
    p_id: applicationId,
    p_status: status,
  });
  if (error) {
    logger.error('syncApplicationStatusRemote failed', error);
    return err(
      'UNKNOWN',
      error.message || "Couldn't update application — check connection and try again",
      error,
    );
  }
  return ok(true);
}

export async function listPendingApplications(): Promise<Result<ChefApplication[]>> {
  const { adminListApplications } = await import('./admin');
  const all = await adminListApplications();
  if (!all.ok) return all;
  return ok(all.data.filter((a) => a.status === 'new' || a.status === 'reviewing'));
}

export async function listAllApplications(): Promise<Result<ChefApplication[]>> {
  const { adminListApplications } = await import('./admin');
  return adminListApplications();
}

export async function acceptApplication(applicationId: Uuid): Promise<Result<MakerProfile>> {
  try {
    await ensureLocalApplication(applicationId);
    const maker = await approveChefApplication(applicationId);
    const phone = await getPhoneForMaker(maker.id);
    const publish = await publishKitchenAfterApproval(maker, phone, applicationId);
    if (!publish.ok) return publish;
    await clearApplicationActivationError(applicationId);
    return ok(maker);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not approve', cause);
  }
}

/**
 * Re-run kitchen publish after a partial approval failure.
 * Does not recreate the application — activates the existing linked kitchen.
 */
export async function retryKitchenActivation(
  applicationId: Uuid,
): Promise<Result<MakerProfile>> {
  try {
    await ensureLocalApplication(applicationId);
    const applications = await listChefApplications();
    const application = applications.find((a) => a.id === applicationId);
    if (!application) return err('NOT_FOUND', 'Application not found');

    let maker = await getMakerForPhone(application.phone);
    if (!maker) {
      maker = await approveChefApplication(applicationId);
    }

    // Ensure we attempt publish with an active flag for Discover.
    maker = await updateMakerProfile(maker.id, { is_active: true, is_open: true });
    const phone = await getPhoneForMaker(maker.id);
    const publish = await publishKitchenAfterApproval(maker, phone, applicationId);
    if (!publish.ok) return publish;
    await clearApplicationActivationError(applicationId);
    return ok(maker);
  } catch (cause) {
    return err(
      'UNKNOWN',
      cause instanceof Error ? cause.message : 'Could not retry kitchen activation',
      cause,
    );
  }
}

async function publishKitchenAfterApproval(
  maker: MakerProfile,
  phone: string | null,
  applicationId: Uuid,
): Promise<Result<MakerProfile>> {
  const fail = async (result: Result<unknown>): Promise<Result<MakerProfile>> => {
    const message = !result.ok
      ? result.error.message
      : "Couldn't activate kitchen — check connection and try again";
    await updateMakerProfile(maker.id, { is_active: false, is_open: false });
    await setApplicationActivationError(
      applicationId,
      message || "Approved, but kitchen activation failed — retry needed",
    );
    return err(
      'UNKNOWN',
      message || "Approved, but kitchen activation failed — retry needed",
      !result.ok ? result.error.cause : undefined,
    );
  };

  const synced = await syncMakerToSupabase(maker, phone);
  if (!synced.ok) return fail(synced);

  const menuSynced = await syncKitchenMenuToSupabase(maker.id);
  if (!menuSynced.ok) return fail(menuSynced);

  const statusSynced = await syncApplicationStatusRemote(applicationId, 'accepted');
  if (!statusSynced.ok) return fail(statusSynced);

  return ok(maker);
}

export async function declineApplication(applicationId: Uuid): Promise<Result<void>> {
  try {
    await ensureLocalApplication(applicationId);
    const statusSynced = await syncApplicationStatusRemote(applicationId, 'rejected');
    if (!statusSynced.ok) return statusSynced;
    await rejectChefApplication(applicationId);
    return ok(undefined);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not reject', cause);
  }
}

export async function fetchCommunityMakers(): Promise<Result<MakerProfile[]>> {
  return ok(await listActiveMakers());
}

export async function fetchCommunityMaker(param: string): Promise<Result<MakerProfile>> {
  const maker = await resolveMakerParam(param);
  if (!maker) return err('NOT_FOUND', 'Kitchen not found');
  return ok(maker);
}

export async function fetchCommunityMenu(makerId: Uuid): Promise<Result<MenuItem[]>> {
  return ok(await listMenuItemsForMaker(makerId));
}

/** Chef dashboard — all items including hidden ones (Supabase is source of truth). */
export async function fetchChefMenu(makerId: Uuid): Promise<Result<MenuItem[]>> {
  const remote = await pullKitchenFromSupabase({ makerId });
  if (remote) return ok(remote.items);
  return ok(await listAllMenuItemsForMaker(makerId));
}

export async function fetchCommunityMenuItem(
  menuItemId: Uuid,
): Promise<Result<{ menuItem: MenuItem; components: ThaliComponent[] }>> {
  const bundle = await getMenuItemBundle(menuItemId);
  if (!bundle) return err('NOT_FOUND', 'Menu item not found');
  return ok(bundle);
}

async function syncMakerToSupabase(
  maker: MakerProfile,
  ownerPhone: string | null,
): Promise<Result<true>> {
  if (!isSupabaseConfigured) return ok(true);

  const { error } = await supabase.rpc('upsert_maker_profile', {
    payload: {
      id: maker.id,
      owner_phone: ownerPhone,
      display_name: maker.display_name,
      kitchen_name: maker.kitchen_name,
      bio: maker.bio,
      photo_url: maker.photo_url,
      cover_url: maker.cover_url ?? null,
      kitchen_address: maker.kitchen_address ?? null,
      lat: maker.lat ?? null,
      lng: maker.lng ?? null,
      tier: maker.tier,
      cuisine_tags: maker.cuisine_tags,
      rating_avg: maker.rating_avg,
      rating_count: maker.rating_count,
      is_active: maker.is_active,
      is_open: maker.is_open ?? true,
    },
  });

  if (error) {
    logger.error('syncMakerToSupabase failed', error);
    return err('UNKNOWN', error.message || 'Could not sync kitchen to Discover', error);
  }
  return ok(true);
}

async function syncMenuItemToSupabase(item: MenuItem): Promise<Result<true>> {
  if (!isSupabaseConfigured) return ok(true);

  const { error } = await supabase.rpc('upsert_menu_item', {
    payload: {
      id: item.id,
      maker_id: item.maker_id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      base_price: item.base_price,
      meal_slot: item.meal_slot,
      is_available: item.is_available,
      has_jain_variant: item.has_jain_variant,
    },
  });

  if (error) {
    logger.error('syncMenuItemToSupabase failed', error);
    return err(
      'UNKNOWN',
      error.message || "Couldn't save — check connection and try again",
      error,
    );
  }
  return ok(true);
}

async function syncThaliComponentToSupabase(component: ThaliComponent): Promise<Result<true>> {
  if (!isSupabaseConfigured) return ok(true);

  const { error } = await supabase.rpc('upsert_thali_component', {
    payload: {
      id: component.id,
      menu_item_id: component.menu_item_id,
      name: component.name,
      serving_amount: component.serving_amount,
      serving_unit: component.serving_unit,
      component_type: component.component_type ?? 'included',
      included_qty: component.included_qty,
      min_qty: component.min_qty,
      max_qty: component.max_qty,
      unit_price_delta: component.unit_price_delta,
      has_jain_variant: component.has_jain_variant,
      jain_substitute: component.jain_substitute,
      sort_order: component.sort_order,
    },
  });

  if (error) {
    logger.error('syncThaliComponentToSupabase failed', error);
    return err(
      'UNKNOWN',
      error.message || "Couldn't save — check connection and try again",
      error,
    );
  }
  return ok(true);
}

async function syncKitchenMenuToSupabase(makerId: Uuid): Promise<Result<true>> {
  if (!isSupabaseConfigured) return ok(true);
  const items = await listAllMenuItemsForMaker(makerId);
  for (const item of items) {
    const itemSynced = await syncMenuItemToSupabase(item);
    if (!itemSynced.ok) return itemSynced;
    const components = await listThaliComponents(makerId, item.id);
    const { error } = await supabase.rpc('replace_menu_components', {
      p_menu_item_id: item.id,
      p_components: components.map((component) => ({
        id: component.id,
        name: component.name,
        serving_amount: component.serving_amount,
        serving_unit: component.serving_unit,
        component_type: component.component_type ?? 'included',
        included_qty: component.included_qty,
        min_qty: component.min_qty,
        max_qty: component.max_qty,
        unit_price_delta: component.unit_price_delta,
        has_jain_variant: component.has_jain_variant,
        jain_substitute: component.jain_substitute,
        sort_order: component.sort_order,
      })),
    });
    if (error) {
      logger.error('replace_menu_components failed', error);
      for (const component of components) {
        const componentSynced = await syncThaliComponentToSupabase(component);
        if (!componentSynced.ok) return componentSynced;
      }
    }
  }
  return ok(true);
}

/** Pull remote kitchen into local cache, then push any local-only rows up. */
export async function ensureMakerSyncedToSupabase(
  maker: MakerProfile,
  ownerPhone?: string | null,
): Promise<Result<MakerProfile>> {
  const phone = ownerPhone ?? (await getPhoneForMaker(maker.id));

  // Prefer what customers already see on Discover.
  const remote = await pullKitchenFromSupabase({
    makerId: maker.id,
    ...(phone ? { phone } : {}),
  });
  if (remote && remote.items.length > 0) {
    return ok(remote.maker);
  }

  // New / local-only kitchen — publish to Supabase.
  const synced = await syncMakerToSupabase(maker, phone);
  if (!synced.ok) return synced;
  const menuSynced = await syncKitchenMenuToSupabase(maker.id);
  if (!menuSynced.ok) return menuSynced;
  return ok(maker);
}

export async function saveMakerKitchen(
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
): Promise<Result<MakerProfile>> {
  try {
    const nextPatch = { ...patch };

    if (nextPatch.photo_url !== undefined) {
      const photo = await persistImageUrl(nextPatch.photo_url);
      if (!photo.ok) return photo;
      nextPatch.photo_url = photo.data;
    }
    if (nextPatch.cover_url !== undefined) {
      const cover = await persistImageUrl(nextPatch.cover_url);
      if (!cover.ok) return cover;
      nextPatch.cover_url = cover.data;
    }

    const before =
      (await getMakerById(makerId)) ?? (await pullKitchenFromSupabase({ makerId }))?.maker;
    const previousSnapshot = before
      ? {
          kitchen_name: before.kitchen_name,
          bio: before.bio,
          is_active: before.is_active,
          is_open: before.is_open,
          cuisine_tags: before.cuisine_tags,
          photo_url: before.photo_url,
          cover_url: before.cover_url,
          kitchen_address: before.kitchen_address,
          lat: before.lat,
          lng: before.lng,
        }
      : null;

    const maker = await updateMakerProfile(makerId, nextPatch);
    const phone = await getPhoneForMaker(makerId);
    const synced = await syncMakerToSupabase(maker, phone);
    if (!synced.ok) {
      if (previousSnapshot) {
        await updateMakerProfile(makerId, previousSnapshot);
      }
      return synced;
    }
    return ok(maker);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not update kitchen', cause);
  }
}

export async function saveMenuItem(
  makerId: Uuid,
  menuItemId: Uuid,
  patch: Partial<Pick<MenuItem, 'name' | 'description' | 'base_price' | 'is_available' | 'meal_slot' | 'has_jain_variant' | 'image_url'>>,
): Promise<Result<MenuItem>> {
  try {
    // Ensure local row exists (items may have been pulled from Supabase only).
    const existing = await listAllMenuItemsForMaker(makerId);
    if (!existing.some((item) => item.id === menuItemId)) {
      const remote = await pullKitchenFromSupabase({ makerId });
      if (!remote || !remote.items.some((item) => item.id === menuItemId)) {
        return err('NOT_FOUND', 'Menu item not found');
      }
    }
    const nextPatch = { ...patch };
    if (nextPatch.image_url !== undefined) {
      const image = await persistImageUrl(nextPatch.image_url);
      if (!image.ok) return image;
      nextPatch.image_url = image.data;
    }

    const before =
      (await listAllMenuItemsForMaker(makerId)).find((item) => item.id === menuItemId) ?? null;
    if (!before) return err('NOT_FOUND', 'Menu item not found');

    const item = await updateMenuItem(makerId, menuItemId, nextPatch);
    if (isSupabaseConfigured) {
      const synced = await syncMenuItemToSupabase(item);
      if (!synced.ok) {
        await updateMenuItem(makerId, menuItemId, {
          name: before.name,
          description: before.description,
          base_price: before.base_price,
          is_available: before.is_available,
          meal_slot: before.meal_slot,
          has_jain_variant: before.has_jain_variant,
          image_url: before.image_url,
        });
        return synced;
      }
    }
    return ok(item);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not update menu', cause);
  }
}

export async function createCommunityMenuItem(
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
    components?: ThaliComponentInput[];
  },
): Promise<Result<MenuItem>> {
  const name = input.name.trim();
  if (!name) return err('VALIDATION', 'Item name is required');
  if (!Number.isFinite(input.base_price) || input.base_price <= 0) {
    return err('VALIDATION', 'Enter a valid price');
  }
  if (input.enable_customization !== false && input.components && input.components.length === 0) {
    return err('VALIDATION', 'Add at least one component or turn off customization');
  }
  try {
    const image = await persistImageUrl(input.image_url);
    if (!image.ok) return image;

    const item = await addMenuItem(makerId, {
      ...input,
      image_url: image.data,
      is_available: input.is_available ?? true,
      enable_customization: input.enable_customization ?? true,
      components: input.components,
    });
    const itemSynced = await syncMenuItemToSupabase(item);
    if (!itemSynced.ok) {
      await deleteMenuItem(makerId, item.id);
      return itemSynced;
    }
    const components = await listThaliComponents(makerId, item.id);
    for (const component of components) {
      const componentSynced = await syncThaliComponentToSupabase(component);
      if (!componentSynced.ok) {
        if (isSupabaseConfigured) {
          await supabase.rpc('delete_menu_item', { p_menu_item_id: item.id });
        }
        await deleteMenuItem(makerId, item.id);
        return componentSynced;
      }
    }
    return ok(item);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not add thali', cause);
  }
}

export async function removeCommunityMenuItem(
  makerId: Uuid,
  menuItemId: Uuid,
): Promise<Result<void>> {
  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('delete_menu_item', {
        p_menu_item_id: menuItemId,
      });
      if (error) {
        logger.error('removeCommunityMenuItem rpc failed', error);
        return err('UNKNOWN', error.message || 'Could not delete item from kitchen', error);
      }
    }
    await deleteMenuItem(makerId, menuItemId);
    return ok(undefined);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not remove menu item', cause);
  }
}

export async function fetchChefThaliComponents(
  makerId: Uuid,
  menuItemId: Uuid,
): Promise<Result<ThaliComponent[]>> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('thali_components')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      return ok((data as ThaliComponent[]).map(normalizeComponent));
    }
    if (error) logger.warn('fetchChefThaliComponents failed', error);
  }
  return ok(await listThaliComponents(makerId, menuItemId));
}

export async function createThaliComponent(
  makerId: Uuid,
  menuItemId: Uuid,
  input: {
    name: string;
    serving_amount?: number;
    serving_unit?: ThaliComponent['serving_unit'];
    included_qty?: number;
    min_qty?: number;
    max_qty?: number;
    unit_price_delta?: number;
    has_jain_variant?: boolean;
    jain_substitute?: string | null;
    component_type?: ThaliComponent['component_type'];
  },
): Promise<Result<ThaliComponent>> {
  if (!input.name.trim()) return err('VALIDATION', 'Dish name is required');
  try {
    // Prefer remote list so local cache isn't missing existing dishes.
    if (isSupabaseConfigured) {
      const remote = await fetchChefThaliComponents(makerId, menuItemId);
      if (remote.ok) {
        await syncLocalComponents(makerId, menuItemId, remote.data);
        const nameKey = input.name.trim().toLowerCase();
        const existingRemote = remote.data.find(
          (c) => c.name.trim().toLowerCase() === nameKey,
        );
        if (existingRemote) return ok(existingRemote);
      }
    }
    const component = await addThaliComponent(makerId, menuItemId, input);
    const synced = await syncThaliComponentToSupabase(component);
    if (!synced.ok) {
      await deleteThaliComponent(makerId, menuItemId, component.id);
      return synced;
    }
    return ok(component);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not add dish', cause);
  }
}

export async function saveThaliComponent(
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
      | 'component_type'
    >
  >,
): Promise<Result<ThaliComponent>> {
  try {
    if (isSupabaseConfigured) {
      const remote = await fetchChefThaliComponents(makerId, menuItemId);
      if (remote.ok) {
        await syncLocalComponents(makerId, menuItemId, remote.data);
      }
    }
    const beforeList = await listThaliComponents(makerId, menuItemId);
    const before = beforeList.find((c) => c.id === componentId) ?? null;
    if (!before) return err('NOT_FOUND', 'Component not found');

    const component = await updateThaliComponent(makerId, menuItemId, componentId, patch);
    const synced = await syncThaliComponentToSupabase(component);
    if (!synced.ok) {
      await updateThaliComponent(makerId, menuItemId, componentId, {
        name: before.name,
        serving_amount: before.serving_amount,
        serving_unit: before.serving_unit,
        included_qty: before.included_qty,
        min_qty: before.min_qty,
        max_qty: before.max_qty,
        unit_price_delta: before.unit_price_delta,
        has_jain_variant: before.has_jain_variant,
        jain_substitute: before.jain_substitute,
        component_type: before.component_type,
      });
      return synced;
    }
    return ok(component);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not update dish', cause);
  }
}

export async function removeThaliComponent(
  makerId: Uuid,
  menuItemId: Uuid,
  componentId: Uuid,
): Promise<Result<void>> {
  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('delete_thali_component', {
        p_component_id: componentId,
      });
      if (error) {
        logger.error('removeThaliComponent rpc failed', error);
        return err('UNKNOWN', error.message || 'Could not delete dish from kitchen', error);
      }
    }
    await deleteThaliComponent(makerId, menuItemId, componentId);
    return ok(undefined);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not remove dish', cause);
  }
}

export async function makerPublicSlug(makerId: Uuid): Promise<string> {
  return (await slugForMaker(makerId)) ?? makerId;
}

export type { ChefApplication };
