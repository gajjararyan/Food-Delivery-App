import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from './types';

/** Legacy dev user id for +917043156067 (customer test account). */
export const DEV_USER_ID = 'a7043156-0670-4000-8000-000000000001';

export const DEV_OTP = process.env.EXPO_PUBLIC_DEV_OTP ?? '654321';

const DEV_SESSION_KEY = 'gharkaswad_dev_session';
const DEV_PROFILE_KEY = 'gharkaswad_dev_profile';

export type DevProfileOverrides = {
  full_name?: string;
  email?: string | null;
};

const DEV_USER_PREFIX = '00000000-0000-4000-8000-';

const PLACEHOLDER_MARKERS = [
  'YOUR_PROJECT',
  'your-anon-key',
  'your-service-role-key',
  'placeholder',
] as const;

export function isPlaceholderEnv(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

export function isDevAuthEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_DEV_AUTH === 'true') return true;
  if (process.env.EXPO_PUBLIC_DEV_AUTH === 'false') return false;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return isPlaceholderEnv(url) || isPlaceholderEnv(key);
}

export function devUserIdForPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '').slice(-10);
  if (digits === '7043156067') return DEV_USER_ID;
  const tail = digits.padStart(12, '0');
  return `${DEV_USER_PREFIX}${tail}`;
}

export function isDevAuthUser(userId: string): boolean {
  return userId === DEV_USER_ID || userId.startsWith(DEV_USER_PREFIX);
}

export function createDevSession(
  phoneE164: string,
  signup?: DevProfileOverrides,
): { session: Session; user: User } {
  const userId = devUserIdForPhone(phoneE164);
  const fullName = signup?.full_name?.trim() || 'Test User';
  const email = signup?.email?.trim() || null;
  const user = {
    id: userId,
    phone: phoneE164,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: { roles: ['customer'] },
    user_metadata: { phone: phoneE164, full_name: fullName, email },
  } as User;

  const session = {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  } as Session;

  return { session, user };
}

export function createDevProfile(phoneE164: string, signup?: DevProfileOverrides): Profile {
  const now = new Date().toISOString();
  return {
    id: devUserIdForPhone(phoneE164),
    phone: phoneE164,
    full_name: signup?.full_name?.trim() || 'Test User',
    email: signup?.email?.trim() || null,
    avatar_url: null,
    jain_preference: false,
    created_at: now,
    updated_at: now,
  };
}

export async function saveDevProfile(
  userId: string,
  overrides: DevProfileOverrides,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DEV_PROFILE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, DevProfileOverrides>) : {};
    map[userId] = { ...map[userId], ...overrides };
    await AsyncStorage.setItem(DEV_PROFILE_KEY, JSON.stringify(map));
  } catch {
    await AsyncStorage.setItem(DEV_PROFILE_KEY, JSON.stringify({ [userId]: overrides }));
  }
}

/** Per-user dev profile overrides persisted across sessions. */
export async function loadDevProfileOverrides(
  userId: string,
): Promise<DevProfileOverrides | null> {
  try {
    const raw = await AsyncStorage.getItem(DEV_PROFILE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, DevProfileOverrides>;
    return map[userId] ?? null;
  } catch {
    return null;
  }
}

export async function saveDevSession(session: Session): Promise<void> {
  await AsyncStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
}

export async function loadDevSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function clearDevSession(): Promise<void> {
  await AsyncStorage.removeItem(DEV_SESSION_KEY);
}
