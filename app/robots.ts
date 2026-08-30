import type { MetadataRoute } from 'next';

const BASE_URL = 'https://chineduwilliams739-commits.github.io/eduwills';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
