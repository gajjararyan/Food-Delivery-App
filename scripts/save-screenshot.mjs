/**
 * Save a base64 PNG from CDP Page.captureScreenshot to docs/screenshots/...
 * Usage: node scripts/save-screenshot.mjs <relative-path.png> <base64>
 */
import fs from 'fs';
import path from 'path';

const rel = process.argv[2];
const b64 = process.argv[3];
if (!rel || !b64) {
  console.error('Usage: node scripts/save-screenshot.mjs <rel.png> <base64>');
  process.exit(1);
}
const out = path.join(process.cwd(), 'docs', 'screenshots', rel);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('saved', out, fs.statSync(out).size, 'bytes');
