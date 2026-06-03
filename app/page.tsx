'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to landing HTML
    window.location.href = '/landing.html'
  }, [])

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#FAFAF7',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: 8, height: 8, borderRadius: '50%', 
          background: '#0F6E56', margin: '0 auto 12px',
          animation: 'pulse 1s infinite'
        }}></div>
        <p style={{ color: '#888780', fontSize: 14 }}>Memuat Kantoran...</p>
      </div>
    </div>
  )
}
