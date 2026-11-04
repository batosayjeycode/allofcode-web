// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/data/site.ts';

export default defineConfig({
  // Canonical origin (src/data/site.ts). Canonical URLs, sitemap and JSON-LD use it.
  site: site.url,
  // One URL per page: /tools/ (directory style). Cloudflare Pages redirects /tools -> /tools/.
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The CSS is small (~7 KB gzipped); inlining it removes render-blocking requests.
    inlineStylesheets: 'always',
  },
  output: 'static',
  compressHTML: true,
  integrations: [
    sitemap({
      // 404 is not an indexable page.
      filter: (page) => !page.includes('/404'),
    }),
  ],
  prefetch: false,
  vite: {
    build: {
      // Emit scripts as files instead of inlining them, so the CSP can stay
      // `script-src 'self'` with no 'unsafe-inline' (see public/_headers).
      assetsInlineLimit: 0,
    },
  },
});
