import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Dev OTP session token — not a Supabase JWT. */
export function isDevAccessToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return token === 'dev-access-token' || token.startsWith('dev-');
}

export function isDevPaymentAuthEnabled(): boolean {
  if (process.env.ALLOW_DEV_PAYMENT === 'false') return false;
  return process.env.EXPO_PUBLIC_DEV_AUTH === 'true' || process.env.ALLOW_DEV_PAYMENT === 'true';
}

/**
 * Resolve customer id for payment routes.
 * Real JWT → Supabase auth. Dev token → order owner (must match optional customerId hint).
 */
export async function resolvePaymentCustomerId(params: {
  admin: SupabaseClient;
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  accessToken: string;
  orderId: string;
  customerIdHint?: string;
}): Promise<string | null> {
  const { admin, supabaseUrl, supabaseAnonKey, serviceRoleKey, accessToken, orderId, customerIdHint } =
    params;

  if (!isDevAccessToken(accessToken)) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return null;
    return userData.user.id;
  }

  if (!isDevPaymentAuthEnabled()) return null;

  const { data: order, error } = await admin
    .from('orders')
    .select('customer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) return null;
  if (customerIdHint && customerIdHint !== order.customer_id) return null;
  return order.customer_id as string;
}
