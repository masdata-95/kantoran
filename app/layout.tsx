import type { Metadata, Viewport } from 'next'
import './globals.css'
import ClientMonitor from '@/components/ClientMonitor'

const SITE_URL = 'https://kantoran.vercel.app' // ganti ke https://kantoran.id saat cutover domain

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Kantoran | Simulasi Dunia Kerja',
  description: 'Simulasi dunia kerja pertama yang terasa nyata. Belajar kerja, sambil kerja beneran.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
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
  maximumScale: 1,
  // cegah browser mobile auto-zoom saat fokus ke input
  userScalable: false,
  themeColor: '#0F6E56',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        <ClientMonitor />
        {children}
      </body>
    </html>
  )
}
