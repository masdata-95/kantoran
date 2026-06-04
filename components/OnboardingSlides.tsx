'use client'

import { useState } from 'react'

interface Props {
  onDone: () => void
}

const SLIDES = [
  {
    step: '01',
    title: 'Apply',
    subtitle: 'Lamar kerja seperti di dunia nyata',
    desc: 'Pilih posisi yang kamu mau, isi lamaran, dan tunggu kabar dari HR. Persis seperti proses melamar kerja sungguhan.',
    visual: '📋',
    bg: 'from-[#E1F5EE] to-[#FAFAF7]',
    accent: '#0F6E56',
  },
  {
    step: '02',
    title: 'Interview',
    subtitle: 'Diinterview langsung oleh HR AI',
    desc: 'Sinta, HR Business Partner Vantara, akan menginterview kamu. Tanya jawab natural — termasuk negosiasi gaji yang sesungguhnya.',
    visual: '🎤',
    bg: 'from-[#E8F0FC] to-[#FAFAF7]',
    accent: '#1A4A8A',
  },
  {
    step: '03',
    title: 'Kerja',
    subtitle: 'Dapat task nyata dari supervisor',
    desc: 'Setelah diterima, supervisor langsung kasih task — analisis data Excel asli, screening kandidat, atau evaluasi partner bisnis. Bukan soal pilihan ganda.',
    visual: '💼',
    bg: 'from-[#F0EAF9] to-[#FAFAF7]',
    accent: '#5B2D8E',
  },
  {
    step: '04',
    title: 'Feedback nyata',
    subtitle: 'Review spesifik seperti dari atasan sungguhan',
    desc: 'Supervisor AI tahu persis apa yang benar dan apa yang terlewat. Feedback-nya spesifik, bukan sekadar "bagus" atau "kurang lengkap".',
    visual: '✅',
    bg: 'from-[#FAEEDA] to-[#FAFAF7]',
    accent: '#854F0B',
  },
]

export default function OnboardingSlides({ onDone }: Props) {
  const [current, setCurrent] = useState(0)
  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  return (
    <div className={`min-h-screen bg-gradient-to-b ${slide.bg} flex flex-col transition-all duration-500`}>
      {/* Top bar */}
      <div className="h-1 bg-[#0F6E56] flex-shrink-0" />

      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
          <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
        </div>
        <button
          onClick={onDone}
          style={{ cursor: 'pointer' }}
          className="text-xs text-[#888780] hover:text-[#111111] transition-colors"
        >
          Lewati →
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">

        {/* Step indicator */}
        <div className="flex gap-2 mb-10">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{ cursor: 'pointer' }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-[#0F6E56]' : 'w-3 bg-[#E5E3DC]'
              }`}
            />
          ))}
        </div>

        {/* Visual */}
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl mb-8 shadow-sm"
          style={{ background: `${slide.accent}15` }}
        >
          {slide.visual}
        </div>

        {/* Step number */}
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: slide.accent }}
        >
          Langkah {slide.step}
        </p>

        {/* Title */}
        <h1 className="font-serif text-4xl font-bold text-[#111111] mb-3 text-center">
          {slide.title}
        </h1>

        {/* Subtitle */}
        <p className="text-base font-medium text-[#444441] mb-4 text-center">
          {slide.subtitle}
        </p>

        {/* Description */}
        <p className="text-sm text-[#888780] leading-relaxed text-center max-w-sm">
          {slide.desc}
        </p>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-8 flex-shrink-0 max-w-lg mx-auto w-full">
        <div className="flex gap-3">
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              style={{ cursor: 'pointer' }}
              className="flex-1 py-3.5 border border-[#E5E3DC] rounded-2xl text-sm font-medium text-[#888780] hover:border-[#0F6E56] hover:text-[#0F6E56] transition-all bg-white"
            >
              ← Sebelumnya
            </button>
          )}
          <button
            onClick={() => isLast ? onDone() : setCurrent(c => c + 1)}
            style={{ background: slide.accent, cursor: 'pointer' }}
            className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-white transition-all"
          >
            {isLast ? 'Siap mulai →' : 'Selanjutnya →'}
          </button>
        </div>

        {isLast && (
          <p className="text-center text-xs text-[#888780] mt-4">
            Gratis untuk dicoba · Tidak perlu kartu kredit
          </p>
        )}
      </div>
    </div>
  )
}
