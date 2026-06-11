'use client'

import { useEffect, useState } from 'react'
import { supabase, authFetch } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/lib/profile'

interface Section { name: string; score: number; note: string }
interface Rewrite { before: string; after: string }
interface CVResult {
  overallScore: number
  atsScore: number
  verdict: string
  sections: Section[]
  strengths: string[]
  gaps: string[]
  missingKeywords: string[]
  rewrites: Rewrite[]
  nextSteps: string[]
}

const scoreColor = (n: number) => (n >= 75 ? '#166534' : n >= 50 ? '#854F0B' : '#B91C1C')
const scoreBg = (n: number) => (n >= 75 ? '#DCFCE7' : n >= 50 ? '#FAEEDA' : '#FEE2E2')

function buildCVText(p: UserProfile): string {
  const lines: string[] = []
  if (p.full_name) lines.push(`Nama: ${p.full_name}`)
  if (p.city) lines.push(`Domisili: ${p.city}`)
  if (p.education?.length) {
    lines.push('\nPENDIDIKAN:')
    p.education.forEach(e => lines.push(`- ${e.major} di ${e.institution}${e.year ? ` (${e.year})` : ''} [${e.status}]`))
  }
  if (p.experience?.length) {
    lines.push('\nPENGALAMAN:')
    p.experience.forEach(e => {
      lines.push(`- ${e.position} di ${e.company} (${e.startMonth} ${e.startYear} sampai ${e.isCurrent ? 'sekarang' : `${e.endMonth} ${e.endYear}`})`)
      if (e.description) lines.push(`  ${e.description}`)
    })
  }
  if (p.skills?.length) lines.push(`\nSKILLS: ${p.skills.join(', ')}`)
  return lines.join('\n')
}

