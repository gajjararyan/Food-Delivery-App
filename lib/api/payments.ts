import type { Order } from '../types';
import { err, ok, type Result } from '../result';
import { logger } from '../logger';
import { isDevAuthEnabled } from '../devAuth';
import { isSupabaseConfigured, supabase } from '../supabase';
import { getOrder, markOrderPlaced, syncLocalOrder } from './orders';
import { getApiBaseUrl } from './apiBase';
import { isDevAccessToken } from '../payment/apiAuth';
import {
  clearPendingCheckoutProof,
  loadPendingCheckoutProof,
  savePendingCheckoutProof,
} from '../payment/pendingCheckoutStore';

function apiUrl(): string {
  return getApiBaseUrl();
}

function razorpayKeyConfigured(): boolean {
  const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';
  return Boolean(keyId && !keyId.includes('xxxxxxxx'));
}

/**
 * Offline-only checkout (no payment API). Used for local demo / Jest flows.
 */
export function useLocalPaymentPath(accessToken?: string | null): boolean {
  if (!apiUrl()) return true;
  if (isDevAuthEnabled() && !isSupabaseConfigured) return true;
  if (isDevAuthEnabled() && isDevAccessToken(accessToken)) {
    return !(isSupabaseConfigured && razorpayKeyConfigured());
  }
  return false;
}

/** True when checkout should open Razorpay via the payment API. */
export function canUseRazorpayCheckout(accessToken?: string | null): boolean {
  if (!apiUrl() || !razorpayKeyConfigured()) return false;
  if (!accessToken) return false;
  if (isDevAccessToken(accessToken)) {
    return isDevAuthEnabled() && isSupabaseConfigured;
  }
  return true;
}

export type PaymentSession = {
  keyId: string;
  razorpayOrderId: string | null;
  amountPaise: number;
  currency: string;
  appOrderId: string;
  paidWithCredits?: boolean;
  sandbox: boolean;
};

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function localPaymentSession(orderId: string, order?: Order): PaymentSession {
  const total = order ? Number(order.total) : 0;
  return {
    keyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_sandbox',
    razorpayOrderId: `order_local_${orderId.replace(/-/g, '').slice(0, 14)}`,
    amountPaise: Math.round(total * 100),
    currency: 'INR',
    appOrderId: orderId,
    paidWithCredits: total <= 0,
    sandbox: !razorpayKeyConfigured(),
  };
}

export async function createPaymentSession(
  orderId: string,
  accessTokenOverride?: string | null,
  customerId?: string | null,
): Promise<Result<PaymentSession>> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());

  if (useLocalPaymentPath(accessToken)) {
    const local = await getOrder(orderId);
    if (!local.ok) {
      return err('NOT_FOUND', 'Order not found');
    }
    return ok(localPaymentSession(orderId, local.data));
  }

  if (!accessToken) {
    return err('AUTH', 'Sign in required for checkout');
  }

  if (!canUseRazorpayCheckout(accessToken)) {
    return err('PAYMENT', 'Razorpay checkout is not configured');
  }

  try {
    const payload: Record<string, string> = { orderId, accessToken };
    if (customerId) payload.customerId = customerId;

    const response = await fetch(`${apiUrl()}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return err(
        'NETWORK',
        'Payment server returned an invalid response. Run npm run api:dev (port 3001) and reload the app.',
      );
    }
    const body = (await response.json().catch(() => ({}))) as PaymentSession & {
      message?: string;
    };
    if (!response.ok) {
      const message =
        body.message ??
        (response.status === 401
          ? 'Payment server rejected the session. Sign in again and ensure npm run api:dev is running.'
          : response.status === 404
            ? 'Order not found on server. Go back to cart and try checkout again.'
            : 'Could not start payment');
      return err('PAYMENT', message);
    }
    return ok(body);
  } catch (cause) {
    logger.error('createPaymentSession failed', cause);
    return err('NETWORK', 'Could not reach payment server. Start the API with npm run api:dev.', cause);
  }
}

export async function verifyRazorpayPayment(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  accessTokenOverride?: string | null;
  customerId?: string | null;
}): Promise<Result<{ orderId: string; status: string }>> {
  const accessToken = params.accessTokenOverride ?? (await getAccessToken());
  if (!accessToken) return err('AUTH', 'Sign in required');
  if (!apiUrl()) return err('PAYMENT', 'API URL required to verify payments');

  try {
    const payload: Record<string, string> = {
      orderId: params.orderId,
      accessToken,
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature,
    };
    if (params.customerId) payload.customerId = params.customerId;

    const response = await fetch(`${apiUrl()}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      orderId?: string;
      status?: string;
    };
    if (!response.ok) {
      return err('PAYMENT', body.message ?? 'Payment verification failed');
    }
    return ok({ orderId: body.orderId ?? params.orderId, status: body.status ?? 'placed' });
  } catch (cause) {
    logger.error('verifyRazorpayPayment failed', cause);
    return err('NETWORK', 'Could not verify payment', cause);
  }
}

