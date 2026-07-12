// Penilaian performa satu run — SEMUA diturunkan dari chat_history yang sudah
// tersimpan, sengaja tanpa kolom database baru (tidak butuh migration).
// Dipakai: kartu day_done (SimulatorApp), surat referensi (ReferenceLetter).

export interface PerfMessage {
  role: string
  text?: string
  data?: Record<string, unknown>
}
export type PerfHistory = Record<string, PerfMessage[]>

// Jumlah revisi = kartu feedback "REVISION NEEDED" di chat supervisor
export function countRevisions(history: PerfHistory): number {
  return (history['sup_chat'] || []).filter(
    m => m.role === 'feedback' && String(m.data?.label || '').toUpperCase().includes('REVISION')
  ).length
}

export type Grade = 'exceeds' | 'meets' | 'needs_improvement'

export function computeGrade(revisions: number): Grade {
  if (revisions === 0) return 'exceeds'
  if (revisions === 1) return 'meets'
  return 'needs_improvement'
}

export const GRADE_LABEL: Record<Grade, string> = {
  exceeds: 'Exceeds Expectations',
  meets: 'Meets Expectations',
  needs_improvement: 'Needs Improvement',
}

// Narasi penilaian di kartu akhir hari — kegagalan mengubah cerita, bukan menghentikan
export const GRADE_REVIEW: Record<Grade, string> = {
  exceeds: 'Task pertama approved tanpa revisi. Itu jarang terjadi di hari pertama, dan supervisormu mencatatnya.',
  meets: 'Task selesai dengan satu revisi. Solid untuk hari pertama, ruang naiknya masih ada.',
  needs_improvement: 'Butuh beberapa revisi, tapi kamu menyelesaikannya. Yang dinilai bukan cuma hasil, tapi cara kamu bangkit setelah dikoreksi.',
}

// ── Gaya kerja dari pilihan dilema ─────────────────
// Pilihan user di message role 'choice' (data.chosenTrait) menentukan gaya kerja
// yang dibacakan saat review dan tercatat di surat referensi.
export interface WorkStyle {
  id: string
  label: string
  review: string     // dibacakan di penilaian akhir hari
  letterNote: string // satu baris di surat referensi
}

export const WORK_STYLES: Record<string, WorkStyle> = {
  integritas: {
    id: 'integritas',
    label: 'Lurus dan berani',
    review: 'Kamu memilih transparansi meski ada risikonya. Tim menilai kamu bisa dipercaya memegang data sensitif.',
    letterNote: 'Menunjukkan integritas dalam menyampaikan temuan, termasuk temuan yang tidak populer.',
  },
  aman: {
    id: 'aman',
    label: 'Hati-hati dan diplomatis',
    review: 'Kamu memilih jalan aman. Bagus untuk menjaga hubungan tim, tapi supervisor mencatat kamu perlu lebih berani menyuarakan temuan.',
    letterNote: 'Bekerja dengan hati-hati dan menjaga keharmonisan tim.',
  },
}

export function getWorkStyle(history: PerfHistory): WorkStyle | null {
  for (const room of Object.values(history)) {
    for (const m of room) {
      if (m.role === 'choice' && m.data?.chosenTrait) {
        const ws = WORK_STYLES[String(m.data.chosenTrait)]
        if (ws) return ws
      }
    }
  }
  return null
}
