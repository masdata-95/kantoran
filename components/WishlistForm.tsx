'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { authFetch } from '@/lib/supabase'

interface Props {
  user: User
  positionTried: string
  firstName: string
  coins: number
  tasksDone: number
  // Rekap personal dari run (role, gaji nego, grade, gaya kerja) — lebih menular
  // daripada template generik; fallback ke teks generik kalau kosong
  shareText?: string
  // Balik ke hub karir (job listing) untuk coba posisi lain — multi-role
  onExplore?: () => void
}

const WISHLIST_OPTIONS = [
  'Lanjut ke task hari ke-2 dan seterusnya',
  'Simulasi 3 bulan penuh dengan promosi',
  'Coba posisi yang berbeda',
  'Mode multiplayer, kerja bareng orang lain',
  'Sertifikat dan surat referensi digital',
  'Fitur coaching dari mentor nyata',
  'Leaderboard dan kompetisi antar user',
  'Integrasi dengan lowongan kerja nyata',
  'Versi mobile app',
  'Koneksi langsung ke HRD perusahaan',
]

export default function WishlistForm({ user, positionTried, firstName, coins, tasksDone, shareText, onExplore }: Props) {
  const defaultShare = `Baru coba Kantoran, platform simulasi kerja pertama di Indonesia yang terasa nyata. Diinterview, nego gaji, langsung dapat task dari supervisor. Recommended buat yang mau prepare sebelum kerja! kantoran.vercel.app`
  const share = shareText || defaultShare
  const [step, setStep] = useState(1)
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [wishlist, setWishlist] = useState<string[]>([])
  const [email, setEmail] = useState(user.email || '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const toggleWish = (w: string) => {
    setWishlist(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await authFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          email,
          name: firstName,
          rating,
          feedback,
          wishlist,
          positionTried,
        })
      })
      setDone(true)
    } catch (e) {
      console.error(e)
      setDone(true) // show done anyway
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-fadeUp">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="font-serif text-3xl font-bold text-[#111111] mb-3">
            Kamu sudah terdaftar!
          </h1>
          <p className="text-[#888780] leading-relaxed mb-6">
            Hari pertama di Kantoran selesai, {firstName}. Kamu mengumpulkan{' '}
            <strong className="text-[#0F6E56]">{coins} Kantor Coin</strong> dan menyelesaikan{' '}
            <strong className="text-[#0F6E56]">{tasksDone} task</strong>.
            <br /><br />
            Kami akan hubungi kamu di <strong>{email}</strong> saat Kantoran penuh diluncurkan, dengan simulasi 3 bulan, task yang makin kompleks, dan surat referensi kerja nyata.
          </p>

          {/* Share card */}
          <div className="bg-white border border-[#E5E3DC] rounded-2xl p-5 mb-6 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-3">Bagikan pengalaman kamu</p>
            <p className="text-sm text-[#444441] leading-relaxed mb-4">"{share}"</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(share).catch(() => {})
                alert('Teks sudah dicopy! Tempel di Twitter/LinkedIn kamu.')
              }}
              style={{ cursor: 'pointer' }}
              className="btn-teal text-sm w-full"
            >
              Copy teks untuk dibagikan
            </button>
          </div>

          {onExplore ? (
            <div className="flex flex-col gap-3 items-center">
              <button onClick={onExplore} style={{ cursor: 'pointer' }} className="btn-teal text-sm w-full">
                Penasaran divisi lain? Coba posisi berbeda →
              </button>
              <p className="text-xs text-[#888780]">
                Progress posisi yang sudah kamu selesaikan tetap tersimpan.
              </p>
            </div>
          ) : (
            <a href="/" className="text-sm text-[#0F6E56] font-medium hover:underline" style={{ cursor: 'pointer' }}>
              Kembali ke Kantoran →
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#0F6E56]" />

      <div className="w-full max-w-lg animate-fadeUp">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">⏸️</div>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mb-2">
            Hari pertama selesai, {firstName}.
          </h1>
          <p className="text-sm text-[#888780]">
            Kamu mengumpulkan <strong className="text-[#0F6E56]">{coins} Kantor Coin</strong> dan menyelesaikan{' '}
            <strong className="text-[#0F6E56]">{tasksDone} task</strong> hari ini.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
              i < step ? 'bg-[#1D9E75]' : i === step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'
            }`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E3DC] shadow-sm">
          <div className="p-6">

            {/* Step 1, Rating & Feedback */}
            {step === 1 && (
              <div>
                <h2 className="font-serif text-xl font-bold text-[#111111] mb-1">Gimana pengalamannya?</h2>
                <p className="text-sm text-[#888780] mb-6">Jujur aja, ini sangat membantu kami untuk berkembang.</p>

                {/* Star rating */}
                <div className="flex justify-center gap-3 mb-6">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      style={{ cursor: 'pointer' }}
                      className="text-4xl transition-transform hover:scale-110"
                    >
                      {star <= (hoveredRating || rating) ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>

                {rating > 0 && (
                  <p className="text-center text-sm text-[#888780] mb-4">
                    {rating === 5 ? 'Luar biasa! Senang sekali mendengar itu.' :
                     rating === 4 ? 'Bagus! Ada yang bisa kami tingkatkan?' :
                     rating === 3 ? 'Cukup. Apa yang kurang menurutmu?' :
                     rating === 2 ? 'Kamu tidak puas, apa yang salah?' :
                     'Waduh. Tolong ceritakan apa yang mengecewakan.'}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">
                    Ceritakan pengalamanmu (opsional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Apa yang paling berkesan? Apa yang perlu diperbaiki? Apakah terasa seperti kerja nyata?"
                    className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] resize-none min-h-[100px]"
                  />
                </div>
              </div>
            )}

            {/* Step 2, Wishlist */}
            {step === 2 && (
              <div>
                <h2 className="font-serif text-xl font-bold text-[#111111] mb-1">Fitur apa yang paling kamu mau?</h2>
                <p className="text-sm text-[#888780] mb-5">Pilih sebanyak yang kamu mau. Ini yang akan kami prioritaskan.</p>

                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {WISHLIST_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleWish(opt)}
                      style={{ cursor: 'pointer' }}
                      className={`text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                        wishlist.includes(opt)
                          ? 'border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56] font-medium'
                          : 'border-[#E5E3DC] text-[#444441] hover:border-[#0F6E56]'
                      }`}
                    >
                      <span className="mr-2">{wishlist.includes(opt) ? '✓' : '○'}</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3, Email */}
            {step === 3 && (
              <div>
                <h2 className="font-serif text-xl font-bold text-[#111111] mb-1">Jangan berhenti di hari pertama</h2>
                <p className="text-sm text-[#888780] mb-6">
                  Manager-mu sudah menunggumu besok pagi, dan task minggu ini sudah ada di mejamu.
                  Daftar waitlist: kamu yang pertama dapat akses hari kedua, plus harga early-bird saat Kantoran penuh diluncurkan.
                </p>

                {/* Preview what they'll get */}
                <div className="bg-[#F1EFE8] rounded-xl p-4 mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">Yang kamu akan dapat saat launch:</p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      'Simulasi kerja 3 bulan penuh',
                      'Task yang makin kompleks setiap harinya',
                      'Performance review dan promosi jabatan',
                      'Surat referensi kerja dari PT Vantara Nusantara',
                      'Badge dan sertifikat digital yang bisa dibagikan',
                    ].map(item => (
                      <div key={item} className="flex gap-2 text-xs text-[#444441]">
                        <span className="text-[#0F6E56]">→</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Email untuk notifikasi *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@kamu.com"
                    className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] mb-1"
                  />
                  <p className="text-xs text-[#888780]">Tidak ada spam. Hanya notifikasi launch dan update penting.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#E5E3DC] px-6 py-4 flex justify-between items-center bg-[#FAFAF7]">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} style={{ cursor: 'pointer' }} className="text-sm text-[#888780] hover:text-[#111111]">
                ← Kembali
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && rating === 0}
                style={{ cursor: step === 1 && rating === 0 ? 'not-allowed' : 'pointer' }}
                className="btn-teal text-sm disabled:opacity-40"
              >
                {step === 2 && wishlist.length === 0 ? 'Lewati →' : 'Lanjut →'}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                style={{ cursor: submitting || !email ? 'not-allowed' : 'pointer' }}
                className="btn-teal text-sm disabled:opacity-40"
              >
                {submitting ? 'Mendaftarkan...' : 'Daftar Waitlist →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
