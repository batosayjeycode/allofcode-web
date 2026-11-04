/**
 * Regenerates raster brand assets in /public from the SVG mark and an HTML template.
 * Run manually after changing the logo or OG design: `node scripts/generate-brand-assets.mjs`.
 * Fonts are Inter and JetBrains Mono (SIL OFL 1.1) from node_modules.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = `${root}public`;
const svg = await readFile(`${pub}/favicon.svg`);

await mkdir(`${pub}/brand`, { recursive: true });
await mkdir(`${pub}/og`, { recursive: true });

// Icons: the mark on the brand background, full-bleed for touch icons.
await sharp(svg, { density: 384 }).resize(32, 32).png().toFile(`${pub}/favicon-32.png`);
async function writeIcon(size, file) {
  const mark = await sharp(svg, { density: 1200 })
    .resize(Math.round(size * 0.78))
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#090D12' } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(file);
}
await writeIcon(180, `${pub}/apple-touch-icon.png`);
await writeIcon(512, `${pub}/brand/allofcode-logo-512.png`);

// Open Graph image (1200x630).
// Inline the fonts: pages created with setContent cannot load file:// URLs.
const fontData = async (pkg, file) => {
  const buf = await readFile(`${root}node_modules/@fontsource-variable/${pkg}/files/${file}`);
  return `data:font/woff2;base64,${buf.toString('base64')}`;
};
const interUrl = await fontData('inter', 'inter-latin-wght-normal.woff2');
const monoUrl = await fontData('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2');
const html = `<!doctype html><html><head><style>
@font-face{font-family:Inter;src:url(${interUrl}) format('woff2');font-weight:100 900}
@font-face{font-family:Mono;src:url(${monoUrl}) format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#090D12;color:#E8F0F5;font-family:Inter;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background:
 radial-gradient(700px 360px at 85% 0%,rgba(76,201,240,.14),transparent 70%),
 radial-gradient(600px 340px at 0% 0%,rgba(72,242,154,.12),transparent 70%),
 linear-gradient(rgba(154,170,183,.07) 1px,transparent 1px) 0 0/48px 48px,
 linear-gradient(90deg,rgba(154,170,183,.07) 1px,transparent 1px) 0 0/48px 48px}
.wrap{position:relative;padding:72px 80px;height:100%;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:18px;font-weight:700;font-size:38px;letter-spacing:-.02em}
.brand svg{width:56px;height:56px}.of{color:#48F29A}
.eyebrow{margin-top:auto;font-family:Mono;font-size:22px;letter-spacing:.14em;color:#48F29A;text-transform:uppercase}
.eyebrow span{color:#7B8C99}
h1{margin-top:18px;font-size:76px;line-height:1.02;letter-spacing:-.035em;font-weight:700;max-width:980px}
.g{background:linear-gradient(100deg,#48F29A 10%,#4CC9F0 90%);-webkit-background-clip:text;color:transparent}
.foot{margin-top:40px;display:flex;justify-content:space-between;font-family:Mono;font-size:22px;color:#9AAAB7}
.foot b{color:#48F29A;font-weight:500}
</style></head><body><div class="grid"></div><div class="wrap">
<div class="brand">${svg.toString()}<span>All<span class="of">Of</span>Code</span></div>
<p class="eyebrow"><span>// </span>Developer workbench</p>
<h1>Tools, Scripts &amp; Experiments for <span class="g">Developers.</span></h1>
<div class="foot"><span>allofcode.com</span><span><b>●</b> SQL Compare is live</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${pub}/og/allofcode.png` });
await browser.close();
console.log('Brand assets written to public/');
