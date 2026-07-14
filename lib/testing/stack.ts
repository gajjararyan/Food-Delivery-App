import { isSupabaseConfigured } from '../supabase';
import { isPlaceholderEnv } from '../devAuth';

export type IntegrationTestMode = 'offline' | 'hybrid' | 'full';

export type StackStatus = {
  mode: IntegrationTestMode;
  devAuth: boolean;
  apiUrl: string;
  supabase: boolean;
  razorpayTest: boolean;
  googleMaps: boolean;
  sandboxConfirm: boolean;
};

/** How the app is configured for testing (read-only diagnostics). */
export function getIntegrationTestMode(): IntegrationTestMode {
  if (isSupabaseConfigured) return 'full';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (!isPlaceholderEnv(apiUrl) && apiUrl.length > 0) return 'hybrid';
  return 'offline';
}

export function isRazorpayTestConfigured(): boolean {
  const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';
  return Boolean(keyId.startsWith('rzp_test_') && !keyId.includes('xxxxxxxx'));
}

export function isGoogleMapsTestConfigured(): boolean {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  return Boolean(key.length > 10 && !key.includes('your-'));
}

export function getStackStatus(): StackStatus {
  return {
    mode: getIntegrationTestMode(),
    devAuth: process.env.EXPO_PUBLIC_DEV_AUTH === 'true' || !isSupabaseConfigured,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    supabase: isSupabaseConfigured,
    razorpayTest: isRazorpayTestConfigured(),
    googleMaps: isGoogleMapsTestConfigured(),
    sandboxConfirm: process.env.ALLOW_SANDBOX_CONFIRM === 'true',
  };
}
