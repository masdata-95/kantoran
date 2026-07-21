// Engine review hasil kerja — dipakai /api/review (task simulator) dan /api/lessons/submit (misi Academy).
// Jalur utama: structured JSON (status tidak bergantung string matching).
// Fallback: prompt teks lama + string matching kalau JSON gagal.
import { callAI, cleanResponse } from '@/lib/ai'
import { getTaskReviewPrompt, getTaskReviewPromptJSON, type UserContext } from '@/lib/prompts'

export interface ReviewArgs {
  userContext: UserContext
  supervisorName: string
  supervisorBio: string
  taskTitle: string
  rubric: { mustFind: string[]; goodToMention: string[] }
  submission: string
}

export interface ReviewResult {
  review: string
  isApproved: boolean
  score: number  // INTERNAL — jangan pernah dikirim ke client; untuk kalibrasi founder
}

interface ReviewJSON {
  score?: number
  feedback?: string
  revisionNote?: string | null
  status?: string  // toleransi output lama (pra-sistem skor)
}

// Batas lulus review — hasil >= ini diterima meski belum sempurna ("cukup untuk
// karyawan baru"). Bisa di-tune lewat env tanpa deploy kode saat kalibrasi MVP.
const PASS_SCORE = Math.min(Math.max(Number(process.env.KANTORAN_PASS_SCORE) || 70, 1), 100)

// Ambil objek JSON pertama dari teks model (toleran terhadap pagar kode / teks nyasar)
export function extractJSON(text: string): unknown {
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

export async function reviewSubmission(args: ReviewArgs): Promise<ReviewResult | null> {
  const { userContext, supervisorName, supervisorBio, taskTitle, rubric, submission } = args

  // ── Jalur utama: JSON terstruktur ──
  const jsonPrompt = getTaskReviewPromptJSON(
    userContext, supervisorName, supervisorBio, taskTitle,
    rubric.mustFind, rubric.goodToMention, submission
  )
  const jsonResult = await callAI(
    [{ role: 'user', content: 'Review hasil kerja saya.' }],
    jsonPrompt,
    { maxTokens: 500, json: true, temperature: 0.4, deadlineMs: 15000 }
  )

  if (jsonResult) {
    try {
      const parsed = extractJSON(jsonResult.text) as ReviewJSON
      // Lulus ditentukan skor >= PASS_SCORE (sumber kebenaran ada di server, bukan model).
      // Fallback ke field status lama kalau model belum mengirim skor.
      const rawScore = typeof parsed.score === 'number' ? parsed.score : NaN
      const hasScore = Number.isFinite(rawScore)
      const score = hasScore ? Math.min(Math.max(Math.round(rawScore), 0), 100) : NaN

      let isApproved: boolean | null = null
      if (hasScore) isApproved = score >= PASS_SCORE
      else if (parsed.status === 'APPROVED') isApproved = true
      else if (parsed.status === 'REVISION_NEEDED') isApproved = false

      if (parsed.feedback && isApproved !== null) {
        // cleanResponse hanya pada feedback — jaga tone anti AI-slop di path JSON
        let review = cleanResponse(parsed.feedback)
        if (!isApproved && parsed.revisionNote) {
          const note = cleanResponse(String(parsed.revisionNote))
          if (note && !review.toLowerCase().includes(note.toLowerCase().slice(0, 30))) {
            review = `${review} ${note}`.trim()
          }
        }
        // Skor untuk kalibrasi: kalau model tak kirim skor, pakai proxy dari keputusan
        const finalScore = hasScore ? score : (isApproved ? PASS_SCORE : PASS_SCORE - 15)
        return { review, isApproved, score: finalScore }
      }
      console.warn('Review JSON shape tidak valid:', jsonResult.text.slice(0, 150))
    } catch {
      console.warn('Review JSON parse gagal:', jsonResult.text.slice(-200))
    }
  }

  // ── Fallback: prompt teks lama + string matching ──
  const textPrompt = getTaskReviewPrompt(
    userContext, supervisorName, supervisorBio, taskTitle,
    rubric.mustFind, rubric.goodToMention, submission
  )
  const textResult = await callAI(
    [{ role: 'user', content: 'Review hasil kerja saya.' }],
    textPrompt,
    { maxTokens: 350, deadlineMs: 12000 }
  )
  if (!textResult) return null

  const review = textResult.text
  const isApproved = review.includes('Status: APPROVED') && !review.includes('REVISION NEEDED')
  const cleanReview = review
    .replace(/Status: APPROVED/g, '')
    .replace(/Status: REVISION NEEDED.*$/gm, '')
    .trim()

  return { review: cleanReview, isApproved, score: isApproved ? PASS_SCORE : PASS_SCORE - 15 }
}
