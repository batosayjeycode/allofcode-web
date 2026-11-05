/**
 * SEO and integrity checks against the production build in dist/.
 * Run `npm run build` first, then `npm test`.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://allofcode.com';
const dist = fileURLToPath(new URL('../dist', import.meta.url));

assert.ok(existsSync(dist), 'dist/ is missing: run `npm run build` first');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** URL path for a built HTML file: dist/tools/index.html -> /tools/ */
function urlPath(file) {
  const rel = relative(dist, file).replaceAll('\\', '/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404/';
  return `/${rel.replace(/index\.html$/, '')}`;
}

const pages = walk(dist)
  .filter((f) => f.endsWith('.html'))
  .map((file) => ({ file, path: urlPath(file), html: readFileSync(file, 'utf8') }));

const indexable = pages.filter((p) => !/<meta name="robots" content="noindex"/.test(p.html));

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const meta = (html, key) => {
  const tag = html.match(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*"[^>]*>`))?.[0];
  return tag && attr(tag, 'content');
};
const decode = (s) =>
  s
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
const fileForPath = (p) => {
  const clean = p.split(/[?#]/)[0];
  if (clean.endsWith('/')) return join(dist, clean, 'index.html');
  return join(dist, clean);
};

describe('pages', () => {
  test('expected routes are built', () => {
    const paths = pages.map((p) => p.path).sort();
    assert.deepEqual(paths, [
      '/',
      '/404/',
      '/about/',
      '/contact/',
      '/privacy/',
      '/terms/',
      '/tools/',
      '/tools/sql-compare/',
    ]);
  });

  for (const page of pages) {
    describe(page.path, () => {
      test('has lang, one h1 and no skipped heading levels', () => {
        assert.match(page.html, /<html lang="en"/);
        const levels = [...page.html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
        assert.equal(levels.filter((l) => l === 1).length, 1, 'exactly one h1');
        assert.equal(levels[0], 1, 'h1 comes first');
        // Footer headings are h2 nav labels; check only within <main>.
        const main = page.html.match(/<main[\s\S]*<\/main>/)[0];
        const mainLevels = [...main.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
        for (let i = 1; i < mainLevels.length; i++) {
          assert.ok(
            mainLevels[i] <= mainLevels[i - 1] + 1,
            `heading jumps from h${mainLevels[i - 1]} to h${mainLevels[i]}`,
          );
        }
      });

      test('has a title and a description of sensible length', () => {
        const title = page.html.match(/<title>([^<]+)<\/title>/)?.[1];
        assert.ok(title, 'title');
        assert.ok(title.length <= 65, `title too long (${title.length}): ${title}`);
        const description = meta(page.html, 'description');
        assert.ok(description, 'description');
        const len = decode(description).length;
        assert.ok(len >= 70 && len <= 160, `description length ${len}`);
      });

      test('images have alt text and dimensions', () => {
        for (const [tag] of page.html.matchAll(/<img\b[^>]*>/g)) {
          assert.ok(attr(tag, 'alt')?.length > 10, `img without useful alt: ${tag.slice(0, 80)}`);
          assert.ok(attr(tag, 'width') && attr(tag, 'height'), 'img needs width and height');
        }
      });

      test('web fonts use font-display: optional and are preloaded (no swap layout shift)', () => {
        const displays = [...page.html.matchAll(/font-display:\s*([a-z]+)/g)].map((m) => m[1]);
        assert.ok(displays.length > 0, 'no @font-face found');
        assert.ok(
          displays.every((d) => d === 'optional'),
          `font-display values: ${displays.join(', ')}`,
        );
        const fontUrls = new Set(
          [...page.html.matchAll(/url\((\/_astro\/[^)]+\.woff2)\)/g)].map((m) => m[1]),
        );
        for (const [, href] of page.html.matchAll(
          /<link rel="preload" href="([^"]+)" as="font"/g,
        )) {
          assert.ok(fontUrls.has(href), `preloaded font not used by CSS: ${href}`);
        }
      });

      test('has no inline executable scripts (CSP script-src self)', () => {
        for (const [tag] of page.html.matchAll(/<script\b[^>]*>/g)) {
          const type = attr(tag, 'type');
          if (type === 'application/ld+json') continue;
          assert.ok(attr(tag, 'src'), `inline script found: ${tag}`);
        }
      });

      test('internal links and anchors resolve', () => {
        for (const [, href] of page.html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
          if (/^(https?:|mailto:)/.test(href)) continue;
          const [path, hash] = href.split('#');
          if (path === '') {
            assert.match(page.html, new RegExp(`id="${hash}"`), `missing anchor ${href}`);
            continue;
          }
          const targetPath = path;
          assert.ok(targetPath.startsWith('/'), `relative link ${href}`);
          if (!/\.[a-z0-9]+$/.test(targetPath)) {
            assert.ok(targetPath.endsWith('/'), `missing trailing slash: ${href}`);
          }
          const file = fileForPath(targetPath);
          assert.ok(existsSync(file), `broken link ${href} on ${page.path}`);
          if (hash) {
            const target = readFileSync(file, 'utf8');
            assert.match(target, new RegExp(`id="${hash}"`), `missing anchor #${hash}`);
          }
        }
      });

      test('referenced local assets exist', () => {
        for (const [, src] of page.html.matchAll(/\s(?:src|href)="(\/[^"#?]+\.[a-z0-9]+)"/g)) {
          assert.ok(existsSync(join(dist, src)), `missing asset ${src}`);
        }
        for (const [, set] of page.html.matchAll(/srcset="([^"]+)"/g)) {
          for (const candidate of set.split(',')) {
            const url = candidate.trim().split(/\s+/)[0];
            assert.ok(existsSync(join(dist, url)), `missing srcset asset ${url}`);
          }
        }
      });
    });
  }
});

describe('canonical and social metadata', () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const page of indexable) {
    test(`${page.path} canonical, Open Graph and Twitter`, () => {
      const canonical = page.html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      assert.equal(canonical, `${ORIGIN}${page.path}`);
      assert.equal(meta(page.html, 'og:url'), canonical);
      assert.ok(meta(page.html, 'og:title'));
      assert.ok(meta(page.html, 'og:description'));
      assert.equal(meta(page.html, 'twitter:card'), 'summary_large_image');
      const image = meta(page.html, 'og:image');
      assert.ok(image.startsWith(`${ORIGIN}/`), 'og:image must be absolute');
      assert.ok(existsSync(join(dist, new URL(image).pathname)), 'og:image file exists');

      const title = page.html.match(/<title>([^<]+)<\/title>/)[1];
      assert.ok(!titles.has(title), `duplicate title: ${title}`);
      titles.add(title);
      const description = meta(page.html, 'description');
      assert.ok(!descriptions.has(description), 'duplicate description');
      descriptions.add(description);
    });
  }

  test('404 page is noindex and has no canonical', () => {
    const notFound = pages.find((p) => p.path === '/404/');
    assert.match(notFound.html, /<meta name="robots" content="noindex"/);
    assert.doesNotMatch(notFound.html, /rel="canonical"/);
  });
});

describe('structured data', () => {
  const byPath = Object.fromEntries(pages.map((p) => [p.path, jsonLd(p.html)]));
  const types = (path) => byPath[path].flatMap((doc) => doc['@graph'].map((n) => n['@type']));

  test('every JSON-LD block is valid JSON with a schema.org context', () => {
    for (const [path, docs] of Object.entries(byPath)) {
      for (const doc of docs) {
        assert.equal(doc['@context'], 'https://schema.org', path);
        assert.ok(Array.isArray(doc['@graph']) && doc['@graph'].length > 0, path);
      }
    }
  });

  test('homepage has Organization and WebSite', () => {
    assert.deepEqual(types('/').sort(), ['Organization', 'WebSite']);
  });

  test('SQL Compare page has WebApplication and BreadcrumbList', () => {
    assert.deepEqual(types('/tools/sql-compare/').sort(), ['BreadcrumbList', 'WebApplication']);
    const app = byPath['/tools/sql-compare/'][0]['@graph'].find(
      (n) => n['@type'] === 'WebApplication',
    );
    assert.equal(app.url, 'https://sql-compare.allofcode.com/');
    assert.equal(app.applicationCategory, 'DeveloperApplication');
    // Never invent ratings or reviews.
    assert.equal(app.aggregateRating, undefined);
    assert.equal(app.review, undefined);
    assert.ok(existsSync(join(dist, new URL(app.screenshot).pathname)), 'screenshot exists');
  });

  test('nested pages have breadcrumbs pointing at real pages', () => {
    for (const path of ['/tools/', '/tools/sql-compare/', '/about/', '/contact/']) {
      const crumbs = byPath[path]
        .flatMap((d) => d['@graph'])
        .find((n) => n['@type'] === 'BreadcrumbList');
      assert.ok(crumbs, `${path} breadcrumbs`);
      const items = crumbs.itemListElement;
      assert.equal(items.at(-1).item, `${ORIGIN}${path}`);
      items.forEach((item, i) => {
        assert.equal(item.position, i + 1);
        assert.ok(existsSync(fileForPath(new URL(item.item).pathname)), item.item);
      });
    }
  });

  test('Organization logo exists', () => {
    const org = byPath['/'][0]['@graph'].find((n) => n['@type'] === 'Organization');
    assert.ok(existsSync(join(dist, new URL(org.logo.url).pathname)));
  });
});

describe('sitemap and robots', () => {
  const index = readFileSync(join(dist, 'sitemap-index.xml'), 'utf8');
  const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const locs = sitemaps.flatMap((url) => {
    const xml = readFileSync(join(dist, new URL(url).pathname), 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  });

  test('sitemap lists exactly the indexable pages', () => {
    assert.deepEqual(locs.sort(), indexable.map((p) => `${ORIGIN}${p.path}`).sort());
  });

  test('sitemap URLs are canonical (https, apex, trailing slash)', () => {
    for (const loc of locs) assert.match(loc, /^https:\/\/allofcode\.com\/([a-z0-9-]+\/)*$/);
  });

  test('robots.txt allows crawling and references the sitemap', () => {
    const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
    assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);
    assert.match(robots, /^Sitemap: https:\/\/allofcode\.com\/sitemap-index\.xml$/m);
  });
});

describe('hosting configuration', () => {
  const headers = readFileSync(join(dist, '_headers'), 'utf8');

  test('*.pages.dev deployments are noindex', () => {
    assert.match(headers, /https:\/\/:project\.pages\.dev\/\*\s+X-Robots-Tag: noindex/);
    assert.match(headers, /https:\/\/:version\.:project\.pages\.dev\/\*\s+X-Robots-Tag: noindex/);
  });

  test('CSP disallows inline scripts and only allows Cloudflare Web Analytics as a third party', () => {
    const csp = headers.match(/Content-Security-Policy: (.+)/)[1];
    const directive = (name) => csp.match(new RegExp(`(?:^|; )${name} ([^;]+)`))[1].trim();
    assert.equal(directive('script-src'), "'self' https://static.cloudflareinsights.com");
    assert.equal(directive('connect-src'), "'self' https://cloudflareinsights.com");
  });

  test('no redirects that could touch the SQL Compare subdomain', () => {
    assert.ok(
      !existsSync(join(dist, '_redirects')) ||
        !/sql-compare/.test(readFileSync(join(dist, '_redirects'), 'utf8')),
    );
  });
});

describe('content honesty', () => {
  const text = pages.map((p) => p.html.replace(/<[^>]+>/g, ' ')).join(' ');

  test('no placeholder or fake-proof copy', () => {
    for (const phrase of [
      /coming soon/i,
      /lorem ipsum/i,
      /trusted by/i,
      /\d[\d,.]*\+?\s+(users|developers|downloads)/i,
      /military[- ]grade/i,
      /testimonial/i,
    ]) {
      assert.doesNotMatch(text, phrase);
    }
  });
});
