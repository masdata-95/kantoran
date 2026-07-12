'use client'

import { useState, useEffect, useRef } from 'react'

// Tur pengenalan UI: elemen target disorot (spotlight), sisa layar digelapkan.
// Dipakai SimulatorApp saat user pertama kali masuk simulasi (flag di localStorage).
export interface TourStep {
  target?: string      // CSS selector elemen yang disorot; kosong = kartu di tengah layar
  title: string
  body: string
  needsSidebar?: boolean // buka drawer sidebar dulu di mobile sebelum mengukur target
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 6 // jarak spotlight dari tepi elemen

export default function GuidedTour({ steps, onDone, onStepChange }: {
  steps: TourStep[]
  onDone: () => void
  onStepChange?: (step: TourStep, index: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const step = steps[idx]
  const isLast = idx === steps.length - 1

  // Ukur posisi target — diulang tiap 200ms selama step aktif supaya spotlight
  // mengikuti transisi layout (drawer sidebar mobile butuh ~200ms untuk terbuka)
  useEffect(() => {
    onStepChange?.(step, idx)
    if (!step.target) { setRect(null); return }
    const measure = () => {
      const el = document.querySelector(step.target!)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect(prev =>
        prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height }
      )
    }
    measure()
    const iv = setInterval(measure, 200)
    window.addEventListener('resize', measure)
    return () => { clearInterval(iv); window.removeEventListener('resize', measure) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const next = () => { if (isLast) onDone(); else setIdx(i => i + 1) }

  // Escape = tutup tur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Posisi tooltip: di bawah target kalau muat, kalau tidak di atasnya; clamp ke viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700
  const ttWidth = Math.min(320, vw - 32)
  let ttStyle: React.CSSProperties
  if (rect) {
    const below = rect.top + rect.height + PAD + 12
    const estH = 170
    const top = below + estH < vh ? below : Math.max(16, rect.top - PAD - estH - 12)
    const left = Math.min(Math.max(16, rect.left), vw - ttWidth - 16)
    ttStyle = { position: 'fixed', top, left, width: ttWidth }
  } else {
    ttStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: ttWidth }
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 90 }} aria-live="polite">
      {/* Penangkap klik: klik di mana pun = lanjut, supaya UI di belakang tidak bisa disentuh saat tur */}
      <div className="absolute inset-0" onClick={next} style={{ cursor: 'pointer' }} />

      {/* Spotlight: lubang terang lewat box-shadow raksasa, sisanya jadi gelap */}
      {rect ? (
        <div
          className="fixed rounded-xl"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(17,17,17,0.72)',
            border: '2px solid rgba(255,255,255,0.9)',
            transition: 'all 0.25s ease',
            pointerEvents: 'none',
            zIndex: 91,
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(17,17,17,0.72)', pointerEvents: 'none' }} />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="bg-white rounded-2xl shadow-2xl p-4 animate-fadeUp"
        style={{ ...ttStyle, zIndex: 92 }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E56] mb-1">
          {idx + 1} dari {steps.length}
        </p>
        <p className="text-sm font-bold text-[#111111] mb-1">{step.title}</p>
        <p className="text-xs text-[#444441] leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={onDone}
            style={{ cursor: 'pointer' }}
            className="text-xs text-[#888780] hover:text-[#111111]"
          >
            Lewati tur
          </button>
          <button onClick={next} style={{ cursor: 'pointer' }} className="btn-teal text-xs px-4 py-2">
            {isLast ? 'Mulai kerja' : 'Lanjut'} →
          </button>
        </div>
      </div>
    </div>
  )
}
