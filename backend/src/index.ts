import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { getDeliveryTracking } from '../../lib/maps/driverLocation';
import type { Order } from '../../lib/types';
import { computeVerifiedOrderAmounts } from '../../lib/payment/orderTotal';
import { verifyRazorpayPaymentSignature } from '../../lib/payment/razorpaySignature';
import { resolvePaymentCustomerId } from '../../lib/payment/apiAuth';

// Load monorepo root .env when started via `npm run api:dev`
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = Number(process.env.PORT ?? 3001);
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
const ALLOW_SANDBOX_CONFIRM = process.env.ALLOW_SANDBOX_CONFIRM === 'true';

/**
 * Thin Express API for secrets / abuse protection.
 * Known tradeoff: Render free tier cold starts (~30–60s) — not a bug.
 */
const app = express();
app.use(helmet());
app.use(cors({ origin: true }));
app.use(
  express.json({
    limit: '64kb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

function adminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function authClient(): SupabaseClient | null {
  if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) return null;
  const key = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  return createClient(SUPABASE_URL, key);
}

function razorpayConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gharkaswad-api',
    razorpay: razorpayConfigured(),
    sandboxConfirm: ALLOW_SANDBOX_CONFIRM || !razorpayConfigured(),
  });
});

/** Per-IP + per-phone OTP abuse guard (MVP: 5 / 15 min). */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Try again shortly.' },
  // Express 5 / IPv6-safe: hash phone with IP from Express (trust proxy off by default).
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    return `${req.ip ?? 'unknown'}:${phone}`;
  },
});

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Phone must be E.164 Indian mobile (+91XXXXXXXXXX)'),
});

app.post('/auth/otp/send', otpLimiter, async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid phone' });
    return;
  }

  const client = authClient();
  if (!client) {
    res.status(503).json({ message: 'Auth service is not configured on the server' });
    return;
  }

  const { error } = await client.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('rate')) {
      res.status(429).json({ message: 'Too many OTP requests. Try again shortly.' });
      return;
    }
    res.status(400).json({ message: error.message });
    return;
  }

  res.json({ ok: true, phone: parsed.data.phone });
});

const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(3),
  customerId: z.string().uuid().optional(),
});

/**
 * Create (or reuse) a Razorpay order for a payment_pending app order.
 * Double-charge guard: reuse existing razorpay_order_id when present.
 */
