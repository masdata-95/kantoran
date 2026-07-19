import type { MetadataRoute } from 'next'

const BASE = 'https://kantoran.vercel.app' // ganti saat cutover ke kantoran.id

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/simulator`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/cv`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
