import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kantoran — Simulasi Dunia Kerja',
  description: 'Simulasi dunia kerja pertama yang terasa nyata. Belajar kerja, sambil kerja beneran.',
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230F6E56'/%3E%3Ccircle cx='50' cy='38' r='16' fill='white' opacity='0.9'/%3E%3Crect x='20' y='60' width='60' height='32' rx='6' fill='white' opacity='0.9'/%3E%3Crect x='30' y='68' width='12' height='16' rx='2' fill='%230F6E56'/%3E%3Crect x='48' y='68' width='12' height='10' rx='2' fill='%230F6E56'/%3E%3Crect x='66' y='68' width='6' height='10' rx='2' fill='%230F6E56'/%3E%3C/svg%3E",
        type: 'image/svg+xml',
      }
    ],
    shortcut: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230F6E56'/%3E%3Ccircle cx='50' cy='38' r='16' fill='white' opacity='0.9'/%3E%3Crect x='20' y='60' width='60' height='32' rx='6' fill='white' opacity='0.9'/%3E%3C/svg%3E",
    apple: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230F6E56'/%3E%3Ccircle cx='50' cy='38' r='16' fill='white' opacity='0.9'/%3E%3Crect x='20' y='60' width='60' height='32' rx='6' fill='white' opacity='0.9'/%3E%3C/svg%3E",
  },
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
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}