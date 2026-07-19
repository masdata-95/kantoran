'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/simulator`,
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-6">
      {/* Top teal bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#0F6E56]"></div>

      <div className="w-full max-w-sm animate-fadeUp">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]"></div>
          <span className="font-serif text-2xl font-bold text-[#111111]">Kantoran</span>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E3DC]">
          <h1 className="font-serif text-2xl font-bold text-[#111111] mb-2">
            Mulai karir virtualmu
          </h1>
          <p className="text-[#6B6B6B] text-sm leading-relaxed mb-8">
            Login untuk menyimpan progress. Kamu tidak perlu mengulang dari awal setiap kali buka Kantoran.
          </p>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#E5E3DC] rounded-xl font-medium text-[#111111] hover:bg-[#FAFAF7] transition-all duration-150 hover:border-[#0F6E56]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Lanjutkan dengan Google
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E5E3DC]"></div>
            <span className="text-xs text-[#AAAAAA]">atau</span>
            <div className="flex-1 h-px bg-[#E5E3DC]"></div>
          </div>

          <p className="mt-5 text-center text-xs text-[#AAAAAA]">
            Dengan login, kamu menyetujui{' '}
            <Link href="/terms" className="underline hover:text-[#0F6E56]" style={{ cursor: 'pointer' }}>Syarat &amp; Ketentuan</Link>
            {' '}dan{' '}
            <Link href="/privacy" className="underline hover:text-[#0F6E56]" style={{ cursor: 'pointer' }}>Kebijakan Privasi</Link>.
            <br />Progress tersimpan otomatis di akun kamu.
          </p>
        </div>

        {/* Feature preview */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: '🎭', text: 'NPC berkarakter' },
            { icon: '📊', text: 'Task Excel nyata' },
            { icon: '🔍', text: 'AI review spesifik' },
          ].map((f) => (
            <div key={f.text} className="text-center p-3 bg-white rounded-xl border border-[#E5E3DC]">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs text-[#6B6B6B]">{f.text}</div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[#AAAAAA]">
          Hari pertama gratis · Tidak perlu kartu kredit
        </p>
      </div>
    </div>
  )
}
