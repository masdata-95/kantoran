import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { extractJSON } from '@/lib/reviewTask'
import { getCVReviewPrompt } from '@/lib/cvPrompt'
import { getAuthUser } from '@/lib/serverAuth'
import { checkLimit, LIMIT_MESSAGE } from '@/lib/rateLimit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

interface CVResultShape {
  overallScore?: unknown
  sections?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkLimit(user.id, 'cv'))) {
      return NextResponse.json({ error: LIMIT_MESSAGE.cv }, { status: 429 })
    }

    const body = await req.json()
    const cvText: string = (body.cvText || '').toString().slice(0, 12000)
    const targetRole: string = (body.targetRole || '').toString().slice(0, 200)
    const jobDesc: string = (body.jobDesc || '').toString().slice(0, 4000)

    if (cvText.trim().length < 40) {
      return NextResponse.json({ error: 'CV terlalu pendek. Tempel CV lengkapmu ya.' }, { status: 400 })
    }

    const prompt = getCVReviewPrompt(cvText, targetRole, jobDesc)
    // json: true → structured output + temperature rendah; 2500 token agar JSON lengkap tidak terpotong
    const aiResult = await callAI(
      [{ role: 'user', content: 'Analisis CV ini sekarang.' }],
      prompt,
      { maxTokens: 2500, json: true, temperature: 0.3 }
    )

    // Bedakan: semua provider gagal ≠ hasil tidak bisa diparse
    if (!aiResult) {
      return NextResponse.json(
        { error: 'Layanan AI lagi sibuk. Coba lagi 1-2 menit ya.' },
        { status: 503 }
      )
    }

    let result: CVResultShape
    try {
      result = extractJSON(aiResult.text) as CVResultShape
    } catch {
      // Log ekor respons — kalau terpotong, kelihatan di sini
      console.error(`CV review JSON parse gagal (provider: ${aiResult.provider}), tail:`, aiResult.text.slice(-300))
      return NextResponse.json({ error: 'Gagal memproses hasil. Coba lagi sebentar ya.' }, { status: 502 })
    }

    // Validasi shape minimal sebelum dikirim ke client
    if (typeof result.overallScore !== 'number' || !Array.isArray(result.sections)) {
      console.error(`CV review shape tidak valid (provider: ${aiResult.provider}):`, aiResult.text.slice(0, 200))
      return NextResponse.json({ error: 'Gagal memproses hasil. Coba lagi sebentar ya.' }, { status: 502 })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('CV review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
