import type { NextConfig } from 'next'

const CANONICAL = 'https://kantoran.id'

const nextConfig: NextConfig = {
  experimental: {},
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
    ]
  },
  // Sajikan landing langsung di / tanpa redirect client-side — tanpa ini user
  // melihat flash "Memuat Kantoran..." dulu (app/page.tsx tetap ada sebagai fallback)
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/landing.html' }],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
