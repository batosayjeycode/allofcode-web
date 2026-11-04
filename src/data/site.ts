/**
 * Site-wide configuration. Brand copy, navigation and contact details live here
 * so pages never hardcode them.
 */

export const site = {
  name: 'AllOfCode',
  /** Canonical origin (no trailing slash). astro.config.mjs reads it too. */
  url: 'https://allofcode.com',
  description:
    'A growing collection of practical developer tools, scripts, and experiments, built to make everyday coding work simpler.',
  locale: 'en_US',
  lang: 'en',
  /** Default social preview image (1200×630), served from /public. */
  ogImage: '/og/allofcode.png',
  ogImageAlt: 'AllOfCode: tools, scripts and experiments for developers',
  /**
   * Public contact email. Leave `null` until an official inbox exists:
   * the Contact page and Organization schema only show it when set.
   */
  contactEmail: null as string | null,
  /**
   * Official social profiles (used for Organization `sameAs` and the footer).
   * Add entries only for profiles that actually exist.
   */
  socialProfiles: [] as { label: string; url: string }[],
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Primary navigation. Scripts and Labs have no published content yet, so they
 * point at their homepage sections instead of empty directory pages.
 */
export const primaryNav: NavItem[] = [
  { label: 'Tools', href: '/tools/' },
  { label: 'Scripts', href: '/#scripting' },
  { label: 'Labs', href: '/#labs' },
  { label: 'About', href: '/about/' },
];

export const legalNav: NavItem[] = [
  { label: 'Privacy', href: '/privacy/' },
  { label: 'Terms', href: '/terms/' },
  { label: 'Contact', href: '/contact/' },
];
