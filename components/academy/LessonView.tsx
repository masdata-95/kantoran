'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/supabase'
import type { ModuleDTO, LessonDTO } from '@/lib/lessons'
import type { UserContext } from '@/lib/prompts'
import MarkdownLite from './MarkdownLite'
import YouTubeEmbed from './YouTubeEmbed'

const TYPE_ICON: Record<string, string> = { text: '📖', video: '🎬', mission: '🎯' }

export default function LessonView({ module: mod, positionId, userContext, supervisorName, supervisorInitials, supervisorAvClass, onBack, onLessonComplete }: {
  module: ModuleDTO
  positionId: string
  userContext: UserContext
  supervisorName: string
  supervisorInitials: string
  supervisorAvClass: string
  onBack: () => void
  onLessonComplete: (lessonId: string, xp: number) => void
}) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(() => {
    // Buka otomatis lesson pertama yang belum selesai
    const next = mod.lessons.find(l => l.progress?.status !== 'completed')
    return next?.id || mod.lessons[0]?.id || null
  })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [missionText, setMissionText] = useState<Record<string, string>>({})
  const [missionFeedback, setMissionFeedback] = useState<Record<string, { review: string; isApproved: boolean }>>({})
  const [errorMsg, setErrorMsg] = useState('')

  const isUnlocked = (idx: number) => {
    if (idx === 0) return true
    // Unlock sekuensial: lesson terbuka setelah lesson sebelumnya selesai
    return mod.lessons[idx - 1]?.progress?.status === 'completed'
  }

  const markComplete = async (lesson: LessonDTO) => {
    if (lesson.progress?.status === 'completed' || busyId) return
    setBusyId(lesson.id); setErrorMsg('')
    try {
      const res = await authFetch('/api/lessons/progress', {
        method: 'POST',
        body: JSON.stringify({ lessonId: lesson.id, status: 'completed' }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Gagal menyimpan. Coba lagi ya.'); return }
      onLessonComplete(lesson.id, data.xp || 0)
      // Lanjut otomatis ke lesson berikutnya
      const idx = mod.lessons.findIndex(l => l.id === lesson.id)
      const next = mod.lessons[idx + 1]
      if (next) setOpenLessonId(next.id)
    } catch {
      setErrorMsg('Ada gangguan koneksi. Coba lagi ya.')
    } finally { setBusyId(null) }
  }

  const submitMission = async (lesson: LessonDTO) => {
    const answer = (missionText[lesson.id] || '').trim()
    if (answer.length < 30 || busyId) return
    setBusyId(lesson.id); setErrorMsg('')
    try {
      const res = await authFetch('/api/lessons/submit', {
        method: 'POST',
        body: JSON.stringify({ lessonId: lesson.id, submission: answer, positionId, userContext }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Gagal submit. Coba lagi ya.'); return }
      setMissionFeedback(prev => ({ ...prev, [lesson.id]: { review: data.review, isApproved: data.isApproved } }))
      if (data.isApproved) onLessonComplete(lesson.id, data.xp || 0)
    } catch {
      setErrorMsg('Ada gangguan koneksi. Coba lagi ya.')
    } finally { setBusyId(null) }
  }

  return (
    <div className="flex flex-col gap-3 animate-fadeUp">
      <button onClick={onBack} style={{ cursor: 'pointer' }} className="self-start text-xs text-[#888780] hover:text-[#0F6E56] transition-colors">
        ← Kembali ke Academy
      </button>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780]">{mod.track === 'tools' ? '🛠️ Tools' : '💼 Bisnis & Domain'} · Hari {mod.day}</p>
        <h2 className="font-serif font-bold text-[#111111] text-lg mt-0.5">{mod.title}</h2>
      </div>

      {/* Intro modul — suara supervisor, tampil seperti bubble chat biar tetap in-story */}
      {mod.storyIntro && (
        <div className="flex gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${supervisorAvClass}`}>
            {supervisorInitials}
          </div>
          <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm text-[#444441] max-w-[560px]">
            <p className="text-[10px] font-semibold text-[#0F6E56] mb-0.5">{supervisorName}</p>
            {mod.storyIntro}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-[#FEE2E2] border border-[#B91C1C]/20 text-[#B91C1C] text-xs rounded-lg px-3 py-2">{errorMsg}</div>
      )}

      {/* Daftar lesson — unlock sekuensial */}
      <div className="flex flex-col gap-2">
        {mod.lessons.map((lesson, idx) => {
          const unlocked = isUnlocked(idx)
          const completed = lesson.progress?.status === 'completed'
          const open = openLessonId === lesson.id && unlocked
          const feedback = missionFeedback[lesson.id]

          return (
            <div key={lesson.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${open ? 'border-[#0F6E56]/40' : 'border-[#E5E3DC]'} ${!unlocked ? 'opacity-50' : ''}`}>
              <button
                onClick={() => unlocked && setOpenLessonId(open ? null : lesson.id)}
                style={{ cursor: unlocked ? 'pointer' : 'not-allowed' }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <span className="text-base">{completed ? '✅' : unlocked ? TYPE_ICON[lesson.type] : '🔒'}</span>
                <span className={`flex-1 text-sm truncate ${completed ? 'text-[#888780]' : 'text-[#111111] font-medium'}`}>{lesson.title}</span>
                {lesson.type === 'mission' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B] flex-shrink-0">Misi</span>}
                <span className="text-[10px] text-[#888780] flex-shrink-0">🪙 {lesson.xp}</span>
              </button>

              {open && (
                <div className="border-t border-[#F1EFE8] px-3 sm:px-4 py-4 flex flex-col gap-3">
                  {lesson.type === 'video' && (
                    <YouTubeEmbed videoId={lesson.youtubeVideoId} title={lesson.title} />
                  )}

                  {lesson.contentMd && <MarkdownLite content={lesson.contentMd} />}

                  {lesson.type === 'mission' ? (
                    <div className="flex flex-col gap-2">
                      {lesson.missionBrief && (
                        <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-lg p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#854F0B] mb-1">🎯 Misi dari {supervisorName.split(' ')[0]}</p>
                          <p className="text-sm text-[#444441] whitespace-pre-line">{lesson.missionBrief}</p>
                        </div>
                      )}

                      {feedback && (
                        <div className="flex gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${supervisorAvClass}`}>
                            {supervisorInitials}
                          </div>
                          <div className={`border rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm max-w-[560px] ${feedback.isApproved ? 'bg-[#DCFCE7] border-[#166534]/20 text-[#166534]' : 'bg-white border-[#E5E3DC] text-[#444441]'}`}>
                            <p className="text-[10px] font-semibold text-[#0F6E56] mb-0.5">{supervisorName}</p>
                            {feedback.review}
                            {feedback.isApproved && <p className="text-xs font-semibold mt-1.5">✅ Misi selesai!</p>}
                          </div>
                        </div>
                      )}

                      {!completed && !feedback?.isApproved && (
                        <>
                          <textarea
                            value={missionText[lesson.id] || ''}
                            onChange={e => setMissionText(prev => ({ ...prev, [lesson.id]: e.target.value }))}
                            placeholder="Tulis jawaban misimu di sini... (minimal beberapa kalimat, jelaskan temuan dan alasanmu)"
                            rows={5}
                            style={{ cursor: 'text' }}
                            className="w-full resize-y px-3 py-2.5 border border-[#E5E3DC] rounded-lg text-sm text-[#111111] bg-[#FAFAF7] outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 transition-all"
                          />
                          <button
                            onClick={() => submitMission(lesson)}
                            disabled={busyId === lesson.id || (missionText[lesson.id] || '').trim().length < 30}
                            style={{ cursor: busyId === lesson.id || (missionText[lesson.id] || '').trim().length < 30 ? 'not-allowed' : 'pointer' }}
                            className="self-start text-xs font-medium bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#085041] disabled:opacity-40 transition-all"
                          >
                            {busyId === lesson.id ? 'Direview supervisor...' : `Submit ke ${supervisorName.split(' ')[0]}`}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    !completed && (
                      <button
                        onClick={() => markComplete(lesson)}
                        disabled={busyId === lesson.id}
                        style={{ cursor: busyId === lesson.id ? 'wait' : 'pointer' }}
                        className="self-start text-xs font-medium bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#085041] disabled:opacity-40 transition-all"
                      >
                        {busyId === lesson.id ? 'Menyimpan...' : '✓ Tandai selesai'}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
