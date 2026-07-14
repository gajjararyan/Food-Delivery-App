const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const designsDir = '.stitch/designs';
const outDir = path.join('assets', 'stitch', 'images');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(designsDir).filter((f) => f.endsWith('.html'));
const images = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(designsDir, file), 'utf8');
  const re = /<img[^>]*src="(https:\/\/lh3\.googleusercontent\.com[^"]+)"[^>]*(?:data-alt="([^"]*)")?/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    images.push({
      screen: file.replace('.html', ''),
      url: m[1],
      alt: (m[2] || 'image').slice(0, 80),
    });
  }
  // also style backgrounds
  const bg = /url\('(https:\/\/lh3\.googleusercontent\.com[^']+)'\)/g;
  while ((m = bg.exec(html)) !== null) {
    images.push({ screen: file.replace('.html', ''), url: m[1], alt: 'background' });
  }
}

const unique = [];
const seen = new Set();
for (const img of images) {
  if (seen.has(img.url)) continue;
  seen.add(img.url);
  unique.push(img);
}

console.log(`Found ${unique.length} unique images`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(err);
      });
  });
}

async function main() {
  const manifest = {};
  let i = 0;
  for (const img of unique) {
    i += 1;
    const slug = `${img.screen}-${String(i).padStart(2, '0')}.jpg`;
    const dest = path.join(outDir, slug);
    process.stdout.write(`Downloading ${slug}... `);
    try {
      await download(img.url, dest);
      const size = fs.statSync(dest).size;
      console.log(`${size} bytes`);
      if (!manifest[img.screen]) manifest[img.screen] = [];
      manifest[img.screen].push({
        file: `assets/stitch/images/${slug}`,
        alt: img.alt,
        url: img.url,
      });
    } catch (e) {
      console.log(`FAIL ${e.message}`);
    }
  }
  fs.writeFileSync('.stitch/image-manifest.json', JSON.stringify(manifest, null, 2));
  console.log('Wrote .stitch/image-manifest.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
