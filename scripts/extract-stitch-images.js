const fs = require('fs');
const path = require('path');

const dir = '.stitch/designs';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
const all = new Set();

for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const decoded = html.replace(/&amp;/g, '&');
  const urls = [...decoded.matchAll(/https?:\/\/[^"'\\s)]+/g)].map((m) => m[0]);
  const filtered = urls.filter(
    (u) =>
      /\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(u) ||
      u.includes('googleusercontent') ||
      u.includes('unsplash') ||
      u.includes('images.') ||
      u.includes('/image'),
  );
  console.log(`\n## ${f}`);
  [...new Set(filtered)].forEach((u) => {
    all.add(u);
    console.log(u.slice(0, 160));
  });
  console.log('count', new Set(filtered).size);

  // Also dump a small slice of HTML structure keywords
  const classes = [...decoded.matchAll(/class="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((c) => /hero|image|img|bg-|rounded|gradient/.test(c))
    .slice(0, 20);
  console.log('layout hints', classes.slice(0, 10));
}

fs.writeFileSync('.stitch/image-urls.json', JSON.stringify([...all], null, 2));
console.log('\nTOTAL', all.size);
