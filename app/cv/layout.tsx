import type { Metadata } from 'next'

// page.tsx adalah client component (tidak bisa export metadata), jadi metadata di sini
export const metadata: Metadata = {
  title: 'Cek Skor CV Gratis | Kantoran',
  description: 'Upload CV (PDF atau DOCX) dan dapatkan skor ATS, kekuatan, bagian yang perlu diperbaiki, keyword yang kurang, serta contoh penulisan ulang. Gratis.',
  alternates: { canonical: '/cv' },
}

export default function CvLayout({ children }: { children: React.ReactNode }) {
  return children
}
