'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'

// Penangkap error browser (Sentry-lite first-party): JS error + promise rejection
// dikirim sebagai event 'client_error' → tampil di dashboard /admin.
// Dibatasi 5 error per sesi di lib/track.ts supaya loop error tidak membanjiri.
export default function ClientMonitor() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => track('client_error', {
      message: String(e.message || '').slice(0, 300),
      source: `${e.filename || ''}:${e.lineno || 0}`,
      path: window.location.pathname,
    })
    const onRej = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string } | string | undefined
      track('client_error', {
        message: String(typeof reason === 'object' ? reason?.message || 'rejection' : reason || 'rejection').slice(0, 300),
        path: window.location.pathname,
        kind: 'unhandledrejection',
      })
    }
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])
  return null
}
