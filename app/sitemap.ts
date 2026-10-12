import type { MetadataRoute } from 'next'

const BASE = 'https://kantoran.id'

// Perbarui LAST_UPDATED saat isi landing berubah berarti
const LAST_UPDATED = new Date('2026-10-13')

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: LAST_UPDATED, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/cv`, lastModified: LAST_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/simulator`, lastModified: LAST_UPDATED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
