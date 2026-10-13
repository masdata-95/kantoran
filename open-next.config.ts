// Konfigurasi OpenNext untuk Cloudflare.
// App ini tidak memakai ISR/revalidate, jadi halaman statis (○ di output build) cukup disajikan
// dari hasil prerender yang ikut di-upload sebagai static assets — tidak dirender ulang tiap
// request. Tanpa ini setiap halaman memakan 50-470 ms CPU per request (terukur 13 Okt 2026),
// jauh di atas batas Workers Free (10 ms).
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // Sajikan halaman dari cache sebelum memuat server Next.js (hemat CPU cold start)
  enableCacheInterception: true,
})
