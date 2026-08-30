import type { MetadataRoute } from 'next';

const BASE_URL = 'https://chineduwilliams739-commits.github.io/eduwills';

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = [
    'waec-practice-questions',
    'jamb-utme-practice',
    'neco-exam-preparation',
    'book-quiz-generator',
  ];

  return [
    { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/blog/`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/study-guides/`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/from-chatgpt/`, changeFrequency: 'monthly', priority: 0.8 },
    ...guides.map((slug) => ({
      url: `${BASE_URL}/study-guides/${slug}/`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
