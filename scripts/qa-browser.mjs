/**
 * Browser QA against the production build (run `npm run build` first):
 * accessibility (axe, WCAG 2.1 AA), responsive overflow, console errors,
 * mobile navigation, no-JS fallback, 404 status, layout shift / LCP, and
 * external link status. Screenshots go to qa-report/.
 *
 * Usage: npm run qa            (all checks)
 *        npm run qa -- --offline  (skip external link checks)
 */
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { serveDist } from './lib/static-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4329;
const BASE = `http://localhost:${PORT}`;
const offline = process.argv.includes('--offline');
const outDir = join(root, 'qa-report');
await mkdir(outDir, { recursive: true });

const PAGES = [
  '/',
  '/tools/',
  '/tools/sql-compare/',
  '/about/',
  '/contact/',
  '/privacy/',
  '/terms/',
];
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ---------- Server (mimics Cloudflare Pages routing) ----------
const server = await serveDist(join(root, 'dist'), PORT);

const browser = await chromium.launch();

try {
  // ---------- Per page × viewport ----------
  for (const vp of VIEWPORTS) {
    console.log(`\n[${vp.name} ${vp.width}×${vp.height}]`);
    const context = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));

      const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
      if (res?.status() !== 200) fail(`${path} returned ${res?.status()}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0) fail(`${path} overflows horizontally by ${overflow}px`);

      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      for (const v of axe.violations) {
        fail(`${path} axe ${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
        for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
      }

      if (errors.length) fail(`${path} console/network errors: ${errors.join(' | ')}`);
      if (!overflow && !axe.violations.length && !errors.length) {
        pass(`${path}: no overflow, 0 axe violations, no console errors`);
      }

      const slug = path === '/' ? 'home' : path.replaceAll('/', '-').replace(/^-|-$/g, '');
      // Scroll through so lazy-loaded images are present in the full-page capture.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(outDir, `${vp.name}-${slug}.png`), fullPage: true });
      await page.close();
    }
    await context.close();
  }

  // ---------- Mobile navigation ----------
  console.log('\n[mobile navigation]');
  {
    const before = failures.length;
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await context.newPage();
    await page.goto(BASE + '/');
    const toggle = page.locator('[data-nav-toggle]');
    const link = page.locator('#site-nav').getByRole('link', { name: 'About' });
    if (!(await toggle.isVisible())) fail('menu button not visible on mobile');
    if (await link.isVisible()) fail('menu should start closed');
    await toggle.click();
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') fail('aria-expanded not true');
    if (!(await link.isVisible())) fail('links not visible after opening');
    await page.keyboard.press('Escape');
    if ((await toggle.getAttribute('aria-expanded')) !== 'false') fail('Escape did not close');
    const focused = await page.evaluate(() =>
      document.activeElement?.hasAttribute('data-nav-toggle'),
    );
    if (!focused) fail('focus did not return to menu button');
    // Keyboard-only open
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const firstLink = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (firstLink !== 'Tools') fail(`Tab after opening should reach "Tools", got "${firstLink}"`);
    await page.screenshot({ path: join(outDir, 'mobile-nav-open.png') });
    if (failures.length === before) {
      pass('toggle, aria-expanded, Escape, focus return and keyboard order');
    }
    await context.close();
  }

  // ---------- No-JS fallback ----------
  console.log('\n[no JavaScript]');
  {
    const context = await browser.newContext({
      viewport: { width: 360, height: 780 },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto(BASE + '/');
    const visible = await page
      .locator('#site-nav')
      .getByRole('link', { name: 'Tools' })
      .isVisible();
    if (!visible) fail('nav links hidden without JavaScript');
    else pass('navigation stays usable without JavaScript');
    const h1 = await page.locator('h1').textContent();
    if (!h1?.includes('Developers')) fail('hero H1 not rendered without JS');
    await page.screenshot({ path: join(outDir, 'mobile-no-js.png') });
    await context.close();
  }

  // ---------- 404 ----------
  console.log('\n[404]');
  {
    const page = await browser.newPage();
    const res = await page.goto(BASE + '/definitely-not-a-page/');
    if (res?.status() !== 404) fail(`unknown path returned ${res?.status()}, expected 404`);
    else pass('unknown path returns 404 with the custom page');
    const redirect = await fetch(BASE + '/tools', { redirect: 'manual' });
    if (redirect.status !== 308 || redirect.headers.get('location') !== '/tools/') {
      fail('/tools should redirect to /tools/');
    } else pass('/tools redirects to the canonical /tools/');
    await page.close();
  }

  // ---------- Layout shift & LCP (throttled mobile) ----------
  console.log('\n[web vitals, simulated slow 4G / 4x CPU]');
  for (const path of ['/', '/tools/sql-compare/']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__lcp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.__lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const { cls, lcp } = await page.evaluate(() => ({ cls: window.__cls, lcp: window.__lcp }));
    const msg = `${path}: CLS ${cls.toFixed(3)}, LCP ${Math.round(lcp)} ms`;
    if (cls > 0.1) fail(`${msg} (CLS above 0.1)`);
    else if (lcp > 2500) fail(`${msg} (LCP above 2.5 s)`);
    else pass(msg);
    await context.close();
  }

  // ---------- External links ----------
  if (!offline) {
    console.log('\n[external links]');
    const dist = join(root, 'dist');
    const htmlFiles = [];
    const walk = async (dir) => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (p.endsWith('.html')) htmlFiles.push(p);
      }
    };
    await walk(dist);
    const urls = new Set();
    for (const f of htmlFiles) {
      const html = await readFile(f, 'utf8');
      for (const [, href] of html.matchAll(/<a\b[^>]*\shref="(https?:[^"]+)"/g)) urls.add(href);
    }
    for (const url of urls) {
      try {
        const res = await fetch(url, { redirect: 'follow' });
        if (res.status >= 400) fail(`${url} → ${res.status}`);
        else pass(`${url} → ${res.status}`);
      } catch (e) {
        fail(`${url} → ${e.message}`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nScreenshots: ${outDir}`);
if (failures.length) {
  console.log(`\n${failures.length} problem(s) found.`);
  process.exit(1);
}
console.log('\nAll browser QA checks passed.');
