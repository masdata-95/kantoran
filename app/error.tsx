'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'

// Error boundary global — pengganti layar putih; error tercatat sebagai client_error
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    track('client_error', {
      message: String(error.message || 'render error').slice(0, 300),
      digest: error.digest,
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      kind: 'error_boundary',
    })
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]" />
          <span className="font-serif text-xl font-bold text-[#111111]">Kantoran</span>
        </div>
        <h1 className="font-serif text-xl font-bold text-[#111111] mb-2">Ada yang error di kantor.</h1>
        <p className="text-sm text-[#888780] leading-relaxed mb-6">
          Bukan salahmu, tim kami sudah menerima laporannya. Progress-mu aman tersimpan.
        </p>
        <button onClick={reset} style={{ cursor: 'pointer' }} className="btn-teal text-sm px-6 py-2.5">
          Coba lagi
        </button>
      </div>
    </div>
  )
}
