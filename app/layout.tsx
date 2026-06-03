import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kantoran — Simulasi Dunia Kerja',
  description: 'Simulasi dunia kerja pertama yang terasa nyata. Belajar kerja, sambil kerja beneran.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
