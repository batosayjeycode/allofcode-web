import { site } from '../data/site';
import type { Tool } from '../data/tools';

/** Absolute URL on the canonical origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

export interface Crumb {
  name: string;
  path: string;
}

type JsonLd = Record<string, unknown>;

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;

export function organizationSchema(): JsonLd {
  const sameAs = site.socialProfiles.map((p) => p.url);
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    url: `${site.url}/`,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/brand/allofcode-logo-512.png'),
      width: 512,
      height: 512,
    },
    description: site.description,
    ...(sameAs.length > 0 && { sameAs }),
    ...(site.contactEmail && { email: site.contactEmail }),
  };
}

export function websiteSchema(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: site.name,
    url: `${site.url}/`,
    description: site.description,
    inLanguage: site.lang,
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbSchema(crumbs: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function softwareApplicationSchema(
  tool: Tool,
  opts: { description: string; featureList: string[]; screenshot: string },
): JsonLd {
  return {
    '@type': 'WebApplication',
    '@id': `${absoluteUrl(tool.pagePath)}#software`,
    name: tool.name,
    url: tool.appUrl,
    description: opts.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any (runs in a modern web browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    // Free to use: no account, no payment.
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: opts.featureList,
    screenshot: opts.screenshot,
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: absoluteUrl(tool.pagePath),
  };
}

export function collectionPageSchema(path: string, name: string, tools: Tool[]): JsonLd {
  return {
    '@type': 'CollectionPage',
    '@id': `${absoluteUrl(path)}#page`,
    name,
    url: absoluteUrl(path),
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: tools.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.name,
        url: absoluteUrl(t.pagePath),
      })),
    },
  };
}

/** Wraps nodes in a single @graph document. */
export function graph(...nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
