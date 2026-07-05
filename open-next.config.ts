// Konfigurasi OpenNext untuk Cloudflare — default sudah cukup:
// tidak ada ISR/revalidate di app ini, jadi tidak perlu R2 incremental cache.
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig()
