import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
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
