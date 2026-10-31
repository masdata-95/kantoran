'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authClient'
import type { ModuleDTO } from '@/lib/lessons'
import type { UserContext } from '@/lib/prompts'
import LessonView from './LessonView'

// Pustaka Video Mas Data (Excel dan Looker Studio). Tidak terikat posisi: semua pengguna
// bisa menjelajah. Video pertama tiap topik gratis, sisanya butuh season.
export default function PustakaPanel({ positionId, userContext, supervisorName, supervisorInitials, supervisorAvClass, onXP }: {
  positionId: string
  userContext: UserContext
  supervisorName: string
  supervisorInitials: string
  supervisorAvClass: string
  onXP: (n: number) => void
}) {
  const [modules, setModules] = useState<ModuleDTO[] | null>(null)
  const [season, setSeason] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/pustaka')
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { setError(data.error || 'Gagal memuat Pustaka Video.'); return }
        setModules(data.modules || [])
        setSeason(!!data.season)
      } catch {
        if (!cancelled) setError('Ada gangguan koneksi. Muat ulang halaman ya.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleLessonComplete = (lessonId: string, xp: number) => {
    setModules(prev => prev?.map(m => ({
      ...m,
      lessons: m.lessons.map(l => l.id === lessonId
        ? { ...l, progress: { status: 'completed' as const, score: l.progress?.score ?? null } }
        : l),
    })) || null)
    if (xp > 0) onXP(xp)
  }

  if (error) return (
    <div className="bg-[#FEE2E2] border border-[#B91C1C]/20 text-[#B91C1C] text-sm rounded-xl px-4 py-3">{error}</div>
  )

  if (!modules) return (
    <div className="flex items-center justify-center py-16">
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
      </div>
    </div>
  )

  const selected = modules.find(m => m.id === selectedId)
  if (selected) {
    return (
      <LessonView
        module={selected}
        positionId={positionId}
        userContext={userContext}
        supervisorName={supervisorName}
        supervisorInitials={supervisorInitials}
        supervisorAvClass={supervisorAvClass}
        onBack={() => setSelectedId(null)}
        onLessonComplete={handleLessonComplete}
        pustaka
      />
    )
  }

  const grups = Array.from(new Set(modules.map(m => m.grup || 'Lainnya')))
  const totalVideo = modules.reduce((n, m) => n + m.lessons.length, 0)

  return (
    <div className="flex flex-col gap-4 animate-fadeUp">
      <div>
        <p className="text-[13px] text-[#4A4A45]">
          {totalVideo} video dari kelas Excel dan Looker Studio Mas Data. Pilih topik yang kamu butuhkan, tidak harus berurutan.
        </p>
        {!season && (
          <p className="text-[12px] text-[#6B6A64] mt-1">
            Video pertama di setiap topik gratis. Sisanya terbuka untuk pemilik season.
          </p>
        )}
      </div>

      {grups.map(grup => (
        <div key={grup}>
          <p className="text-[11px] font-bold text-[#6B6A64] mb-2">{grup}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {modules.filter(m => (m.grup || 'Lainnya') === grup).map(mod => {
              const total = mod.lessons.length
              const done = mod.lessons.filter(l => l.progress?.status === 'completed').length
              const terbuka = mod.lessons.filter(l => !l.locked).length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedId(mod.id)}
                  style={{ cursor: 'pointer' }}
                  className="bg-white border border-[#E5E3DC] hover:border-[#0F6E56]/40 rounded-xl p-3.5 text-left transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[#111111] group-hover:text-[#0F6E56] transition-colors truncate">{mod.title}</p>
                    {done === total && total > 0 && <span className="text-[12px] font-medium text-[#166534] flex-shrink-0">Selesai</span>}
                  </div>
                  <p className="text-[11px] text-[#6B6A64] mb-2.5">
                    {total} video · {done} selesai{terbuka < total ? ` · ${terbuka} gratis` : ''}
                  </p>
                  <div className="h-1.5 rounded-full bg-[#F1EFE8] overflow-hidden">
                    <div className="h-full bg-[#1D9E75] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
