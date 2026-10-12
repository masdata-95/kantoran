'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Urutan yang akan dialami user setelah login — ditampilkan apa adanya supaya
// orang tahu berapa lama dan apa yang diminta sebelum menyerahkan akun Google-nya.
const NEXT_STEPS = [
  { title: 'Isi profil singkat', note: 'Sekitar 3 menit. Dipakai HR saat interview.' },
  { title: 'Pilih posisi dan jenjang', note: 'Enam posisi, bisa dicoba bergantian.' },
  { title: 'Interview dengan HR', note: 'Lewat chat, 15 sampai 20 menit, termasuk nego gaji.' },
]

export default function LoginPage() {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setRedirecting(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/simulator` },
    })
    if (error) {
      setRedirecting(false)
      setError('Login Google gagal dibuka. Coba sekali lagi, atau matikan pemblokir pop-up.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 sm:px-8 h-14 flex items-center border-b border-[#E5E3DC] bg-white">
        {/* <a> biasa, bukan <Link>: "/" adalah landing statis (rewrite ke public/landing.html),
            butuh muat ulang penuh — client navigation akan masuk ke app/page.tsx */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-[15px] font-semibold text-[#0F6E56]" style={{ cursor: 'pointer' }}>
          Kantoran
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[26px] leading-tight font-semibold text-[#1A1A18] mb-2">
            Masuk dulu, lalu kita mulai hari pertamamu.
          </h1>
          <p className="text-[15px] text-[#4A4A45] leading-relaxed mb-7">
            Akun dipakai untuk menyimpan chat, gaji hasil nego, dan task kamu. Tutup tab kapan saja, besok bisa lanjut dari titik yang sama.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={redirecting}
            style={{ cursor: redirecting ? 'wait' : 'pointer' }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-[#D8D6CE] rounded-lg font-medium text-[15px] text-[#1A1A18] hover:border-[#0F6E56] transition-colors disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {redirecting ? 'Membuka Google...' : 'Masuk dengan Google'}
          </button>

          {error && <p className="mt-3 text-sm text-[#B42318]">{error}</p>}

          <p className="mt-4 text-[13px] text-[#6B6A64] leading-relaxed">
            Dengan masuk, kamu menyetujui{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-[#0F6E56]" style={{ cursor: 'pointer' }}>Syarat &amp; Ketentuan</Link>
            {' '}dan{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#0F6E56]" style={{ cursor: 'pointer' }}>Kebijakan Privasi</Link>.
            Hari pertama gratis, tanpa kartu kredit.
          </p>

          <div className="mt-9 pt-6 border-t border-[#E5E3DC]">
            <p className="text-[13px] font-medium text-[#1A1A18] mb-3">Setelah masuk</p>
            <ol className="flex flex-col gap-3">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full border border-[#D8D6CE] text-[11px] font-medium text-[#6B6A64] flex items-center justify-center flex-shrink-0 mt-px tabular">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm text-[#1A1A18]">{s.title}</p>
                    <p className="text-[13px] text-[#6B6A64]">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  )
}
