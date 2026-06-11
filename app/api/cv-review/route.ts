import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { getCVReviewPrompt } from '@/lib/cvPrompt'
import { getAuthUser } from '@/lib/serverAuth'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Ambil objek JSON pertama dari teks model (toleran terhadap pagar kode / teks nyasar)
function extractJSON(text: string): unknown {
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const cvText: string = (body.cvText || '').toString().slice(0, 12000)
    const targetRole: string = (body.targetRole || '').toString().slice(0, 200)
    const jobDesc: string = (body.jobDesc || '').toString().slice(0, 4000)

    if (cvText.trim().length < 40) {
      return NextResponse.json({ error: 'CV terlalu pendek. Tempel CV lengkapmu ya.' }, { status: 400 })
    }

    const prompt = getCVReviewPrompt(cvText, targetRole, jobDesc)
    // clean=false supaya JSON tidak dirusak cleanResponse
    const raw = await callAI([{ role: 'user', content: 'Analisis CV ini sekarang.' }], prompt, 'cv', 1100, false)

    let result: unknown
    try {
      result = extractJSON(raw)
    } catch {
      console.error('CV review JSON parse gagal:', raw.slice(0, 200))
      return NextResponse.json({ error: 'Gagal memproses hasil. Coba lagi sebentar ya.' }, { status: 502 })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('CV review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
