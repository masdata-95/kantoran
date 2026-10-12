import type { Metadata } from 'next'

// page.tsx adalah client component (tidak bisa export metadata), jadi metadata di sini
export const metadata: Metadata = {
  title: 'Masuk ke Simulasi | Kantoran',
  description: 'Masuk dengan Google untuk memulai hari pertamamu di PT Vantara Nusantara: interview HR, nego gaji, offering letter, dan task Excel dari supervisor.',
  alternates: { canonical: '/simulator' },
}

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return children
}
