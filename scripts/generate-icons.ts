/** Genera icon-192, icon-512, maskable y apple-touch-icon desde el isotipo (fondo --bg, isotipo al 60%). */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = '#0B0F14';
const V = '#2EE59D';

function svg(size: number, scale = 0.6): string {
  const s = size * scale;
  const off = (size - s) / 2;
  const stroke = Math.max(2, (3 / 32) * s);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${off} ${off}) scale(${s / 32})">
    <path d="M8 9 L16 25 L24 9" stroke="${V}" stroke-width="${(stroke * 32) / s}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function main() {
  mkdirSync('public/icons', { recursive: true });
  const jobs: Array<[string, number, number]> = [
    ['public/icons/icon-192.png', 192, 0.6],
    ['public/icons/icon-512.png', 512, 0.6],
    ['public/icons/icon-512-maskable.png', 512, 0.45],
    ['public/icons/apple-touch-icon.png', 180, 0.6],
  ];
  for (const [file, size, scale] of jobs) {
    const png = await sharp(Buffer.from(svg(size, scale))).png().toBuffer();
    writeFileSync(file, png);
    console.log('✓', file);
  }
  writeFileSync('public/icons/ventaja_isotipo_v1.svg', svg(512, 0.6));
  writeFileSync(
    'public/icons/ventaja_logo-wordmark_v1.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80"><text x="0" y="58" font-family="Inter Tight, Inter, system-ui, sans-serif" font-weight="600" font-size="56" letter-spacing="-1.7" fill="#E8ECF1"><tspan fill="${V}">V</tspan>entaja</text></svg>`,
  );
  console.log('✓ SVGs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
