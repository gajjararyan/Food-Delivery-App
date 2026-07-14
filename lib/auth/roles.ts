import type { Uuid } from '../types';
import { getMakerForPhone } from '../marketplace/localStore';
import { ADMIN_TEST_PHONE_E164, toE164India } from '../phone';
import { isSupabaseConfigured, supabase } from '../supabase';
import { logger } from '../logger';
import {
  clearChefRoleVerification,
  makerIdFromFreshChefCache,
  getChefRoleVerification,
  rememberChefRoleVerification,
} from './chefRoleCache';

export type AppRole = 'customer' | 'chef' | 'admin';

export type UserAccess = {
  /** Single primary role (admin > chef > customer). */
  roles: AppRole[];
  makerId: Uuid | null;
  isAdmin: boolean;
  isChef: boolean;
  /** True for anyone who can order food (all non-admin accounts). */
  isCustomer: boolean;
  /**
   * Set when chef access was denied because the offline cache is older than the TTL
   * and remote verification could not run.
   */
  chefAccessNeedsReconnect?: boolean;
};

function primaryRole(isAdmin: boolean, isChef: boolean): AppRole {
  if (isAdmin) return 'admin';
  if (isChef) return 'chef';
  return 'customer';
}

/** Default admin — only this reserved number (override via EXPO_PUBLIC_ADMIN_PHONES). */
const DEFAULT_ADMIN_PHONES = [ADMIN_TEST_PHONE_E164];

/** Phones allowed to access admin panel (comma-separated E.164). */
export function getAdminPhones(): string[] {
  const fromEnv = (process.env.EXPO_PUBLIC_ADMIN_PHONES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return DEFAULT_ADMIN_PHONES;
}

export function isAdminPhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  return getAdminPhones().includes(phone);
}

/**
 * Resolve whether this phone owns an active kitchen.
 * Remote maker_profiles is source of truth when reachable.
 * On network error, only a fresh (≤24h) local verification may grant chef.
 */
async function resolveActiveMakerId(
  phone: string,
): Promise<{ makerId: Uuid | null; chefAccessNeedsReconnect: boolean }> {
  if (isSupabaseConfigured) {
    const phoneResult = toE164India(phone);
    if (!phoneResult.ok) return { makerId: null, chefAccessNeedsReconnect: false };

    const { data, error } = await supabase
      .from('maker_profiles')
      .select('id, is_active, owner_phone')
      .eq('owner_phone', phoneResult.data)
      .maybeSingle();

    if (!error) {
      if (data?.is_active) {
        const makerId = String(data.id);
        await rememberChefRoleVerification(phoneResult.data, makerId);
        return { makerId, chefAccessNeedsReconnect: false };
      }
      // Confirmed remote: not an active chef — drop any stale grant.
      await clearChefRoleVerification(phoneResult.data);
      return { makerId: null, chefAccessNeedsReconnect: false };
    }

    logger.warn('resolveActiveMakerId remote lookup failed; checking fresh cache', error);
    const cached = await getChefRoleVerification(phoneResult.data);
    const freshMakerId = makerIdFromFreshChefCache(cached);
    if (freshMakerId) {
      return { makerId: freshMakerId, chefAccessNeedsReconnect: false };
    }
    // Stale or missing cache under network error — do not grant chef.
    return {
      makerId: null,
      chefAccessNeedsReconnect: Boolean(cached),
    };
  }

  const local = await getMakerForPhone(phone);
  return {
    makerId: local?.is_active ? local.id : null,
    chefAccessNeedsReconnect: false,
  };
}

export async function resolveUserAccess(phone: string | undefined | null): Promise<UserAccess> {
  if (!phone) {
    return { roles: [], makerId: null, isAdmin: false, isChef: false, isCustomer: false };
  }

  // Admin-only account: no customer/chef roles on the reserved admin phone.
  if (isAdminPhone(phone)) {
    return {
      roles: ['admin'],
      makerId: null,
      isAdmin: true,
      isChef: false,
      isCustomer: false,
    };
  }

  const { makerId, chefAccessNeedsReconnect } = await resolveActiveMakerId(phone);
  const isChef = Boolean(makerId);
  const role = primaryRole(false, isChef);

  // Keep local marketplace cache warm for chef screens after a remote hit.
  if (isChef && isSupabaseConfigured) {
    void import('../api/chefs').then(({ fetchMakerForCurrentPhone }) =>
      fetchMakerForCurrentPhone(phone),
    );
  }

  return {
    roles: [role],
    makerId,
    isAdmin: false,
    isChef,
    isCustomer: true,
    chefAccessNeedsReconnect,
  };
}

export function canAccessAdmin(access: UserAccess): boolean {
  return access.isAdmin;
}

export function canAccessChef(access: UserAccess): boolean {
  return access.isChef;
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'chef':
      return 'Home chef';
    case 'customer':
      return 'Customer';
  }
}
