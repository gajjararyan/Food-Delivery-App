import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types';
import { err, ok, type Result } from '../result';
import { logger } from '../logger';
import { toE164India } from '../phone';
import { isAdminPhone } from '../auth/roles';
import { isSupabaseConfigured, supabase } from '../supabase';
import {
  createDevProfile,
  createDevSession,
  DEV_OTP,
  devUserIdForPhone,
  isDevAuthEnabled,
  isDevAuthUser,
  loadDevProfileOverrides,
  saveDevProfile,
} from '../devAuth';

export { formatDisplayPhone, toE164India } from '../phone';

export type SignupDetails = {
  fullName: string;
  email: string;
};

export function validateSignupDetails(input: SignupDetails): Result<SignupDetails> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (!fullName) {
    return err('VALIDATION', 'Enter your name');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('VALIDATION', 'Enter a valid email address');
  }
  return ok({ fullName, email });
}

/** True when this phone completed sign-up (name + email on file). Admin is always allowed to sign in. */
export async function accountRegisteredForPhone(phoneInput: string): Promise<Result<boolean>> {
  const normalized = toE164India(phoneInput);
  if (!normalized.ok) return normalized;

  if (isAdminPhone(normalized.data)) {
    return ok(true);
  }

  if (isDevAuthEnabled()) {
    const overrides = await loadDevProfileOverrides(devUserIdForPhone(normalized.data));
    const registered = Boolean(overrides?.full_name?.trim() && overrides?.email?.trim());
    return ok(registered);
  }

  if (!isSupabaseConfigured) {
    return ok(false);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', normalized.data)
    .maybeSingle();

  if (error) return err('UNKNOWN', error.message, error);
  return ok(Boolean(data));
}

export async function applySignupProfile(
  userId: string,
  phone: string,
  signup: SignupDetails,
): Promise<Result<Profile>> {
  const validated = validateSignupDetails(signup);
  if (!validated.ok) return validated;

  const overrides = {
    full_name: validated.data.fullName,
    email: validated.data.email,
  };

  if (isDevAuthEnabled() && isDevAuthUser(userId)) {
    await saveDevProfile(userId, overrides);
    return ok(createDevProfile(phone, overrides));
  }

  const updated = await updateProfile(userId, { full_name: validated.data.fullName });
  if (!updated.ok) return updated;

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: validated.data.fullName, email: validated.data.email },
    });
    if (error) logger.warn('updateUser signup metadata failed', error);
  }

  return ok({ ...updated.data, email: validated.data.email });
}

import { getApiBaseUrl } from './apiBase';

const API_URL = getApiBaseUrl();