app.post('/payments/create-order', async (req, res) => {
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }

  const admin = adminClient();
  if (!admin) {
    res.status(503).json({ message: 'Payment service is not configured (service role)' });
    return;
  }

  const { data: orderRow } = await admin
    .from('orders')
    .select('id, customer_id')
    .eq('id', parsed.data.orderId)
    .maybeSingle();

  const customerId = await resolvePaymentCustomerId({
    admin,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    accessToken: parsed.data.accessToken,
    orderId: parsed.data.orderId,
    customerIdHint: parsed.data.customerId,
  });

  if (!customerId) {
    if (!orderRow) {
      res.status(404).json({
        message: 'Order not found on server. Go back, add your thali again, and retry checkout.',
      });
      return;
    }
    res.status(401).json({
      message:
        'Unauthorized — sign in again, ensure npm run api:dev is running, and retry checkout.',
    });
    return;
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*')
    .eq('id', parsed.data.orderId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (orderError || !order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  if (order.status === 'placed' || order.status === 'accepted' || order.status === 'cooking' || order.status === 'out_for_delivery' || order.status === 'delivered') {
    res.status(400).json({ message: 'Order is already paid' });
    return;
  }

  if (order.razorpay_order_id && Number(order.total) > 0) {
    const verifiedReuse = computeVerifiedOrderAmounts(order as Order);
    const amountDue = verifiedReuse?.amountDue ?? Number(order.total);
    const amountPaiseReuse = Math.round(amountDue * 100);
    const storedPaise = Math.round(Number(order.total) * 100);
    if (verifiedReuse && amountPaiseReuse === storedPaise) {
      res.json({
        ok: true,
        keyId: RAZORPAY_KEY_ID || 'rzp_test_sandbox',
        razorpayOrderId: order.razorpay_order_id,
        amountPaise: amountPaiseReuse,
        currency: 'INR',
        appOrderId: order.id,
        sandbox: !razorpayConfigured(),
      });
      return;
    }
    // Amount changed since last Razorpay order — fall through to create a new one.
  }
  console.log("========== ORDER ==========");
  console.log("Order ID:", order.id);
  console.log("Snapshot Type:", typeof order.thali_snapshot);
  console.log("Snapshot:", JSON.stringify(order.thali_snapshot, null, 2));
  console.log("========== END ORDER ==========");
  const verified = computeVerifiedOrderAmounts(order as Order);
  if (!verified) {
    res.status(400).json({ message: 'Order snapshot is invalid; cannot price payment' });
    return;
  }

  const amountPaise = Math.round(verified.amountDue * 100);

  if (
    verified.subtotal !== Number(order.subtotal) ||
    verified.amountDue !== Number(order.total)
  ) {
    const { error: priceFixError } = await admin
      .from('orders')
      .update({
        subtotal: verified.subtotal,
        total: verified.amountDue,
      })
      .eq('id', order.id);
    if (priceFixError) {
      res.status(500).json({ message: priceFixError.message });
      return;
    }
  }

  if (amountPaise <= 0) {
    // Fully covered by credits — mark placed without Razorpay.
    const invoiceNumber = `GKS-${order.created_at.slice(0, 10).replace(/-/g, '')}-${order.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const snap = (order.thali_snapshot as Record<string, unknown>) ?? {};
    await admin
      .from('orders')
      .update({
        status: 'placed',
        razorpay_payment_id: 'credits_only',
        thali_snapshot: {
          ...snap,
          payment: {
            invoiceNumber,
            paidAt: new Date().toISOString(),
            method: 'credits',
            status: 'paid',
          },
        },
      })
      .eq('id', order.id);
    res.json({
      ok: true,
      keyId: RAZORPAY_KEY_ID || 'rzp_test_sandbox',
      razorpayOrderId: null,
      amountPaise: 0,
      currency: 'INR',
      appOrderId: order.id,
      paidWithCredits: true,
      sandbox: !razorpayConfigured(),
    });
    return;
  }

  let razorpayOrderId: string;
  if (razorpayConfigured()) {
    try {
      const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
      const created = await rzp.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: order.id.slice(0, 40),
        notes: { app_order_id: order.id },
      });
      razorpayOrderId = created.id;
    } catch (cause: unknown) {
      const razorpayErr = cause as {
        statusCode?: number;
        error?: { description?: string };
      };
      const detail = razorpayErr.error?.description ?? 'Razorpay order creation failed';
      console.error('[payments/create-order] Razorpay error', cause);
      if (razorpayErr.statusCode === 401) {
        res.status(502).json({
          message:
            'Razorpay test keys are invalid. Regenerate Key ID and Secret in the Razorpay dashboard and update .env.',
        });
        return;
      }
      res.status(502).json({ message: detail });
      return;
    }
  } else {
    razorpayOrderId = `order_sandbox_${order.id.replace(/-/g, '').slice(0, 14)}`;
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      razorpay_order_id: razorpayOrderId,
      status: 'payment_pending',
    })
    .eq('id', order.id);

  if (updateError) {
    res.status(500).json({ message: updateError.message });
    return;
  }

  res.json({
    ok: true,
    keyId: RAZORPAY_KEY_ID || 'rzp_test_sandbox',
    razorpayOrderId,
    amountPaise,
    currency: 'INR',
    appOrderId: order.id,
    sandbox: !razorpayConfigured(),
  });
});

const verifySchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(3),
  customerId: z.string().uuid().optional(),
  razorpayOrderId: z.string().min(3),
  razorpayPaymentId: z.string().min(3),
  razorpaySignature: z.string().min(3),
});

app.post('/payments/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }

  if (!razorpayConfigured()) {
    res.status(503).json({ message: 'Razorpay is not configured; use sandbox confirm' });
    return;
  }

  const admin = adminClient();
  if (!admin) {
    res.status(503).json({ message: 'Payment service is not configured' });
    return;
  }

  const customerId = await resolvePaymentCustomerId({
    admin,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    accessToken: parsed.data.accessToken,
    orderId: parsed.data.orderId,
    customerIdHint: parsed.data.customerId,
  });

  if (!customerId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const body = parsed.data;
  const signatureOk = verifyRazorpayPaymentSignature(
    RAZORPAY_KEY_SECRET,
    body.razorpayOrderId,
    body.razorpayPaymentId,
    body.razorpaySignature,
  );

  if (!signatureOk) {
    await admin
      .from('orders')
      .update({ status: 'payment_failed' })
      .eq('id', body.orderId)
      .eq('customer_id', customerId);
    res.status(400).json({ message: 'Invalid payment signature' });
    return;
  }

  const { data: existing, error: existingError } = await admin
    .from('orders')
    .select('id, status, razorpay_order_id')
    .eq('id', body.orderId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existingError || !existing) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  if (
    existing.razorpay_order_id &&
    existing.razorpay_order_id !== body.razorpayOrderId
  ) {
    res.status(400).json({ message: 'Payment order mismatch' });
    return;
  }

  if (existing.status === 'placed') {
    res.json({ ok: true, orderId: existing.id, status: 'placed' });
    return;
  }

  const { data: fullOrder } = await admin
    .from('orders')
    .select('thali_snapshot, created_at')
    .eq('id', body.orderId)
    .maybeSingle();

  const snap = (fullOrder?.thali_snapshot as Record<string, unknown>) ?? {};
  const invoiceNumber = `GKS-${(fullOrder?.created_at ?? new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-${body.orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const paymentSnapshot = {
    invoiceNumber,
    paidAt: new Date().toISOString(),
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    method: 'razorpay',
    status: 'paid',
  };

  const { data: order, error } = await admin
    .from('orders')
    .update({
      status: 'placed',
      razorpay_order_id: body.razorpayOrderId,
      razorpay_payment_id: body.razorpayPaymentId,
      thali_snapshot: { ...snap, payment: paymentSnapshot },
    })
    .eq('id', body.orderId)
    .eq('customer_id', customerId)
    .select('id, status')
    .maybeSingle();

  if (error || !order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  res.json({ ok: true, orderId: order.id, status: order.status });
});

const sandboxSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(3),
  customerId: z.string().uuid().optional(),
});

/** Local/dev path when Razorpay keys are unset or ALLOW_SANDBOX_CONFIRM=true. */
app.post('/payments/sandbox-confirm', async (req, res) => {
  if (razorpayConfigured() && !ALLOW_SANDBOX_CONFIRM) {
    res.status(403).json({ message: 'Sandbox confirm disabled while Razorpay is configured' });
    return;
  }

  const parsed = sandboxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }

  const admin = adminClient();
  if (!admin) {
    // Offline demo: accept without DB when service role missing.
    res.json({
      ok: true,
      orderId: parsed.data.orderId,
      status: 'placed',
      offline: true,
    });
    return;
  }

  const customerId = await resolvePaymentCustomerId({
    admin,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    accessToken: parsed.data.accessToken,
    orderId: parsed.data.orderId,
    customerIdHint: parsed.data.customerId,
  });

  if (!customerId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const paymentId = `pay_sandbox_${Date.now()}`;
  const { data: order, error } = await admin
    .from('orders')
    .update({
      status: 'placed',
      razorpay_payment_id: paymentId,
    })
    .eq('id', parsed.data.orderId)
    .eq('customer_id', customerId)
    .in('status', ['payment_pending', 'payment_failed'])
    .select('id, status')
    .maybeSingle();

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }
  if (!order) {
    res.status(404).json({ message: 'Payable order not found' });
    return;
  }

  res.json({ ok: true, orderId: order.id, status: order.status });
});

app.post('/payments/webhook', async (req, res) => {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    res.status(503).json({ message: 'Webhook secret not configured' });
    return;
  }

  const signature = req.header('x-razorpay-signature') ?? '';
  const raw = (req as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  if (expected !== signature) {
    res.status(400).json({ message: 'Invalid webhook signature' });
    return;
  }

  const event = req.body as {
    event?: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string; status?: string } } };
  };

  const payment = event.payload?.payment?.entity;
  const admin = adminClient();
  if (admin && payment?.order_id && payment.status === 'captured') {
    await admin
      .from('orders')
      .update({
        status: 'placed',
        razorpay_payment_id: payment.id ?? null,
      })
      .eq('razorpay_order_id', payment.order_id)
      .eq('status', 'payment_pending');
  }

  res.json({ ok: true });
});

/** In-memory driver GPS from courier app (production: use Redis / DB). */
const LIVE_DRIVER_LOCATIONS = new Map<string, { lat: number; lng: number }>();

function applyLiveDriverLocation(orderId: string, snapshot: ReturnType<typeof getDeliveryTracking>) {
  const live = LIVE_DRIVER_LOCATIONS.get(orderId);
  if (!live) return snapshot;
  return {
    ...snapshot,
    driver: { ...snapshot.driver, lat: live.lat, lng: live.lng },
  };
}

app.get('/orders/:orderId/tracking', async (req, res) => {
  const orderId = req.params.orderId;
  const admin = adminClient();

  if (!admin) {
    res.status(503).json({ message: 'Tracking requires Supabase service role in production' });
    return;
  }

  const { data: order, error } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    res.status(404).json({ message: 'Order not found' });
    return;
  }

  const snapshot = applyLiveDriverLocation(orderId, getDeliveryTracking(order as Order));
  res.json(snapshot);
});

const driverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  driverToken: z.string().min(8).optional(),
});

/** Courier / driver app posts live GPS (MVP: open endpoint; lock down with driverToken in prod). */
app.post('/orders/:orderId/driver-location', (req, res) => {
  const parsed = driverLocationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid coordinates' });
    return;
  }

  LIVE_DRIVER_LOCATIONS.set(req.params.orderId, {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
  });
  res.json({ ok: true });
});

/** JSON errors for unhandled async failures (e.g. upstream Razorpay). */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[gharkaswad-api] unhandled', err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.warn(`[gharkaswad-api] listening on :${PORT}`);
});
