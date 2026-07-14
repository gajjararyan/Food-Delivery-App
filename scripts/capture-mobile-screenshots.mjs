/**
 * Capture mobile (390×844) screenshots for auth, customer, chef, and admin.
 * Requires: npm run web on http://localhost:8081
 * Usage: node scripts/capture-mobile-screenshots.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const BASE = process.env.SCREENSHOT_BASE_URL || 'http://localhost:8081';
const DEV_OTP = '654321';

const PHONES = {
  customer: { national: '7043156067', e164: '+917043156067', name: 'Audit Customer' },
  chef: { national: '9123456780', e164: '+919123456780', name: 'Anita Verma' },
  chefAlt: { national: '9876543210', e164: '+919876543210', name: 'Chef Demo' },
  admin: { national: '1234567890', e164: '+911234567890', name: 'Admin' },
};

const LEGAL_IDS = [
  'terms',
  'privacy',
  'refund',
  'cancellation',
  'maker-terms',
  'courier-disclaimer',
  'fssai-disclaimer',
  'delivery-pickup',
  'payment',
  'ratings-reviews',
  'grievance',
  'data-retention',
  'account-deletion',
  'intellectual-property',
  'disclaimer',
];

function ensureDirs() {
  for (const folder of ['auth', 'customer', 'chef', 'admin']) {
    fs.mkdirSync(path.join(OUT, folder), { recursive: true });
  }
}

function devUserIdForPhone(phoneE164) {
  const digits = phoneE164.replace(/\D/g, '').slice(-10);
  if (digits === '7043156067') return 'a7043156-0670-4000-8000-000000000001';
  const tail = digits.padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

function createDevSession(phoneE164, fullName) {
  const userId = devUserIdForPhone(phoneE164);
  const user = {
    id: userId,
    phone: phoneE164,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: { roles: ['customer'] },
    user_metadata: { phone: phoneE164, full_name: fullName, email: null },
  };
  return {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
}

async function waitSettled(page, ms = 500) {
  await page.waitForTimeout(ms);
}

async function shot(page, folder, name) {
  const dest = path.join(OUT, folder, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false, animations: 'disabled' });
  console.log('✓', path.relative(ROOT, dest));
  return dest;
}

async function clearSession(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('gharkaswad_dev_session');
  });
}

async function injectSession(page, phoneE164, fullName) {
  const session = createDevSession(phoneE164, fullName);
  const userId = session.user.id;
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ session, userId, fullName }) => {
      localStorage.setItem('gharkaswad_dev_session', JSON.stringify(session));
      const raw = localStorage.getItem('gharkaswad_dev_profile');
      const map = raw ? JSON.parse(raw) : {};
      map[userId] = { ...(map[userId] || {}), full_name: fullName };
      localStorage.setItem('gharkaswad_dev_profile', JSON.stringify(map));
    },
    { session, userId, fullName },
  );
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitSettled(page, 900);
}

async function gotoPath(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitSettled(page, 700);
}

async function clickText(page, text, exact = false) {
  const loc = exact ? page.getByText(text, { exact: true }) : page.getByText(text);
  if ((await loc.count()) > 0) {
    try {
      await loc.first().click({ timeout: 4000, force: true });
      await waitSettled(page);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function hrefOf(page, selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  return loc.getAttribute('href');
}

async function captureAuth(page) {
  await clearSession(page);
  await gotoPath(page, '/welcome');
  await shot(page, 'auth', '01-welcome');

  await gotoPath(page, '/login');
  await shot(page, 'auth', '02-login');

  // Fill login to reach verify
  const phoneInput = page.locator('input').first();
  if (await phoneInput.count()) {
    await phoneInput.fill(PHONES.customer.national);
    await clickText(page, 'Continue') || (await clickText(page, 'Send OTP')) || (await clickText(page, 'Get OTP'));
    await waitSettled(page, 1000);
  }
  await gotoPath(page, '/verify');
  await shot(page, 'auth', '03-verify');

  await gotoPath(page, '/signup');
  await shot(page, 'auth', '04-signup');
}

async function captureCustomer(page) {
  await injectSession(page, PHONES.customer.e164, PHONES.customer.name);

  await gotoPath(page, '/home');
  await shot(page, 'customer', '01-discover-home');

  let chefId = null;
  let menuItemId = null;
  let orderId = null;

  const chefHref = await hrefOf(page, 'a[href*="/chef/"]');
  if (chefHref) {
    chefId = chefHref.match(/\/chef\/([^/?#]+)/)?.[1] || null;
    await gotoPath(page, chefHref.startsWith('http') ? new URL(chefHref).pathname : chefHref);
  } else {
    await gotoPath(page, '/chef/0652fea5-7220-490b-8b98-e3a8256591c9');
    chefId = '0652fea5-7220-490b-8b98-e3a8256591c9';
  }
  await shot(page, 'customer', '02-chef-detail');

  // Capture a second kitchen if listed on home
  await gotoPath(page, '/home');
  const allChefHrefs = await page.$$eval('a[href*="/chef/"]', (as) =>
    [...new Set(as.map((a) => a.getAttribute('href')).filter(Boolean))],
  );
  if (allChefHrefs.length > 1) {
    const second = allChefHrefs[1];
    await gotoPath(page, second.startsWith('http') ? new URL(second).pathname : second);
    await shot(page, 'customer', '02b-chef-detail-alt');
  }

  // Thali builder — read href then navigate (links may be off-screen)
  await gotoPath(page, chefId ? `/chef/${chefId}` : '/chef/0652fea5-7220-490b-8b98-e3a8256591c9');
  const thaliHref = await hrefOf(page, 'a[href*="/thali/"]');
  menuItemId =
    thaliHref?.match(/\/thali\/([^/?#]+)/)?.[1] || '790319d0-e5c5-4ff8-8768-62b651320ea1';
  await gotoPath(page, `/thali/${menuItemId}`);
  await shot(page, 'customer', '03-thali-builder');

  // Scroll mid-builder for component detail
  await page.evaluate(() => window.scrollBy(0, 420));
  await waitSettled(page, 400);
  await shot(page, 'customer', '03b-thali-builder-scrolled');

  await gotoPath(page, '/cart');
  await shot(page, 'customer', '04-cart');

  await gotoPath(page, '/checkout');
  await shot(page, 'customer', '05-checkout');

  await gotoPath(page, '/orders');
  await shot(page, 'customer', '06-orders');

  orderId = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('gharkaswad_orders_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      return list[0]?.id || null;
    } catch {
      return null;
    }
  });
  const trackHref = await hrefOf(page, 'a[href*="/tracking/"]');
  if (trackHref) {
    orderId = trackHref.match(/\/tracking\/([^/?#]+)/)?.[1] || orderId;
    await gotoPath(page, trackHref.startsWith('http') ? new URL(trackHref).pathname : trackHref);
    await shot(page, 'customer', '07-order-tracking');
  } else if (orderId) {
    await gotoPath(page, `/tracking/${orderId}`);
    await shot(page, 'customer', '07-order-tracking');
  }

  if (orderId) {
    await gotoPath(page, `/review/${orderId}`);
    await shot(page, 'customer', '08-order-review');
  }

  await gotoPath(page, '/subscription');
  await shot(page, 'customer', '09-subscription');

  await gotoPath(page, '/profile');
  await shot(page, 'customer', '10-profile');

  await gotoPath(page, '/become-chef');
  await shot(page, 'customer', '11-become-chef');

  await gotoPath(page, '/dietary');
  await shot(page, 'customer', '12-dietary');

  await gotoPath(page, '/meal-calendar');
  await shot(page, 'customer', '13-meal-calendar');

  await gotoPath(page, '/pause-skip');
  await shot(page, 'customer', '14-pause-skip');

  await gotoPath(page, '/legal');
  await shot(page, 'customer', '15-legal-hub');

  let i = 16;
  for (const id of LEGAL_IDS) {
    await gotoPath(page, `/legal/${id}`);
    await shot(page, 'customer', `${String(i).padStart(2, '0')}-legal-${id}`);
    i += 1;
  }

  await gotoPath(page, '/delete-account');
  await shot(page, 'customer', `${String(i).padStart(2, '0')}-delete-account`);
  i += 1;

  await gotoPath(page, '/payment-failed');
  await shot(page, 'customer', `${String(i).padStart(2, '0')}-payment-failed`);
}

async function captureChef(page) {
  // Anita has a live maker_profiles row (owner_phone).
  await injectSession(page, PHONES.chef.e164, PHONES.chef.name);
  await gotoPath(page, '/profile');
  await waitSettled(page, 1500);

  // Open chef ops from profile ("Open kitchen" / Kitchen dashboard link)
  const kitchenLink = page.locator('a[href*="(chef)"]').first();
  if (await kitchenLink.count()) {
    await kitchenLink.click();
  } else {
    await gotoPath(page, '/--/(chef)/(tabs)/');
  }
  await waitSettled(page, 1800);
  await shot(page, 'chef', '01-overview');

  // Menu tab
  if (await clickText(page, 'Menu', true)) {
    await waitSettled(page, 1200);
  } else {
    await gotoPath(page, '/menu');
    await waitSettled(page, 1200);
  }
  await shot(page, 'chef', '02-menu');

  // Orders tab
  if (await clickText(page, 'Orders', true)) {
    await waitSettled(page, 1200);
  } else {
    await gotoPath(page, '/orders');
    await waitSettled(page, 1200);
  }
  await shot(page, 'chef', '03-orders');

  // Overview again for a clean shot after tabs settle
  if (await clickText(page, 'Overview', true)) {
    await waitSettled(page, 1000);
    await shot(page, 'chef', '01b-overview-tab');
  }

  // Fallback chef phone if Anita was denied
  const denied = await page.getByText(/Access denied|Reconnect|not a chef|denied/i).count();
  if (denied > 0) {
    await injectSession(page, PHONES.chefAlt.e164, PHONES.chefAlt.name);
    await gotoPath(page, '/profile');
    await waitSettled(page, 1200);
    const link2 = page.locator('a[href*="(chef)"]').first();
    if (await link2.count()) await link2.click();
    else await gotoPath(page, '/menu');
    await waitSettled(page, 1500);
    await shot(page, 'chef', '01c-overview-alt-chef');
    if (await clickText(page, 'Menu', true)) await shot(page, 'chef', '02c-menu-alt-chef');
    if (await clickText(page, 'Orders', true)) await shot(page, 'chef', '03c-orders-alt-chef');
  }
}

async function captureAdmin(page) {
  await injectSession(page, PHONES.admin.e164, PHONES.admin.name);
  // Index redirects admin → /(admin)/
  await gotoPath(page, '/');
  await waitSettled(page, 2000);
  await shot(page, 'admin', '01-overview');

  // Tab labels: Overview, Apply, Kitchens, Orders
  if (await clickText(page, 'Apply', true)) {
    await waitSettled(page, 1200);
    await shot(page, 'admin', '02-applications');
  } else {
    await gotoPath(page, '/applications');
    await waitSettled(page, 1200);
    await shot(page, 'admin', '02-applications');
  }

  if (await clickText(page, 'Kitchens', true)) {
    await waitSettled(page, 1200);
    await shot(page, 'admin', '03-kitchens');
  } else {
    await gotoPath(page, '/kitchens');
    await waitSettled(page, 1200);
    await shot(page, 'admin', '03-kitchens');
  }

  if (await clickText(page, 'Orders', true)) {
    await waitSettled(page, 1200);
    await shot(page, 'admin', '04-orders');
  } else {
    await gotoPath(page, '/orders');
    await waitSettled(page, 1200);
    await shot(page, 'admin', '04-orders');
  }

  if (await clickText(page, 'Overview', true)) {
    await waitSettled(page, 1000);
    await shot(page, 'admin', '01b-overview-tab');
  }
}

async function writeIndex() {
  const lines = ['# GharKaSwad mobile screenshots', '', `Viewport: **390×844** (iPhone 12-ish)`, '', `Generated: ${new Date().toISOString()}`, ''];
  for (const folder of ['auth', 'customer', 'chef', 'admin']) {
    lines.push(`## ${folder}`);
    const dir = path.join(OUT, folder);
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
      : [];
    for (const f of files) {
      lines.push(`- [${f}](./${folder}/${f})`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), lines.join('\n'), 'utf8');
  console.log('Wrote docs/screenshots/README.md');
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const steps = [
    ['auth', captureAuth],
    ['customer', captureCustomer],
    ['chef', captureChef],
    ['admin', captureAdmin],
  ];
  for (const [label, fn] of steps) {
    console.log(`Capturing ${label}…`);
    try {
      await fn(page);
    } catch (err) {
      console.error(`✖ ${label} failed:`, err.message || err);
      await shot(page, label, 'zz-error-state').catch(() => {});
    }
  }

  await browser.close();
  await writeIndex();
  console.log('Done →', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