export default function CVPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [cvText, setCvText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [showJD, setShowJD] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CVResult | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user ?? null
      setUser(u)
      setAuthLoading(false)
      if (u) {
        try {
          const res = await authFetch('/api/profile')
          const { profile: p } = await res.json()
          if (p) setProfile(p)
        } catch { /* ignore */ }
      }
    })()
  }, [])

  const handleLogin = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/cv` } })

  const autofill = () => { if (profile) setCvText(buildCVText(profile)) }

  const handleScan = async () => {
    if (cvText.trim().length < 40) { setError('Tempel CV lengkapmu dulu ya (minimal beberapa baris).'); return }
    setError(''); setLoading(true); setResult(null)
    try {
      const res = await authFetch('/api/cv-review', {
        method: 'POST',
        body: JSON.stringify({ cvText, targetRole, jobDesc }),
      })
      const data = await res.json()
      if (!res.ok || !data.result) { setError(data.error || 'Gagal scan. Coba lagi.'); return }
      setResult(data.result as CVResult)
    } catch {
      setError('Ada gangguan koneksi. Coba lagi ya.')
    } finally { setLoading(false) }
  }

  // ── Loading auth ──
  if (authLoading) return (
    <div className="min-h-dvh flex items-center justify-center bg-[#FAFAF7]">
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
      </div>
    </div>
  )

  // ── Belum login ──
  if (!user) return (
    <div className="min-h-dvh bg-[#FAFAF7] flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#0F6E56]" />
      <div className="w-full max-w-sm text-center animate-fadeUp">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]" />
          <span className="font-serif text-2xl font-bold text-[#111111]">CV Kantoran</span>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E3DC]">
          <div className="text-4xl mb-3">📄</div>
          <h1 className="font-serif text-xl font-bold text-[#111111] mb-2">Cek skor CV-mu dalam 30 detik</h1>
          <p className="text-sm text-[#6B6B6B] mb-6 leading-relaxed">
            AI menilai CV-mu seperti rekruter sungguhan: skor ATS, keyword yang kurang, dan rewrite bullet point biar lebih kuat. Gratis.
          </p>
          <button
            onClick={handleLogin}
            style={{ cursor: 'pointer' }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#E5E3DC] rounded-xl font-medium text-[#111111] hover:bg-[#FAFAF7] hover:border-[#0F6E56] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Lanjutkan dengan Google
          </button>
          <a href="/simulator" className="block mt-5 text-xs text-[#0F6E56] font-medium hover:underline" style={{ cursor: 'pointer' }}>
            Atau coba simulasi kerja di Kantoran →
          </a>
        </div>
      </div>
    </div>
  )

  // ── Tool ──
  return (
    <div className="min-h-dvh bg-[#FAFAF7]">
      {/* Topbar */}
      <div className="bg-white border-b border-[#E5E3DC] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-[52px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
            <span className="font-serif font-bold text-[#0F6E56]">CV Kantoran</span>
          </div>
          <a href="/simulator" className="text-xs text-[#888780] hover:text-[#0F6E56] transition-colors" style={{ cursor: 'pointer' }}>
            Kantoran →
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        {!result && (
          <>
            <div>
              <h1 className="font-serif text-2xl font-bold text-[#111111] mb-1">Scan CV kamu</h1>
              <p className="text-sm text-[#888780]">AI menilai seperti rekruter, lalu kasih skor ATS dan saran perbaikan konkret.</p>
            </div>

            {/* Target role */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Posisi yang dituju</label>
              <input
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                placeholder="Contoh: Data Analyst, Staff Finance, Digital Marketing"
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] bg-white"
              />
            </div>

            {/* CV text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#888780]">Isi CV kamu</label>
                {profile && (
                  <button onClick={autofill} style={{ cursor: 'pointer' }} className="text-xs text-[#0F6E56] font-medium hover:underline">
                    ✨ Isi dari profil Kantoran
                  </button>
                )}
              </div>
              <textarea
                value={cvText}
                onChange={e => setCvText(e.target.value)}
                placeholder="Tempel isi CV kamu di sini: pengalaman, pendidikan, skills, pencapaian..."
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] bg-white resize-none min-h-[200px] leading-relaxed"
              />
            </div>

            {/* Optional JD */}
            {!showJD ? (
              <button onClick={() => setShowJD(true)} style={{ cursor: 'pointer' }} className="text-xs text-[#0F6E56] font-medium text-left hover:underline">
                + Tambah deskripsi lowongan (biar lebih akurat)
              </button>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Deskripsi lowongan (opsional)</label>
                <textarea
                  value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)}
                  placeholder="Tempel deskripsi lowongan yang kamu incar..."
                  className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] bg-white resize-none min-h-[100px]"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={handleScan}
              disabled={loading}
              style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
              className="btn-teal w-full py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Sedang dianalisis AI...' : 'Scan CV Sekarang →'}
            </button>
            <p className="text-center text-[10px] text-[#888780]">Gratis. CV kamu tidak disimpan.</p>
          </>
        )}

        {result && <CVResultView result={result} onReset={() => { setResult(null); setError('') }} />}
      </div>
    </div>
  )
}

function CVResultView({ result, onReset }: { result: CVResult; onReset: () => void }) {
  const s = Math.round(result.overallScore || 0)
  return (
    <div className="flex flex-col gap-4 animate-fadeUp pb-8">
      {/* Score hero */}
      <div className="bg-white border border-[#E5E3DC] rounded-2xl p-5 text-center">
        <div
          className="w-24 h-24 rounded-full mx-auto flex flex-col items-center justify-center mb-3"
          style={{ background: scoreBg(s), color: scoreColor(s) }}
        >
          <span className="text-3xl font-bold leading-none">{s}</span>
          <span className="text-[10px] font-semibold opacity-70">dari 100</span>
        </div>
        <p className="text-sm font-medium text-[#111111] leading-relaxed">{result.verdict}</p>
        <div className="inline-flex items-center gap-1.5 mt-3 bg-[#FAFAF7] border border-[#E5E3DC] rounded-full px-3 py-1 text-xs">
          <span className="text-[#888780]">Skor ATS</span>
          <span className="font-bold" style={{ color: scoreColor(result.atsScore || 0) }}>{Math.round(result.atsScore || 0)}/100</span>
        </div>
      </div>

      {/* Sections */}
      {result.sections?.length > 0 && (
        <div className="bg-white border border-[#E5E3DC] rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-3">Rincian penilaian</p>
          <div className="flex flex-col gap-3">
            {result.sections.map((sec, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#111111]">{sec.name}</span>
                  <span className="text-xs font-bold" style={{ color: scoreColor(sec.score) }}>{Math.round(sec.score)}</span>
                </div>
                <div className="h-1.5 bg-[#F1EFE8] rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, sec.score)}%`, background: scoreColor(sec.score) }} />
                </div>
                <p className="text-xs text-[#888780] leading-relaxed">{sec.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Strengths */}
        {result.strengths?.length > 0 && (
          <div className="bg-[#DCFCE7] border border-[#166534]/20 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#166534] mb-2">💪 Kekuatan</p>
            <ul className="flex flex-col gap-1.5">
              {result.strengths.map((x, i) => <li key={i} className="text-xs text-[#14532D] leading-relaxed">{x}</li>)}
            </ul>
          </div>
        )}
        {/* Gaps */}
        {result.gaps?.length > 0 && (
          <div className="bg-[#FEE2E2] border border-[#B91C1C]/20 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#B91C1C] mb-2">⚠️ Perlu diperbaiki</p>
            <ul className="flex flex-col gap-1.5">
              {result.gaps.map((x, i) => <li key={i} className="text-xs text-[#7F1D1D] leading-relaxed">{x}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Missing keywords */}
      {result.missingKeywords?.length > 0 && (
        <div className="bg-white border border-[#E5E3DC] rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">🔑 Keyword yang sebaiknya ditambah</p>
          <div className="flex flex-wrap gap-1.5">
            {result.missingKeywords.map((k, i) => (
              <span key={i} className="text-xs bg-[#FAEEDA] text-[#854F0B] px-2.5 py-1 rounded-full font-medium">{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Rewrites */}
      {result.rewrites?.length > 0 && (
        <div className="bg-white border border-[#E5E3DC] rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-3">✍️ Saran rewrite bullet point</p>
          <div className="flex flex-col gap-3">
            {result.rewrites.map((r, i) => (
              <div key={i} className="border border-[#F1EFE8] rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-[#FEE2E2]/40 border-b border-[#F1EFE8]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#B91C1C] mb-0.5">Sebelum</p>
                  <p className="text-xs text-[#7F1D1D] leading-relaxed">{r.before}</p>
                </div>
                <div className="px-3 py-2 bg-[#DCFCE7]/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-0.5">Sesudah</p>
                  <p className="text-xs text-[#14532D] leading-relaxed">{r.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {result.nextSteps?.length > 0 && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0F6E56] mb-2">Langkah selanjutnya</p>
          <ul className="flex flex-col gap-1.5">
            {result.nextSteps.map((x, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#085041] leading-relaxed">
                <span className="text-[#0F6E56] flex-shrink-0">→</span><span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA Kantoran */}
      <div className="bg-gradient-to-br from-[#0F6E56] to-[#1D9E75] rounded-2xl p-5 text-center">
        <p className="text-white font-semibold text-sm mb-1">CV bagus itu langkah pertama.</p>
        <p className="text-white/80 text-xs mb-3 leading-relaxed">Latih wawancara dan kerja beneran di Kantoran, lalu dapat surat referensi untuk memperkuat CV-mu.</p>
        <a href="/simulator" className="inline-block bg-white text-[#0F6E56] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all" style={{ cursor: 'pointer' }}>
          Coba Simulasi Kerja di Kantoran →
        </a>
      </div>

      <button onClick={onReset} style={{ cursor: 'pointer' }} className="text-sm text-[#888780] hover:text-[#0F6E56] transition-colors">
        ← Scan CV lain
      </button>
    </div>
  )
}
