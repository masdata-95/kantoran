'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { authFetch } from '@/lib/supabase'
import { track } from '@/lib/track'

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
  'Lanjut ke task hari kedua dan seterusnya',
  'Simulasi beberapa minggu sampai performance review',
  'Surat referensi yang bisa diunduh dan dibagikan',
  'Sertifikat yang bisa dipasang di LinkedIn',
  'Feedback dari mentor manusia, bukan hanya AI',
  'Koneksi ke lowongan kerja sungguhan',
  'Kerja bareng peserta lain dalam satu tim',
  'Aplikasi di HP',
]

const RATING_LABEL = ['', 'Mengecewakan', 'Kurang', 'Lumayan', 'Bagus', 'Bagus sekali']

export default function WishlistForm({ user, positionTried, firstName, coins, tasksDone, shareText, onExplore }: Props) {
  const defaultShare = `Baru coba Kantoran: diinterview HR, nego gaji, lalu dapat task Excel dari supervisor, semuanya lewat chat. Lumayan buat latihan sebelum kerja beneran. kantoran.id`
  const share = shareText || defaultShare
  const [step, setStep] = useState(1)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [wishlist, setWishlist] = useState<string[]>([])
  const [email, setEmail] = useState(user.email || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim())

  const toggleWish = (w: string) => {
    setWishlist(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await authFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: firstName, rating, feedback, wishlist, positionTried }),
      })
      // Dulu gagal simpan tetap ditampilkan "terdaftar": email hilang tanpa jejak
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      track('waitlist_submitted', { rating, positionTried })
      setDone(true)
    } catch (e) {
      console.error(e)
      setError('Belum tersimpan karena koneksi terputus. Coba kirim sekali lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard diblokir browser: teks tetap bisa diseleksi manual */ }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <header className="px-5 sm:px-8 h-14 flex items-center border-b border-[#E5E3DC] bg-white">
          <span className="text-[15px] font-semibold text-[#0F6E56]">Kantoran</span>
        </header>
        <main className="flex-1 flex justify-center p-5 sm:p-8">
          <div className="max-w-md w-full">
            <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2">Terima kasih, {firstName}.</h1>
            <p className="text-[15px] text-[#4A4A45] leading-relaxed mb-6">
              Kami kabari ke <strong className="font-medium text-[#1A1A18]">{email}</strong> begitu hari kedua dibuka. Satu email, tidak lebih.
            </p>

            <div className="bg-white border border-[#E5E3DC] rounded-xl p-5 mb-6">
              <p className="text-sm font-medium text-[#1A1A18] mb-2">Mau cerita ke teman?</p>
              <p className="text-sm text-[#4A4A45] leading-relaxed mb-4 select-all">{share}</p>
              <button onClick={copyShare} style={{ cursor: 'pointer' }} className="btn-teal-outline text-sm w-full py-2.5">
                {copied ? 'Tersalin' : 'Salin teks'}
              </button>
            </div>

            {onExplore ? (
              <div>
                <button onClick={onExplore} style={{ cursor: 'pointer' }} className="btn-teal text-sm w-full py-3">
                  Coba posisi lain
                </button>
                <p className="text-[13px] text-[#6B6A64] mt-2 text-center">Hasil di posisi ini tetap tersimpan.</p>
              </div>
            ) : (
              <Link href="/" className="text-sm text-[#0F6E56] font-medium hover:underline" style={{ cursor: 'pointer' }}>
                Kembali ke Kantoran
              </Link>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 sm:px-8 h-14 flex items-center justify-between border-b border-[#E5E3DC] bg-white">
        <span className="text-[15px] font-semibold text-[#0F6E56]">Kantoran</span>
        <span className="text-[13px] text-[#6B6A64] tabular">{step}/3</span>
      </header>

      <main className="flex-1 flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">
          <p className="text-[13px] text-[#6B6A64] mb-1 tabular">
            Hari pertama selesai · {tasksDone} task · {coins} coin
          </p>

          {step === 1 && (
            <>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1">Gimana rasanya, {firstName}?</h1>
              <p className="text-sm text-[#4A4A45] mb-6">Jujur saja. Kami baca semua jawaban, dan ini yang menentukan apa yang kami perbaiki duluan.</p>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1">Apa yang paling kamu butuhkan berikutnya?</h1>
              <p className="text-sm text-[#4A4A45] mb-6">Pilih sebanyak yang kamu mau, atau lewati.</p>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1">Hari kedua sedang disiapkan</h1>
              <p className="text-sm text-[#4A4A45] mb-6 leading-relaxed">
                Manager-mu sudah minta ketemu besok pagi, dan task minggu ini sudah menunggu. Tinggalkan email, kamu yang pertama diberi tahu saat dibuka, beserta harga untuk pendaftar awal.
              </p>
            </>
          )}

          <div className="bg-white rounded-xl border border-[#E5E3DC]">
            <div className="p-5 sm:p-6">
              {step === 1 && (
                <div>
                  <p className="text-[13px] font-medium text-[#1A1A18] mb-2">Nilai pengalamanmu</p>
                  <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Nilai 1 sampai 5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={`${n}, ${RATING_LABEL[n]}`}
                        onClick={() => setRating(n)}
                        style={{ cursor: 'pointer' }}
                        className={`h-11 rounded-lg border text-sm font-medium tabular transition-colors ${
                          rating === n ? 'border-[#0F6E56] bg-[#0F6E56] text-white' : 'border-[#D8D6CE] text-[#1A1A18] hover:border-[#0F6E56]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[12px] text-[#6B6A64] mt-1.5">
                    <span>Mengecewakan</span><span>Bagus sekali</span>
                  </div>
                  {rating > 0 && (
                    <p className="text-[13px] text-[#4A4A45] mt-3">
                      {RATING_LABEL[rating]}. {rating <= 3 ? 'Bagian mana yang paling mengganggu?' : 'Bagian mana yang paling terasa nyata?'}
                    </p>
                  )}

                  <label htmlFor="wl-feedback" className="block text-[13px] font-medium text-[#1A1A18] mt-5 mb-1.5">
                    Ceritakan sedikit <span className="font-normal text-[#6B6A64]">(opsional)</span>
                  </label>
                  <textarea
                    id="wl-feedback"
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Misalnya: interviewnya terasa nyata, tapi task Excel-nya kurang jelas"
                    className="w-full px-3 py-2.5 border border-[#D8D6CE] rounded-lg text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 resize-none min-h-[96px]"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-1.5">
                  {WISHLIST_OPTIONS.map(opt => {
                    const on = wishlist.includes(opt)
                    return (
                      <label key={opt} style={{ cursor: 'pointer' }} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-sm transition-colors ${
                        on ? 'border-[#0F6E56] bg-[#E1F5EE]/60 text-[#1A1A18]' : 'border-[#D8D6CE] text-[#3A3A36] hover:border-[#0F6E56]'
                      }`}>
                        <input type="checkbox" checked={on} onChange={() => toggleWish(opt)} className="w-4 h-4 accent-[#0F6E56]" />
                        {opt}
                      </label>
                    )
                  })}
                </div>
              )}

              {step === 3 && (
                <div>
                  <label htmlFor="wl-email" className="block text-[13px] font-medium text-[#1A1A18] mb-1.5">Email</label>
                  <input
                    id="wl-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    className="w-full px-3 py-2.5 border border-[#D8D6CE] rounded-lg text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10"
                  />
                  <p className="text-[13px] text-[#6B6A64] mt-1.5">Hanya untuk kabar pembukaan hari kedua.</p>
                </div>
              )}
            </div>

            <div className="border-t border-[#E5E3DC] px-5 sm:px-6 py-4 flex justify-between items-center">
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)} style={{ cursor: 'pointer' }} className="text-sm text-[#4A4A45] hover:text-[#1A1A18]">
                  Kembali
                </button>
              ) : <span />}

              {step < 3 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 && rating === 0}
                  style={{ cursor: step === 1 && rating === 0 ? 'not-allowed' : 'pointer' }}
                  className="btn-teal text-sm"
                >
                  {step === 2 && wishlist.length === 0 ? 'Lewati' : 'Lanjut'}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !emailValid}
                  style={{ cursor: submitting || !emailValid ? 'not-allowed' : 'pointer' }}
                  className="btn-teal text-sm"
                >
                  {submitting ? 'Menyimpan...' : 'Kabari saya'}
                </button>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-[#B42318]" role="alert">{error}</p>}
          {step === 1 && rating === 0 && <p className="mt-3 text-[13px] text-[#6B6A64]">Pilih angka dulu untuk lanjut.</p>}
        </div>
      </main>
    </div>
  )
}
