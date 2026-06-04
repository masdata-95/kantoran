import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kantoran — Simulasi Dunia Kerja',
  description: 'Simulasi dunia kerja pertama yang terasa nyata. Belajar kerja, sambil kerja beneran.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
