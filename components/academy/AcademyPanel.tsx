'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase'
import type { ModuleDTO } from '@/lib/lessons'
import type { UserContext } from '@/lib/prompts'
import LessonView from './LessonView'

export default function AcademyPanel({ positionId, userContext, supervisorName, supervisorInitials, supervisorAvClass, onXP, onProgress }: {
  positionId: string
  userContext: UserContext
  supervisorName: string
  supervisorInitials: string
  supervisorAvClass: string
  onXP: (n: number) => void
  // Lapor snapshot modul ke parent — dipakai SimulatorApp untuk gate training sebelum task
  onProgress?: (modules: ModuleDTO[]) => void
}) {
  const [modules, setModules] = useState<ModuleDTO[] | null>(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Tiap modules berubah (load awal maupun lesson selesai), kabari parent
  useEffect(() => {
    if (modules) onProgress?.(modules)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`/api/lessons?position=${encodeURIComponent(positionId)}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { setError(data.error || 'Gagal memuat Academy.'); return }
        setModules(data.modules || [])
      } catch {
        if (!cancelled) setError('Ada gangguan koneksi. Muat ulang halaman ya.')
      }
    })()
    return () => { cancelled = true }
  }, [positionId])

  // Tandai lesson selesai di state lokal (tanpa refetch) + teruskan XP ke coins simulator
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
  if (selected && !selected.locked) {
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
      />
    )
  }

  const tracks: { key: 'tools' | 'business'; label: string }[] = [
    { key: 'tools', label: '🛠️ Tools' },
    { key: 'business', label: '💼 Bisnis & Domain' },
  ]

  return (
    <div className="flex flex-col gap-4 animate-fadeUp">
      <div>
        <h2 className="font-serif font-bold text-[#111111] text-lg">🎓 Vantara Academy</h2>
        <p className="text-xs text-[#888780] mt-0.5">Training module yang di-assign {supervisorName.split(' ')[0]} buat kamu. Selesaikan yang hari ini, itu bekal buat task-mu.</p>
      </div>

      {modules.length === 0 && (
        <p className="text-sm text-[#888780] py-8 text-center">Belum ada modul untuk posisimu. Cek lagi nanti ya.</p>
      )}

      {tracks.map(track => {
        const trackModules = modules.filter(m => m.track === track.key)
        if (trackModules.length === 0) return null
        return (
          <div key={track.key}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">{track.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {trackModules.map(mod => {
                const done = mod.lessons.filter(l => l.progress?.status === 'completed').length
                const total = mod.lessons.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0

                if (mod.locked) {
                  // Kartu teaser premium — gaya sama dengan upcomingTasks di File Manager
                  return (
                    <div key={mod.id} className="bg-white border border-[#E5E3DC] rounded-xl p-3.5 opacity-60 select-none" style={{ cursor: 'not-allowed' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">🔒</span>
                        <p className="text-xs font-semibold text-[#444441] truncate">Hari {mod.day} · {mod.title}</p>
                      </div>
                      {mod.teaser && <p className="text-[11px] text-[#888780] leading-relaxed">{mod.teaser}</p>}
                      <p className="text-[10px] text-[#854F0B] mt-2 font-medium">Terbuka di Kantoran versi penuh</p>
                    </div>
                  )
                }

                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedId(mod.id)}
                    style={{ cursor: 'pointer' }}
                    className="bg-white border border-[#E5E3DC] hover:border-[#0F6E56]/40 rounded-xl p-3.5 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-[#111111] group-hover:text-[#0F6E56] transition-colors truncate">{mod.title}</p>
                      {done === total && total > 0 && <span className="text-sm flex-shrink-0">✅</span>}
                    </div>
                    <p className="text-[11px] text-[#888780] mb-2.5">{total} materi · {done} selesai</p>
                    <div className="h-1.5 rounded-full bg-[#F1EFE8] overflow-hidden">
                      <div className="h-full bg-[#1D9E75] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
