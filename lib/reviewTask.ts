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
}

interface ReviewJSON {
  status?: string
  feedback?: string
  revisionNote?: string | null
}

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
      if (parsed.feedback && (parsed.status === 'APPROVED' || parsed.status === 'REVISION_NEEDED')) {
        const isApproved = parsed.status === 'APPROVED'
        // cleanResponse hanya pada feedback — jaga tone anti AI-slop di path JSON
        let review = cleanResponse(parsed.feedback)
        if (!isApproved && parsed.revisionNote) {
          const note = cleanResponse(String(parsed.revisionNote))
          if (note && !review.toLowerCase().includes(note.toLowerCase().slice(0, 30))) {
            review = `${review} ${note}`.trim()
          }
        }
        return { review, isApproved }
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

  return { review: cleanReview, isApproved }
}
