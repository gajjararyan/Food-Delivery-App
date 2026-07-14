import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Uuid } from '../types';
import { logger } from '../logger';

const STORAGE_KEY = 'gharkaswad_chef_role_verified_v1';

/**
 * How long a successful remote chef confirmation may be reused when the
 * network is down. 24h: covers a full service day offline without letting a
 * revoked chef keep access for days/weeks on a flaky connection.
 */
export const CHEF_ROLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ChefRoleVerification = {
  makerId: Uuid;
  verifiedAt: number;
};

type Store = Record<string, ChefRoleVerification>;

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch (cause) {
    logger.warn('chef role cache read failed', cause);
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (cause) {
    logger.warn('chef role cache write failed', cause);
  }
}

export async function rememberChefRoleVerification(
  phone: string,
  makerId: Uuid,
  now = Date.now(),
): Promise<void> {
  const store = await readStore();
  store[phone] = { makerId, verifiedAt: now };
  await writeStore(store);
}

export async function clearChefRoleVerification(phone: string): Promise<void> {
  const store = await readStore();
  if (!(phone in store)) return;
  delete store[phone];
  await writeStore(store);
}

export async function getChefRoleVerification(
  phone: string,
): Promise<ChefRoleVerification | null> {
  const store = await readStore();
  return store[phone] ?? null;
}

/** True when cached verification is still within the offline grace window. */
export function isChefRoleVerificationFresh(
  verification: ChefRoleVerification | null,
  now = Date.now(),
  ttlMs = CHEF_ROLE_CACHE_TTL_MS,
): boolean {
  if (!verification) return false;
  return now - verification.verifiedAt <= ttlMs;
}

/**
 * Offline fallback: only return makerId when the last remote confirmation is fresh.
 */
export function makerIdFromFreshChefCache(
  verification: ChefRoleVerification | null,
  now = Date.now(),
  ttlMs = CHEF_ROLE_CACHE_TTL_MS,
): Uuid | null {
  if (!isChefRoleVerificationFresh(verification, now, ttlMs)) return null;
  return verification!.makerId;
}
