import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import ClientMonitor from '@/components/ClientMonitor'

const SITE_URL = 'https://kantoran.id'

// Satu keluarga huruf: Plex terasa seperti dokumen kantor (bukan template landing
// page generik). Mono hanya untuk angka/kode: nomor task, nama file, query SQL.
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Kantoran | Simulasi Dunia Kerja',
  description: 'Simulasi dunia kerja pertama yang terasa nyata. Belajar kerja, sambil kerja beneran.',
  // Raster kelipatan 48px untuk Google (favicon di hasil pencarian) + SVG untuk tab browser
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon-96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  // Open Graph: tanpa ini, share ke WhatsApp/LinkedIn cuma URL telanjang
  openGraph: {
    type: 'website',
    siteName: 'Kantoran',
    locale: 'id_ID',
    url: SITE_URL,
    title: 'Kantoran | Simulasi Dunia Kerja',
    description: 'Diinterview HR, nego gaji, kerjakan task beneran. Rasakan hari pertama kerja sebelum hari pertamamu yang sesungguhnya.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Kantoran, simulasi dunia kerja' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kantoran | Simulasi Dunia Kerja',
    description: 'Diinterview HR, nego gaji, kerjakan task beneran. Belajar kerja, sambil kerja beneran.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom TIDAK dikunci (aksesibilitas). Auto-zoom iOS saat fokus input dicegah
  // dengan font input >= 16px di mobile (lihat globals.css), bukan userScalable.
  themeColor: '#0F6E56',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plex.variable} ${plexMono.variable}`}>
      <body className="font-sans">
        <ClientMonitor />
        {children}
      </body>
    </html>
  )
}
