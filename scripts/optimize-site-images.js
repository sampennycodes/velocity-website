import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// Run only when source artwork changes. Commit these outputs so site publishing
// reuses them without doing image conversions during each content build.
await mkdir('public/optimized', { recursive: true });
const assets = {};
for (const [name, widths, quality] of [
  ['img_8071', [480, 800, 1200], 84],
  ['logo', [520], 90],
  ['google-g', [96], 90],
  ['linkedin-in-white', [96], 90],
]) {
  const variants = [];
  for (const width of widths) {
    const data = await sharp(`public/${name}.png`).resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const src = `/optimized/${name}-${width}-${hash}.webp`;
    await writeFile(`public${src}`, data);
    variants.push({ src, width });
    console.log(`${name} ${width}px: ${Math.round(data.length / 1024)} KB`);
  }
  assets[`/${name}.png`] = {
    src: variants.find(v => v.width === 800)?.src || variants.at(-1).src,
    ...(variants.length > 1 ? { srcset: variants.map(v => `${v.src} ${v.width}w`).join(', ') } : {}),
  };
}
await writeFile('lib/image-assets.json', JSON.stringify(assets, null, 2) + '\n');
