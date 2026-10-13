import { LANDING_HTML } from './landing-html.generated'

// Halaman depan "/" = landing statis (sumber: public/landing.html, disalin saat build oleh
// scripts/embed-landing.mjs). Dulu lewat rewrite ke /landing.html, tapi rewrite ke file public/
// tidak didukung di Cloudflare Workers (OpenNext) → 404. Route statis ini jalan di Vercel & Workers.
export const dynamic = 'force-static'

export function GET() {
  return new Response(LANDING_HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, must-revalidate',
    },
  })
}
