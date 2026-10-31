'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/authClient'
import type { ModuleDTO, LessonDTO } from '@/lib/lessons'
import type { UserContext } from '@/lib/prompts'
import MarkdownLite from './MarkdownLite'
import YouTubeEmbed from './YouTubeEmbed'
import VideoPlayer from './VideoPlayer'

const TYPE_LABEL: Record<string, string> = { text: 'Bacaan', video: 'Video', mission: 'Misi' }

// Tampilan satu modul: daftar judul materi di kiri (di layar kecil bisa dilipat), isi SATU materi
// di kanan, dan tombol lanjut di akhir materi supaya selalu jelas langkah berikutnya.
export default function LessonView({ module: mod, positionId, userContext, supervisorName, supervisorInitials, supervisorAvClass, onBack, onLessonComplete, pustaka = false }: {
  module: ModuleDTO
  positionId: string
  userContext: UserContext
  supervisorName: string
  supervisorInitials: string
  supervisorAvClass: string
  onBack: () => void
  onLessonComplete: (lessonId: string, xp: number) => void
  // Pustaka Video: boleh lompat antar video (tanpa urutan wajib); video terkunci menampilkan ajakan season.
  pustaka?: boolean
}) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(() => {
    // Buka otomatis lesson pertama yang belum selesai
    const next = mod.lessons.find(l => l.progress?.status !== 'completed' && !l.locked)
    return next?.id || mod.lessons[0]?.id || null
  })
  const [daftarTerbuka, setDaftarTerbuka] = useState(false) // hanya berlaku di layar kecil
  const [busyId, setBusyId] = useState<string | null>(null)
  const [missionText, setMissionText] = useState<Record<string, string>>({})
  const [missionFeedback, setMissionFeedback] = useState<Record<string, { review: string; isApproved: boolean }>>({})
  const [errorMsg, setErrorMsg] = useState('')

  const isUnlocked = (idx: number) => {
    if (pustaka || idx === 0) return true
    // Unlock sekuensial: lesson terbuka setelah lesson sebelumnya selesai
    return mod.lessons[idx - 1]?.progress?.status === 'completed'
  }

  const pilih = (id: string) => { setOpenLessonId(id); setDaftarTerbuka(false); setErrorMsg('') }

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

  const aktifIdx = Math.max(0, mod.lessons.findIndex(l => l.id === openLessonId))
  const lesson = mod.lessons[aktifIdx]
  const selesai = mod.lessons.filter(l => l.progress?.status === 'completed').length
  const berikutnya = mod.lessons[aktifIdx + 1]
  const berikutnyaTerbuka = !!berikutnya && isUnlocked(aktifIdx + 1)

  const completed = lesson?.progress?.status === 'completed'
  const feedback = lesson ? missionFeedback[lesson.id] : undefined

  return (
    <div className="flex flex-col gap-3 animate-fadeUp">
      <button onClick={onBack} style={{ cursor: 'pointer' }} className="self-start text-xs text-[#6B6A64] hover:text-[#0F6E56] transition-colors">
        ← Kembali ke {pustaka ? 'Pustaka Video' : 'Academy'}
      </button>

      <div>
        <p className="text-[11px] font-bold text-[#6B6A64]">{pustaka ? `Pustaka Video · ${mod.grup ?? 'Tools'}` : `${mod.track === 'tools' ? 'Tools' : 'Bisnis dan domain'} · Hari ${mod.day}`}</p>
        <h2 className="font-serif font-bold text-[#111111] text-lg mt-0.5">{mod.title}</h2>
        <p className="text-[12px] text-[#6B6A64] mt-0.5">{selesai} dari {mod.lessons.length} materi selesai</p>
      </div>

      {/* Intro modul — suara supervisor, tampil seperti bubble chat biar tetap in-story */}
      {mod.storyIntro && (
        <div className="flex gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${supervisorAvClass}`}>
            {supervisorInitials}
          </div>
          <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm text-[#444441] max-w-[560px]">
            <p className="text-[11px] font-semibold text-[#0F6E56] mb-0.5">{supervisorName}</p>
            {mod.storyIntro}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-[#FEE2E2] border border-[#B91C1C]/20 text-[#B91C1C] text-xs rounded-lg px-3 py-2">{errorMsg}</div>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-start">
        {/* Daftar judul materi */}
        <div className="md:w-64 md:flex-shrink-0">
          <button
            onClick={() => setDaftarTerbuka(o => !o)}
            aria-expanded={daftarTerbuka}
            style={{ cursor: 'pointer' }}
            className="md:hidden w-full flex items-center justify-between gap-2 bg-white border border-[#E5E3DC] rounded-xl px-3 py-2.5 text-left"
          >
            <span className="text-xs text-[#111111] font-medium truncate">Materi {aktifIdx + 1} dari {mod.lessons.length}: {lesson?.title}</span>
            <span className="text-[11px] text-[#0F6E56] flex-shrink-0">{daftarTerbuka ? 'Tutup' : 'Daftar materi'}</span>
          </button>

          <nav
            aria-label="Daftar materi"
            className={`${daftarTerbuka ? 'flex' : 'hidden'} md:flex flex-col gap-0.5 bg-white border border-[#E5E3DC] rounded-xl p-1.5 mt-2 md:mt-0 max-h-[60vh] md:max-h-[calc(100dvh-240px)] overflow-y-auto`}
          >
            {mod.lessons.map((l, idx) => {
              const unlocked = isUnlocked(idx)
              const done = l.progress?.status === 'completed'
              const aktif = l.id === lesson?.id
              return (
                <button
                  key={l.id}
                  onClick={() => unlocked && pilih(l.id)}
                  aria-current={aktif ? 'true' : undefined}
                  aria-disabled={!unlocked}
                  style={{ cursor: unlocked ? 'pointer' : 'not-allowed' }}
                  className={`flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                    aktif ? 'bg-[#E1F5EE]' : unlocked ? 'hover:bg-[#F4F3EF]' : 'opacity-50'
                  }`}
                >
                  <span
                    className={`w-5 h-5 mt-px rounded-full border text-[11px] flex items-center justify-center flex-shrink-0 tabular ${
                      done ? 'bg-[#0F6E56] border-[#0F6E56] text-white' : aktif ? 'border-[#0F6E56] text-[#0F6E56]' : 'border-[#C8C6BE] text-[#6B6A64]'
                    }`}
                    aria-label={done ? 'Selesai' : !unlocked ? 'Terkunci' : l.locked ? 'Khusus season' : TYPE_LABEL[l.type]}
                  >
                    {done ? '✓' : idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] leading-snug ${aktif ? 'text-[#085041] font-semibold' : done ? 'text-[#6B6A64]' : 'text-[#1A1A18]'}`}>{l.title}</span>
                    <span className="block text-[11px] text-[#6B6A64] mt-0.5">
                      {l.locked ? 'Khusus season' : TYPE_LABEL[l.type]} · +{l.xp} coin
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Isi satu materi */}
        {lesson && (
          <div className="flex-1 min-w-0 bg-white border border-[#E5E3DC] rounded-xl overflow-hidden">
            <div className="px-3 sm:px-4 pt-3.5 pb-2.5 border-b border-[#F1EFE8]">
              <p className="text-[11px] text-[#6B6A64]">Materi {aktifIdx + 1} dari {mod.lessons.length} · {lesson.locked ? 'Khusus season' : TYPE_LABEL[lesson.type]}</p>
              <h3 className="text-[15px] font-semibold text-[#111111] mt-0.5">{lesson.title}</h3>
            </div>

            <div className="px-3 sm:px-4 py-4 flex flex-col gap-3">
              {lesson.locked && (
                <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-lg p-3">
                  <p className="text-sm text-[#444441] leading-relaxed">Video ini khusus pemilik season. Video pertama di setiap topik gratis, jadi kamu bisa mencoba dulu sebelum memutuskan.</p>
                </div>
              )}

              {!lesson.locked && lesson.type === 'video' && (
                lesson.videoUrl
                  ? <VideoPlayer key={lesson.id} src={lesson.videoUrl} title={lesson.title} />
                  : <YouTubeEmbed videoId={lesson.youtubeVideoId} title={lesson.title} />
              )}

              {lesson.contentMd && <MarkdownLite content={lesson.contentMd} />}

              {lesson.type === 'mission' && (
                <div className="flex flex-col gap-2">
                  {lesson.missionBrief && (
                    <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-lg p-3">
                      <p className="text-[11px] font-bold text-[#854F0B] mb-1">Misi dari {supervisorName.split(' ')[0]}</p>
                      <p className="text-sm text-[#444441] whitespace-pre-line">{lesson.missionBrief}</p>
                    </div>
                  )}

                  {feedback && (
                    <div className="flex gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${supervisorAvClass}`}>
                        {supervisorInitials}
                      </div>
                      <div className={`border rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm max-w-[560px] ${feedback.isApproved ? 'bg-[#DCFCE7] border-[#166534]/20 text-[#166534]' : 'bg-white border-[#E5E3DC] text-[#444441]'}`}>
                        <p className="text-[11px] font-semibold text-[#0F6E56] mb-0.5">{supervisorName}</p>
                        {feedback.review}
                        {feedback.isApproved && <p className="text-xs font-semibold mt-1.5">Misi selesai.</p>}
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
              )}
            </div>

            {/* Langkah berikutnya: selalu ada satu tombol yang jelas */}
            <div className="px-3 sm:px-4 py-3 border-t border-[#F1EFE8] bg-[#FAFAF7] flex items-center justify-between gap-3 flex-wrap">
              {aktifIdx > 0 ? (
                <button
                  onClick={() => pilih(mod.lessons[aktifIdx - 1].id)}
                  style={{ cursor: 'pointer' }}
                  className="text-xs font-medium text-[#4A4A45] hover:text-[#0F6E56]"
                >
                  ← Sebelumnya
                </button>
              ) : <span />}

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {completed && <span className="text-[12px] font-medium text-[#166534]">✓ Selesai</span>}

                {/* Bacaan dan video: tandai selesai lalu lanjut */}
                {lesson.type !== 'mission' && !lesson.locked && !completed && (
                  <button
                    onClick={() => markComplete(lesson)}
                    disabled={busyId === lesson.id}
                    style={{ cursor: busyId === lesson.id ? 'wait' : 'pointer' }}
                    className="text-xs font-medium bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#085041] disabled:opacity-40 transition-all"
                  >
                    {busyId === lesson.id ? 'Menyimpan...' : berikutnya ? 'Tandai selesai, lanjut' : 'Tandai selesai'}
                  </button>
                )}

                {/* Sudah selesai (atau misi/terkunci): arahkan ke langkah berikutnya */}
                {(completed || lesson.locked || lesson.type === 'mission') && berikutnya && (
                  berikutnyaTerbuka ? (
                    <button
                      onClick={() => pilih(berikutnya.id)}
                      style={{ cursor: 'pointer' }}
                      className={`text-xs font-medium px-4 py-2 rounded-lg transition-all ${completed || lesson.locked ? 'bg-[#0F6E56] text-white hover:bg-[#085041]' : 'border border-[#E5E3DC] text-[#4A4A45] hover:border-[#0F6E56]/40'}`}
                    >
                      Materi berikutnya →
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#6B6A64]">Selesaikan materi ini untuk membuka yang berikutnya</span>
                  )
                )}

                {/* Materi terakhir: tutup dengan jelas */}
                {!berikutnya && (completed || lesson.locked) && (
                  <button
                    onClick={onBack}
                    style={{ cursor: 'pointer' }}
                    className="text-xs font-medium bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#085041] transition-all"
                  >
                    {selesai === mod.lessons.length ? `Semua materi selesai, kembali ke ${pustaka ? 'Pustaka' : 'Academy'}` : `Kembali ke ${pustaka ? 'Pustaka' : 'Academy'}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
