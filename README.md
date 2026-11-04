# AllOfCode.com

The brand site for **AllOfCode: Tools, Scripts & Experiments for Developers**.

A static [Astro](https://astro.build) site: every page is pre-rendered HTML, the only JavaScript is
a ~0.7 KB mobile-menu script, and CSS is inlined. It is deployed separately from
[SQL Compare](https://sql-compare.allofcode.com/), which lives in its own repository and Cloudflare
Pages project and is only linked from here.

See [PLAN_ALLOFCODE_LANDING_PAGE.md](./PLAN_ALLOFCODE_LANDING_PAGE.md) for the product, UX and SEO
plan.

## Requirements

- Node **22.23.4** or newer (Astro 7). The version is pinned in `.nvmrc`: run `nvm use`.

## Commands

| Command                | What it does                                                                     |
| ---------------------- | -------------------------------------------------------------------------------- |
| `npm install`          | Install dependencies                                                             |
| `npm run dev`          | Dev server at http://localhost:4321                                              |
| `npm run build`        | Production build to `dist/`                                                      |
| `npm run preview`      | Serve `dist/` locally (`npx astro preview stop` stops it)                        |
| `npm run format:check` | Prettier                                                                         |
| `npm run lint`         | ESLint (TypeScript + Astro)                                                      |
| `npm run typecheck`    | `astro check`                                                                    |
| `npm test`             | SEO and integrity tests against `dist/` (build first)                            |
| `npm run check`        | All of the above, in order                                                       |
| `npm run qa`           | Browser QA on `dist/` (needs `npx playwright install chromium` once). See below. |

`npm test` checks every built page for: one H1 and no skipped heading levels; unique titles and
descriptions; canonical, Open Graph and Twitter tags; valid JSON-LD (Organization, WebSite,
WebApplication, BreadcrumbList, CollectionPage) whose URLs exist; a sitemap that lists exactly
the indexable pages; `robots.txt`; internal links and `#anchors`; image `alt` and dimensions;
no inline scripts (CSP); the `*.pages.dev` noindex header; and no placeholder or fake-proof copy.

`npm run qa` serves `dist/` with Pages-like routing and checks, at 360 px, 768 px and 1440 px:
axe-core (WCAG 2.1 AA), horizontal overflow, console errors, mobile menu keyboard behaviour,
the no-JavaScript fallback, the 404 status, the `/path` → `/path/` redirect, CLS and LCP under
throttling, and external link status. Use `npm run qa -- --offline` to skip the external links.
Full-page screenshots go to `qa-report/`.

## Project structure

```text
public/
  _headers                 Cloudflare Pages headers: CSP, security, caching, pages.dev noindex
  robots.txt               Allows all; points to the sitemap
  favicon.svg, og/, brand/ Icons, social image, logo (regenerate: node scripts/generate-brand-assets.mjs)
src/
  data/site.ts             Brand, canonical origin, navigation, contact, social profiles
  data/tools.ts            Registry of live tools (feeds homepage, /tools/, footer, 404)
  lib/seo.ts               JSON-LD builders and absolute URLs
  styles/tokens.css        Design tokens (colour, type, spacing, motion)
  styles/global.css        Reset, fonts, layout primitives, buttons, chips, prose
  layouts/BaseLayout.astro Document shell: SEO head, skip link, header, footer
  components/seo/          SeoHead (title, description, canonical, OG/Twitter, JSON-LD)
  components/layout/       SiteHeader (accessible mobile menu), SiteFooter, Breadcrumbs
  components/home/         Homepage sections
  components/tools/        ToolCard, SqlCompareShot
  components/ui/           Logo, WindowFrame, SectionHeading, PageHero
  assets/sql-compare/      Real screenshots of the live app (optimised to AVIF/WebP at build)
  pages/                   /, /tools/, /tools/sql-compare/, /about/, /contact/, /privacy/, /terms/, 404
tests/dist.test.mjs        Build output tests (node:test)
scripts/qa-browser.mjs     Browser QA (Playwright + axe-core)
```

### Adding a tool

1. Add an entry to `src/data/tools.ts`, but only once the tool is live. Every claim must be
   verifiable in the tool's source.
2. Create `src/pages/tools/<slug>/index.astro` with original content (see the SQL Compare page:
   what it does, input, how-to, results, limitations, privacy, questions).
3. Add the new route to the `expected routes are built` test.

The homepage, tools directory, footer, sitemap and structured data pick the new tool up
automatically.

### Scripts, Labs and guides

There is no `/scripts/`, `/labs/` or guides route yet, on purpose: the plan says to publish them
only when there is real, tested content. Navigation points to the homepage sections
(`/#scripting`, `/#labs`) until then. When the first scripts are ready, add an Astro content
collection in `src/content/`, create the directory and detail pages, and point the nav at them.

## Deploying to Cloudflare Pages

This site is a **separate Pages project** from SQL Compare (`sql-compare`). Nothing here changes
the `sql-compare.allofcode.com` DNS record or that project's settings.

### 1. Create the project (once)

Deployment runs from GitHub Actions (`.github/workflows/ci.yml`), the same way as SQL Compare:
`check` (format, lint, typecheck, build, tests), then `qa` (browser QA on that build), then
`deploy`, which runs `wrangler pages deploy` with the tested `dist/`. Deploy only runs on a push to
`main`; pull requests run the checks only.

1. Create a **Direct Upload** Pages project named `allofcode-web` (Workers & Pages → Create →
   Pages → Upload assets), or run `npx wrangler pages project create allofcode-web
--production-branch=main`. Don't connect it to Git, or every push would deploy twice.
2. Add the repository secrets `CLOUDFLARE_API_TOKEN` (a token with the _Cloudflare Pages: Edit_
   permission) and `CLOUDFLARE_ACCOUNT_ID`. If this repo is in the same GitHub account as SQL
   Compare, the same token works.

Preview and `*.pages.dev` URLs send `X-Robots-Tag: noindex` (see `public/_headers`), so only the
custom domain is indexed.

To deploy by hand: `npm run build && npx wrangler pages deploy dist --project-name=allofcode-web`.
Add `--branch=preview` for a preview deployment instead of production.

### 2. Custom domains

`allofcode.com` currently resolves to a non-Cloudflare host (`2.57.91.91`, served by a Hostinger
CDN) and `www.allofcode.com` is a CNAME to the apex. Moving them is a DNS change, so do it
deliberately:

1. In the Pages project → Custom domains, add `allofcode.com`. Cloudflare will tell you which DNS
   record to create or replace for the apex. Only touch the `allofcode.com` and
   `www.allofcode.com` records. **Leave `sql-compare.allofcode.com` as it is.**
2. Add `www.allofcode.com` as a custom domain too, so it has a valid certificate.
3. Redirect `www` to the apex (the canonical host). Pages `_redirects` can't match on hostname,
   so use a zone-level rule: Rules → Redirect Rules → "Redirect from WWW to root" template, or a
   rule with: hostname equals `www.allofcode.com` → dynamic redirect to
   `concat("https://allofcode.com", http.request.uri.path)`, status 301, preserve query string.
4. SSL/TLS → Edge Certificates → turn on **Always Use HTTPS** (HTTP → HTTPS 301).

### 3. After the first deploy

- Check: `curl -I https://allofcode.com/` returns 200 with the `content-security-policy` header;
  `curl -I https://www.allofcode.com/` returns 301 to the apex; `curl -I https://allofcode.com/tools`
  returns 308 to `/tools/`; an unknown path returns 404.
- Check that https://sql-compare.allofcode.com/ still works.
- Google Search Console: add a Domain property for `allofcode.com`, submit
  `https://allofcode.com/sitemap-index.xml`, and request indexing for `/` and
  `/tools/sql-compare/`.
- Validate structured data with the [Rich Results Test](https://search.google.com/test/rich-results)
  and the [Schema Markup Validator](https://validator.schema.org/).

## Content rules

- List only live tools. No "coming soon" cards, invented metrics or testimonials (tests enforce
  some of this).
- Verify product claims against the product's source before publishing.
- If analytics, cookies, forms or third-party scripts are ever added, update `/privacy/` first, and
  extend the CSP in `public/_headers`.
- Fonts are Inter and JetBrains Mono, both SIL OFL 1.1, self-hosted via Fontsource. Fallback stacks
  use only CSS keywords.
