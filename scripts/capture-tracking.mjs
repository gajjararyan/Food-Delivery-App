import { chromium, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'screenshots', 'customer');

const admin = {
  access_token: 'dev-access-token',
  refresh_token: 'dev-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-4000-8000-00001234567890',
    phone: '+911234567890',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: { roles: ['customer'] },
    user_metadata: { phone: '+911234567890', full_name: 'Admin', email: null },
  },
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 12'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(45000);

await page.goto('http://localhost:8081/', { waitUntil: 'commit', timeout: 45000 });
await page.evaluate((s) => localStorage.setItem('gharkaswad_dev_session', JSON.stringify(s)), admin);
await page.goto('http://localhost:8081/orders', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);

const text = await page.evaluate(() => document.body.innerText);
const uuid = (text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
console.log('uuid from admin orders text:', uuid || '(none)');

if (uuid) {
  const cust = {
    ...admin,
    user: {
      ...admin.user,
      id: 'a7043156-0670-4000-8000-000000000001',
      phone: '+917043156067',
      user_metadata: { phone: '+917043156067', full_name: 'Audit Customer', email: null },
    },
  };
  await page.evaluate((s) => localStorage.setItem('gharkaswad_dev_session', JSON.stringify(s)), cust);
  await page.goto(`http://localhost:8081/tracking/${uuid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '07-order-tracking.png') });
  console.log('tracking saved');

  await page.goto(`http://localhost:8081/review/${uuid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, '08-order-review.png') });
  console.log('review saved');
}

await browser.close();
