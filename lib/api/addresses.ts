import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedAddress, Uuid } from '../types';
import { err, ok, type Result } from '../result';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';
import { coordsNear } from '../maps/formatLocation';

const ADDRESSES_STORAGE_KEY = 'gharkaswad_addresses_v1';
const MEMORY_ADDRESSES = new Map<string, SavedAddress>();
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (isSupabaseConfigured) {
    hydrated = true;
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(ADDRESSES_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as SavedAddress[];
      for (const a of list) MEMORY_ADDRESSES.set(a.id, a);
    }
  } catch (cause) {
    logger.warn('addresses hydrate failed', cause);
  }
  hydrated = true;
}

async function persist(): Promise<void> {
  if (isSupabaseConfigured) return;
  try {
    await AsyncStorage.setItem(
      ADDRESSES_STORAGE_KEY,
      JSON.stringify([...MEMORY_ADDRESSES.values()]),
    );
  } catch (cause) {
    logger.warn('addresses persist failed', cause);
  }
}

export async function listAddresses(customerId: Uuid): Promise<Result<SavedAddress[]>> {
  if (!customerId) return ok([]);
  await hydrate();

  if (!isSupabaseConfigured) {
    const list = [...MEMORY_ADDRESSES.values()]
      .filter((a) => a.customer_id === customerId)
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
    return ok(list);
  }

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listAddresses failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok((data ?? []) as SavedAddress[]);
}

/** Reuse an existing pin when the user drops within ~50 m (avoids duplicate rows). */
export async function findAddressNear(
  customerId: Uuid,
  lat: number,
  lng: number,
): Promise<Result<SavedAddress | null>> {
  const list = await listAddresses(customerId);
  if (!list.ok) return list;
  const hit = list.data.find((a) => coordsNear(a, { lat, lng }));
  return ok(hit ?? null);
}

export async function createAddress(params: {
  customerId: Uuid;
  label: string;
  lat: number;
  lng: number;
  formattedHint?: string | null;
  isDefault?: boolean;
}): Promise<Result<SavedAddress>> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured) {
    await hydrate();
    if (params.isDefault) {
      for (const a of MEMORY_ADDRESSES.values()) {
        if (a.customer_id === params.customerId) a.is_default = false;
      }
    }
    const row: SavedAddress = {
      id: crypto.randomUUID(),
      customer_id: params.customerId,
      label: params.label,
      lat: params.lat,
      lng: params.lng,
      formatted_hint: params.formattedHint ?? null,
      is_default: params.isDefault ?? false,
      created_at: now,
      updated_at: now,
    };
    MEMORY_ADDRESSES.set(row.id, row);
    await persist();
    return ok(row);
  }

  if (params.isDefault) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', params.customerId);
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      customer_id: params.customerId,
      label: params.label,
      lat: params.lat,
      lng: params.lng,
      formatted_hint: params.formattedHint ?? null,
      is_default: params.isDefault ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    logger.error('createAddress failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not save address', error);
  }
  return ok(data as SavedAddress);
}

export async function updateAddress(
  id: Uuid,
  customerId: Uuid,
  patch: Partial<Pick<SavedAddress, 'label' | 'lat' | 'lng' | 'formatted_hint'>>,
): Promise<Result<SavedAddress>> {
  if (!isSupabaseConfigured) {
    await hydrate();
    const existing = MEMORY_ADDRESSES.get(id);
    if (!existing || existing.customer_id !== customerId) {
      return err('NOT_FOUND', 'Address not found');
    }
    const updated: SavedAddress = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    MEMORY_ADDRESSES.set(id, updated);
    await persist();
    return ok(updated);
  }

  const { data, error } = await supabase
    .from('addresses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('customer_id', customerId)
    .select('*')
    .single();

  if (error || !data) {
    logger.error('updateAddress failed', error);
    return err('UNKNOWN', error?.message ?? 'Could not update address', error);
  }
  return ok(data as SavedAddress);
}

export async function deleteAddress(id: Uuid, customerId: Uuid): Promise<Result<null>> {
  if (!isSupabaseConfigured) {
    await hydrate();
    MEMORY_ADDRESSES.delete(id);
    await persist();
    return ok(null);
  }

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('customer_id', customerId);

  if (error) {
    logger.error('deleteAddress failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok(null);
}

export async function setDefaultAddress(id: Uuid, customerId: Uuid): Promise<Result<null>> {
  if (!isSupabaseConfigured) {
    await hydrate();
    for (const a of MEMORY_ADDRESSES.values()) {
      if (a.customer_id === customerId) a.is_default = a.id === id;
    }
    await persist();
    return ok(null);
  }

  await supabase.from('addresses').update({ is_default: false }).eq('customer_id', customerId);
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('customer_id', customerId);

  if (error) {
    logger.error('setDefaultAddress failed', error);
    return err('UNKNOWN', error.message, error);
  }
  return ok(null);
}