async function sendOtpViaBackend(e164: string): Promise<Result<{ phone: string }>> {
  if (!API_URL) {
    return err('NETWORK', 'API URL is not configured');
  }

  try {
    const response = await fetch(`${API_URL}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: e164 }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };

    if (response.status === 429) {
      return err('RATE_LIMIT', body.message ?? 'Too many OTP requests. Try again shortly.');
    }

    if (!response.ok) {
      return err('AUTH', body.message ?? body.error ?? 'Failed to send OTP');
    }

    return ok({ phone: e164 });
  } catch (cause) {
    logger.error('sendOtpViaBackend network failure', cause);
    return err('NETWORK', 'Could not reach the auth server', cause);
  }
}

async function sendOtpDirect(e164: string): Promise<Result<{ phone: string }>> {
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) {
    logger.warn('sendOtpDirect failed', error);
    const message = error.message.toLowerCase().includes('rate')
      ? 'Too many OTP requests. Try again shortly.'
      : error.message;
    return err(
      error.message.toLowerCase().includes('rate') ? 'RATE_LIMIT' : 'AUTH',
      message,
      error,
    );
  }
  return ok({ phone: e164 });
}

/**
 * Send phone OTP. Prefers rate-limited Express proxy when EXPO_PUBLIC_API_URL is set;
 * falls back to direct Supabase for local/dev without a backend.
 */
export async function sendOtp(phoneInput: string): Promise<Result<{ phone: string }>> {
  const normalized = toE164India(phoneInput);
  if (!normalized.ok) return normalized;

  if (isDevAuthEnabled()) {
    logger.debug('sendOtp dev mode — use OTP', DEV_OTP);
    return ok({ phone: normalized.data });
  }

  if (!isSupabaseConfigured) {
    return err(
      'AUTH',
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, or set EXPO_PUBLIC_DEV_AUTH=true.',
    );
  }

  if (API_URL) {
    return sendOtpViaBackend(normalized.data);
  }
  return sendOtpDirect(normalized.data);
}

export async function verifyOtp(
  phoneE164: string,
  token: string,
  signup?: SignupDetails,
): Promise<Result<{ session: Session; user: User }>> {
  const cleaned = token.replace(/\D/g, '');
  if (cleaned.length !== 6) {
    return err('VALIDATION', 'Enter the 6-digit OTP');
  }

  if (isDevAuthEnabled()) {
    if (cleaned !== DEV_OTP) {
      return err('AUTH', 'Incorrect OTP. Please try again.');
    }
    const userId = devUserIdForPhone(phoneE164);
    const overrides = signup
      ? { full_name: signup.fullName, email: signup.email }
      : await loadDevProfileOverrides(userId);
    const dev = createDevSession(phoneE164, overrides ?? undefined);
    if (signup) {
      await saveDevProfile(dev.user.id, {
        full_name: signup.fullName,
        email: signup.email,
      });
    }
    return ok(dev);
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token: cleaned,
    type: 'sms',
  });

  if (error) {
    // Spec: OTP expiry / wrong OTP → clear inline error, not a generic alert.
    const lower = error.message.toLowerCase();
    let message = error.message;
    if (lower.includes('expired')) {
      message = 'OTP expired. Please request a new one.';
    } else if (lower.includes('invalid') || lower.includes('token')) {
      message = 'Incorrect OTP. Please try again.';
    }
    return err('AUTH', message, error);
  }

  if (!data.session || !data.user) {
    return err('AUTH', 'Verification succeeded but no session was created');
  }

  const profileResult = await ensureProfile(data.user);
  if (!profileResult.ok) {
    logger.warn('ensureProfile after verify failed', profileResult.error);
  }

  return ok({ session: data.session, user: data.user });
}

/** Create profile row on first login if trigger hasn't run yet. */
export async function ensureProfile(user: User): Promise<Result<Profile>> {
  const phone = user.phone ?? (user.user_metadata?.phone as string | undefined) ?? '';

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    return err('UNKNOWN', selectError.message, selectError);
  }

  if (existing) {
    return ok(existing as Profile);
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      phone,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      jain_preference: false,
    })
    .select('*')
    .single();

  if (insertError) {
    // Race with auth trigger — re-fetch
    const { data: raced, error: raceError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (raced) return ok(raced as Profile);
    return err('UNKNOWN', insertError.message ?? raceError?.message ?? 'Profile create failed', insertError);
  }

  return ok(created as Profile);
}

export async function fetchProfile(userId: string, phoneHint?: string): Promise<Result<Profile | null>> {
  if (isDevAuthUser(userId)) {
    const overrides = await loadDevProfileOverrides(userId);
    return ok(createDevProfile(phoneHint ?? '+917043156067', overrides ?? undefined));
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return err('UNKNOWN', error.message, error);
  return ok((data as Profile | null) ?? null);
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'jain_preference'>>,
): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) return err('UNKNOWN', error.message, error);
  return ok(data as Profile);
}

export async function signOut(): Promise<Result<true>> {
  if (isDevAuthEnabled()) {
    return ok(true);
  }
  const { error } = await supabase.auth.signOut();
  if (error) return err('AUTH', error.message, error);
  return ok(true);
}

/**
 * Verify OTP and submit account deletion request.
 * Calls backend when EXPO_PUBLIC_API_URL is set; otherwise deactivates session locally
 * and records intent for manual processing (Google Play in-app deletion requirement).
 */
export async function requestAccountDeletion(
  phoneInput: string,
  otp: string,
): Promise<Result<true>> {
  const normalized = toE164India(phoneInput);
  if (!normalized.ok) return normalized;

  const verified = await verifyOtp(normalized.data, otp);
  if (!verified.ok) return verified;

  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verified.data.session.access_token}`,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        return err('UNKNOWN', body.message ?? 'Account deletion request failed');
      }
    } catch (cause) {
      logger.error('requestAccountDeletion network failure', cause);
      return err('NETWORK', 'Could not reach the server to delete your account', cause);
    }
  }

  if (!isDevAuthEnabled()) {
    await supabase.auth.signOut();
  }

  return ok(true);
}

export async function getSession(): Promise<Result<Session | null>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return err('AUTH', error.message, error);
  return ok(data.session);
}
