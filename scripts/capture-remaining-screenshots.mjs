/**
 * Fast capture of remaining screens (admin + chef refresh + any missing).
 * Uses SPA-style navigation via history when possible.
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const BASE = process.env.SCREENSHOT_BASE_URL || 'http://localhost:8081';

function ensureDirs() {
  for (const folder of ['auth', 'customer', 'chef', 'admin']) {
    fs.mkdirSync(path.join(OUT, folder), { recursive: true });
  }
}

function createDevSession(phoneE164, fullName) {
  const digits = phoneE164.replace(/\D/g, '').slice(-10);
  const userId =
    digits === '7043156067'
      ? 'a7043156-0670-4000-8000-000000000001'
      : `00000000-0000-4000-8000-${digits.padStart(12, '0')}`;
  return {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      phone: phoneE164,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      app_metadata: { roles: ['customer'] },
      user_metadata: { phone: phoneE164, full_name: fullName, email: null },
    },
  };
}

async function shot(page, folder, name) {
  const dest = path.join(OUT, folder, `${name}.png`);
  await page.waitForTimeout(450);
  await page.screenshot({ path: dest, fullPage: false, animations: 'disabled' });
  console.log('✓', path.relative(ROOT, dest));
}

async function setRole(page, phoneE164, fullName) {
  const session = createDevSession(phoneE164, fullName);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(
    ({ session, fullName }) => {
      localStorage.setItem('gharkaswad_dev_session', JSON.stringify(session));
      const userId = session.user.id;
      const raw = localStorage.getItem('gharkaswad_dev_profile');
      const map = raw ? JSON.parse(raw) : {};
      map[userId] = { ...(map[userId] || {}), full_name: fullName };
      localStorage.setItem('gharkaswad_dev_profile', JSON.stringify(map));
    },
    { session, fullName },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function softNav(page, route) {
  // Prefer client-side route change via location (Expo still bootstraps but lighter than cold start)
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(800);
  // If still blank/wrong, hard navigate
  const url = page.url();
  if (!url.includes(route.replace(/^\//, '').split('/')[0]) && route !== '/') {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(700);
  }
}

async function hardNav(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);
}

async function clickTab(page, label) {
  const tab = page.getByText(label, { exact: true });
  if ((await tab.count()) > 0) {
    await tab.first().click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function writeIndex() {
  const lines = [
    '# GharKaSwad mobile screenshots',
    '',
    'Viewport: **390×844** @2x (iPhone 12–style mobile frame)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Folders: `auth`, `customer`, `chef`, `admin`',
    '',
  ];
  for (const folder of ['auth', 'customer', 'chef', 'admin']) {
    lines.push(`## ${folder}`);
    const dir = path.join(OUT, folder);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.png') && !f.startsWith('customer-01'))
      .sort();
    for (const f of files) lines.push(`- [${f}](./${folder}/${f})`);
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), lines.join('\n'), 'utf8');
  console.log('Wrote README');
}

async function main() {
  ensureDirs();
  // Remove stray copy
  const stray = path.join(OUT, 'customer', 'customer-01-discover-home.png');
  if (fs.existsSync(stray)) fs.unlinkSync(stray);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // --- CHEF (Anita) ---
  console.log('Chef…');
  await setRole(page, '+919123456780', 'Anita Verma');
  await hardNav(page, '/profile');
  await shot(page, 'chef', '00-profile-with-kitchen-link');

  // Open chef ops
  const chefHref = await page.locator('a[href*="(chef)"]').first().getAttribute('href').catch(() => null);
  if (chefHref) {
    await hardNav(page, chefHref.startsWith('http') ? new URL(chefHref).pathname + new URL(chefHref).search : chefHref);
  } else {
    // Expo deep path
    await hardNav(page, '/menu');
  }
  await page.waitForTimeout(1000);
  await shot(page, 'chef', '01-overview');

  await clickTab(page, 'Menu');
  await shot(page, 'chef', '02-menu');
  // scroll menu for detail
  await page.evaluate(() => window.scrollBy(0, 400));
  await shot(page, 'chef', '02b-menu-scrolled');

  await clickTab(page, 'Orders');
  await shot(page, 'chef', '03-orders');

  await clickTab(page, 'Overview');
  await shot(page, 'chef', '01b-overview-tab');

  // --- ADMIN ---
  console.log('Admin…');
  await setRole(page, '+911234567890', 'Admin');
  await hardNav(page, '/');
  await page.waitForTimeout(1500);
  await shot(page, 'admin', '01-overview');

  await clickTab(page, 'Apply');
  await shot(page, 'admin', '02-applications');
  await page.evaluate(() => window.scrollBy(0, 400));
  await shot(page, 'admin', '02b-applications-scrolled');

  await clickTab(page, 'Kitchens');
  await shot(page, 'admin', '03-kitchens');
  await page.evaluate(() => window.scrollBy(0, 400));
  await shot(page, 'admin', '03b-kitchens-scrolled');

  await clickTab(page, 'Orders');
  await shot(page, 'admin', '04-orders');

  await clickTab(page, 'Overview');
  await shot(page, 'admin', '01b-overview-tab');

  // If tabs didn't work, hard-nav known admin routes
  if (!(await page.getByText('Ops overview').count()) && !(await page.getByText('Applications').count())) {
    for (const [name, route] of [
      ['01-overview', '/'],
      ['02-applications', '/applications'],
      ['03-kitchens', '/kitchens'],
      ['04-orders', '/orders'],
    ]) {
      await hardNav(page, route);
      await shot(page, 'admin', name);
    }
  }

  // --- CUSTOMER extras: scroll details + try tracking from any order link ---
  console.log('Customer extras…');
  await setRole(page, '+917043156067', 'Audit Customer');
  await hardNav(page, '/home');
  await page.evaluate(() => window.scrollBy(0, 500));
  await shot(page, 'customer', '01b-discover-scrolled');

  await hardNav(page, '/orders');
  const track = await page.locator('a[href*="/tracking/"]').first().getAttribute('href').catch(() => null);
  if (track) {
    await hardNav(page, track.startsWith('http') ? new URL(track).pathname : track);
    await shot(page, 'customer', '07-order-tracking');
    const oid = track.match(/\/tracking\/([^/?#]+)/)?.[1];
    if (oid) {
      await hardNav(page, `/review/${oid}`);
      await shot(page, 'customer', '08-order-review');
    }
  }

  await hardNav(page, '/chef/0652fea5-7220-490b-8b98-e3a8256591c9');
  await page.evaluate(() => window.scrollBy(0, 450));
  await shot(page, 'customer', '02c-chef-detail-scrolled');

  await hardNav(page, '/thali/790319d0-e5c5-4ff8-8768-62b651320ea1');
  await page.evaluate(() => window.scrollBy(0, 700));
  await shot(page, 'customer', '03c-thali-builder-bottom');

  await hardNav(page, '/checkout');
  await page.evaluate(() => window.scrollBy(0, 500));
  await shot(page, 'customer', '05b-checkout-scrolled');

  await hardNav(page, '/profile');
  await page.evaluate(() => window.scrollBy(0, 400));
  await shot(page, 'customer', '10b-profile-scrolled');

  await browser.close();
  await writeIndex();
  console.log('Done →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
