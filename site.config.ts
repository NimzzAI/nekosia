type Env = Record<string, string | undefined>;

function resolveSiteUrl(env: Env): string {
  const fromEnv = env.VITE_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export function createSiteConfig(env: Env) {
  return {
    url: resolveSiteUrl(env),
    name: 'Nekosia Archive Deck',
    shortName: 'Nekosia',
    title: 'Nekosia Archive Deck – Anime Illustration Index & API Explorer',
    description:
      'Explore, filter, inspect full ICC color-profile and artist attribution metadata, and download high-resolution anime illustrations via Nekosia API v1.',
    schemaDescription:
      'Tactile archival explorer and high-resolution image downloader for the Nekosia API v1 with 14-color palette extraction, ICC profile inspection, and session de-duplication.',
    locale: 'en_US',
    language: 'en',
    author: 'Nimzz',
    keywords: [
      'Nekosia',
      'Nekosia API',
      'Nekosia Archive Deck',
      'anime illustration',
      'anime image downloader',
      'catgirl',
      'kemonomimi',
      'anime gacha',
      'color palette extractor',
      'ICC color profile',
      'API explorer',
      'Nimzz',
    ],
    themeColor: { light: '#f7f3e8', dark: '#182329' },
    ogImage: {
      path: '/og-image.jpg',
      width: 1200,
      height: 630,
      type: 'image/jpeg',
      alt: 'Nekosia Archive Deck preview',
    },
    links: {
      github: 'https://github.com/NimzzAI',
    },
    googleSiteVerification: env.GOOGLE_SITE_VERIFICATION || '',
  };
}

export type SiteConfig = ReturnType<typeof createSiteConfig>;
