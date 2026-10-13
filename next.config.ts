import type { NextConfig } from 'next'

const CANONICAL = 'https://kantoran.id'

const nextConfig: NextConfig = {
  experimental: {},
  // Optimasi gambar next/image di Cloudflare Workers butuh binding Cloudflare Images
  // (berbayar per transformasi). Foto kita sudah WebP kecil (20-65 KB) di public/images,
  // jadi disajikan apa adanya — sama di Vercel maupun Cloudflare.
  images: { unoptimized: true },
  // SEO: satu halaman = satu alamat. Tanpa ini landing yang sama tampil di
  // kantoran.id, /landing.html, www.kantoran.id, dan kantoran.vercel.app, sehingga
  // Google memecah sinyal ranking. Redirect host kantoran.vercel.app juga menangkap
  // login Google yang jatuh ke Site URL lama di Supabase (fragment #access_token
  // ikut terbawa browser saat redirect, jadi sesi tetap terbentuk di kantoran.id).
  // Deployment preview (kantoran-xxxx.vercel.app) TIDAK kena — host-nya berbeda.
  async redirects() {
    return [
      { source: '/:path*', has: [{ type: 'host', value: 'www.kantoran.id' }], destination: `${CANONICAL}/:path*`, permanent: true },
      { source: '/:path*', has: [{ type: 'host', value: 'kantoran.vercel.app' }], destination: `${CANONICAL}/:path*`, permanent: true },
      { source: '/landing.html', destination: '/', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
    ]
  },
}

export default nextConfig
