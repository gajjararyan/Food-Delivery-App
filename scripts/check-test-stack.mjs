/**
 * Verify local integration-test stack (API + optional services).
 * Usage: node scripts/check-test-stack.mjs
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const RAZORPAY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEV_AUTH = process.env.EXPO_PUBLIC_DEV_AUTH === 'true';

function ok(label, pass, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

let healthy = true;

console.log('\nGharKaSwad — integration test stack\n');

// API
try {
  const res = await fetch(`${API_URL}/health`);
  const body = await res.json();
  healthy = ok('API server', res.ok && body.ok, API_URL) && healthy;
  if (body.razorpay !== undefined) {
    ok('Razorpay on API', body.razorpay, body.razorpay ? 'test keys loaded' : 'not configured');
  }
} catch {
  healthy = ok('API server', false, `start with: npm run api:dev (${API_URL})`) && false;
}

// Supabase
const supabaseReady =
  SUPABASE_URL.length > 10 &&
  !SUPABASE_URL.includes('YOUR_PROJECT') &&
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').length > 10;
ok('Supabase', supabaseReady, supabaseReady ? 'full DB mode' : 'using offline/dev auth');

// Dev auth
ok('Dev OTP login', DEV_AUTH || !supabaseReady, DEV_AUTH ? 'OTP 123456' : 'disabled — real SMS OTP');

// Razorpay test
ok(
  'Razorpay test keys',
  RAZORPAY_ID.startsWith('rzp_test_') && RAZORPAY_SECRET.length > 8,
  RAZORPAY_ID || 'missing EXPO_PUBLIC_RAZORPAY_KEY_ID',
);

// Maps
ok('Google Maps', MAPS_KEY.length > 10, MAPS_KEY ? 'live map enabled' : 'static map fallback');

console.log('\nMode guide:');
console.log('  offline — dev OTP + local data (current default)');
console.log('  hybrid  — dev OTP + API + Razorpay test + local chef marketplace');
console.log('  full    — Supabase + API + Razorpay test (set EXPO_PUBLIC_DEV_AUTH=false)\n');

process.exit(healthy ? 0 : 1);