const VERIFY_RETRY_DELAYS_MS = [0, 1200, 2500];

/** Retry verification on transient network errors (post-checkout success). */
export async function verifyRazorpayPaymentWithRetry(
  params: Parameters<typeof verifyRazorpayPayment>[0],
): Promise<Result<{ orderId: string; status: string }>> {
  let last: Result<{ orderId: string; status: string }> = err('NETWORK', 'Not attempted');
  for (let i = 0; i < VERIFY_RETRY_DELAYS_MS.length; i++) {
    const delay = VERIFY_RETRY_DELAYS_MS[i] ?? 0;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
    last = await verifyRazorpayPayment(params);
    if (last.ok) return last;
    if (last.error.code !== 'NETWORK') return last;
  }
  return last;
}

/**
 * Dev / sandbox confirm when native Razorpay checkout isn't available (Expo Go)
 * or Razorpay keys are not configured on the API.
 */
export async function confirmSandboxPayment(
  orderId: string,
  accessTokenOverride?: string | null,
  customerId?: string | null,
): Promise<Result<Order>> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());
  if (!accessToken) {
    return err('AUTH', 'Sign in required');
  }

  if (useLocalPaymentPath(accessToken)) {
    return markOrderPlaced(orderId, `pay_local_${Date.now()}`);
  }

  try {
    const payload: Record<string, string> = { orderId, accessToken };
    if (customerId) payload.customerId = customerId;

    const response = await fetch(`${apiUrl()}/payments/sandbox-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      orderId?: string;
      status?: string;
      offline?: boolean;
    };
    if (!response.ok) {
      return err('PAYMENT', body.message ?? 'Sandbox confirm failed');
    }

    const refreshed = await getOrder(orderId);
    if (refreshed.ok && refreshed.data.status === 'placed') {
      return ok(refreshed.data);
    }

    return err('NOT_FOUND', 'Order not found after payment');
  } catch (cause) {
    logger.error('confirmSandboxPayment failed', cause);
    return err('NETWORK', 'Could not confirm sandbox payment', cause);
  }
}

/** Persist Razorpay success payload when verify may fail (network recovery). */
export async function rememberCheckoutProof(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<void> {
  await savePendingCheckoutProof(params);
}

export async function retryPendingCheckoutVerification(
  orderId: string,
  accessTokenOverride?: string | null,
  customerId?: string | null,
): Promise<Result<{ orderId: string; status: string }>> {
  const proof = await loadPendingCheckoutProof(orderId);
  if (proof) {
    const verified = await verifyRazorpayPaymentWithRetry({
      orderId,
      razorpayOrderId: proof.razorpayOrderId,
      razorpayPaymentId: proof.razorpayPaymentId,
      razorpaySignature: proof.razorpaySignature,
      accessTokenOverride,
      customerId,
    });
    if (verified.ok) {
      await clearPendingCheckoutProof(orderId);
    }
    return verified;
  }

  const synced = await syncOrderAfterVerifiedPayment(orderId);
  if (synced.ok) {
    return ok({ orderId, status: synced.data.status });
  }
  return err('PAYMENT', synced.error.message);
}

/** Sync verified order into local cache after server-side payment confirmation. */
export async function syncOrderAfterVerifiedPayment(orderId: string): Promise<Result<Order>> {
  const refreshed = await getOrder(orderId);
  if (!refreshed.ok) return refreshed;
  if (refreshed.data.status !== 'placed') {
    return err('PAYMENT', 'Payment not confirmed on server yet');
  }
  syncLocalOrder(refreshed.data);
  await clearPendingCheckoutProof(orderId);
  return ok(refreshed.data);
}
