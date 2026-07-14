'use client'

import { countRevisions, computeGrade, GRADE_LABEL, getWorkStyle, isConditionalOffer, type PerfHistory } from '@/lib/performance'
import type { Position } from '@/lib/positions'

// Surat referensi yang terlihat sejak hari pertama diterima kerja.
// Baris terisi mengikuti progress (endowed progress); baris terkunci = teaser premium.
// Kualitas kerja (grade) mengubah bunyi surat — kegagalan ada konsekuensinya.
export default function ReferenceLetter({ firstName, bgRole, step, tasksDone, trainingDone, history, pos }: {
  firstName: string
  bgRole: string
  step: number
  tasksDone: number
  trainingDone: boolean
  history: PerfHistory
  pos?: Position
}) {
  const revisions = countRevisions(history)
  const grade = computeGrade(revisions)
  const workStyle = getWorkStyle(history)
  const conditional = isConditionalOffer(history)
  const taskDone = tasksDone > 0

  const milestones: { done: boolean; text: string }[] = [
    { done: step >= 2, text: conditional ? 'Lulus proses seleksi (dengan catatan evaluasi HR)' : 'Lulus proses seleksi dan interview HR' },
    { done: step >= 3, text: `Menandatangani kontrak kerja sebagai ${bgRole}` },
    // Training kini opsional — baris ini hanya terisi kalau benar-benar diselesaikan
    { done: trainingDone, text: `Menyelesaikan training onboarding tim ${pos?.dept || ''}` },
    { done: taskDone, text: `Menyelesaikan task "${pos?.taskTitle || 'task pertama'}" dengan status APPROVED` },
  ]

  // Redemption arc: masuk dengan catatan lalu Exceeds = kutipan paling kuat di surat
  const supQuote = taskDone
    ? conditional && grade === 'exceeds'
      ? `${firstName} masuk dengan catatan dari seleksi, dan menepisnya lewat hasil kerja di hari pertama. Saya yang tadinya ragu.`
      : grade === 'exceeds'
        ? `${firstName} menyelesaikan task pertamanya tanpa revisi. Itu jarang terjadi di hari pertama.`
        : grade === 'meets'
          ? `${firstName} menunjukkan hasil kerja yang solid dan responsif terhadap feedback.`
          : `${firstName} membutuhkan beberapa revisi, tapi menunjukkan kemauan kuat untuk memperbaiki. Itu modal yang tidak semua orang punya.`
    : null

  return (
    <div className="max-w-lg mx-auto w-full pb-4">
      {/* Kertas surat */}
      <div className="bg-white border border-[#E5E3DC] rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] px-5 py-4 text-center">
          <p className="text-white font-serif font-bold text-sm tracking-wide">PT VANTARA NUSANTARA</p>
          <p className="text-white/75 text-[10px]">FMCG Personal Care · Jakarta Selatan</p>
        </div>

        <div className="px-5 py-5">
          <p className="text-center font-serif font-bold text-[#111111] text-sm mb-1">SURAT REFERENSI KERJA</p>
          <p className="text-center text-[10px] text-[#888780] mb-4">No. VN/HR/{new Date().getFullYear()}/…</p>

          <p className="text-xs leading-relaxed text-[#444441] mb-4">
            Dengan ini kami menerangkan bahwa <strong className="text-[#111111]">{firstName}</strong> bekerja
            sebagai <strong className="text-[#111111]">{bgRole}</strong> di tim {pos?.dept || ''} PT Vantara Nusantara,
            dengan catatan pencapaian sebagai berikut:
          </p>

          {/* Baris pencapaian: terisi mengikuti progress */}
          <div className="flex flex-col mb-4">
            {milestones.map((m, i) => (
              <div key={i} className={`flex items-start gap-2 py-1.5 border-b border-[#F1EFE8] last:border-0 ${m.done ? '' : 'opacity-45'}`}>
                <span className={`text-xs mt-0.5 flex-shrink-0 ${m.done ? 'text-[#0F6E56]' : 'text-[#888780]'}`}>{m.done ? '✓' : '·'}</span>
                <p className={`text-xs leading-relaxed ${m.done ? 'text-[#111111]' : 'text-[#888780] italic'}`}>
                  {m.done ? m.text : 'Belum tercapai, lanjutkan simulasimu'}
                </p>
              </div>
            ))}
          </div>

          {/* Penilaian + kutipan supervisor, muncul setelah task pertama dinilai */}
          {taskDone && (
            <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-xl p-3 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1">Penilaian Hari Pertama</p>
              <p className="text-xs font-semibold text-[#0F6E56] mb-1.5">{GRADE_LABEL[grade]}</p>
              {supQuote && (
                <p className="text-xs text-[#444441] leading-relaxed italic">
                  &ldquo;{supQuote}&rdquo;
                  <span className="not-italic text-[#888780]"> — {pos?.supervisor.name}, {pos?.supervisor.role.split('·')[0].trim()}</span>
                </p>
              )}
              {workStyle && (
                <p className="text-xs text-[#444441] leading-relaxed mt-1.5">{workStyle.letterNote}</p>
              )}
            </div>
          )}

          {/* Baris masa depan: terkunci, terisi saat dikerjakan (teaser premium) */}
          {(pos?.upcomingTasks.length || 0) > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1.5">Baris berikutnya di suratmu</p>
              <div className="flex flex-col opacity-50 select-none" style={{ cursor: 'not-allowed' }} title="Terisi saat kamu mengerjakannya">
                {pos!.upcomingTasks.map(t => (
                  <div key={t.day} className="flex items-start gap-2 py-1 border-b border-[#F1EFE8] last:border-0">
                    <span className="text-[10px] mt-0.5">🔒</span>
                    <p className="text-[11px] text-[#888780]">Hari {t.day}: {t.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blok tanda tangan, terkunci sampai simulasi selesai */}
          <div className="flex justify-between items-end pt-2 opacity-50">
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-[#888780] w-28 mb-1" />
              <p className="text-[10px] text-[#888780]">{pos?.supervisor.name || 'Supervisor'}</p>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-[#888780] w-28 mb-1" />
              <p className="text-[10px] text-[#888780]">{pos?.manager.name || 'Manager'}</p>
            </div>
          </div>
          <p className="text-center text-[10px] text-[#888780] mt-2">Ditandatangani resmi di akhir simulasi</p>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#888780] mt-3 leading-relaxed px-4">
        Surat ini milikmu dan terus bertambah. Setiap task yang selesai menambah satu baris,
        dan kualitas kerjamu menentukan bunyinya.
      </p>
    </div>
  )
}
