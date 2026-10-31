import { NextRequest, NextResponse } from 'next/server'
import { callAI, type ChatMessage } from '@/lib/ai'
import { extractJSON } from '@/lib/reviewTask'
import { getUmpanBalikPrompt, rapikanUmpanBalik } from '@/lib/panelFeedback'
import { POSITIONS } from '@/lib/positions'
import { getAuthUser } from '@/lib/serverAuth'
import { checkLimit } from '@/lib/rateLimit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 40
const MAX_MSG_LEN = 2000

// Umpan balik tidak kritis: gagal apa pun → { umpanBalik: null } dan klien melewati kartunya.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await checkLimit(user.id, 'chat'))) return NextResponse.json({ umpanBalik: null })

    const body = await req.json()
    const posisi = POSITIONS[String(body.positionId)]
    if (!posisi || !Array.isArray(body.transkrip)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const label: Record<string, string> = { user: 'KANDIDAT', sinta: 'SINTA', sup: 'ATASAN' }
    const transkrip = body.transkrip
      .slice(-MAX_MESSAGES)
      .map((m: { who?: string; text?: unknown }) => `${label[String(m?.who)] || 'KANDIDAT'}: ${String(m?.text ?? '').slice(0, MAX_MSG_LEN)}`)
      .join('\n')
    if (!transkrip.trim()) return NextResponse.json({ umpanBalik: null })

    const firstName = String(body.firstName ?? '').slice(0, 80) || 'Kandidat'
    const prompt = getUmpanBalikPrompt(firstName, String(body.bgRole ?? posisi.title).slice(0, 120), posisi.supervisor.name)
    const pesan: ChatMessage[] = [{ role: 'user', content: `Transkrip interview:\n\n${transkrip}\n\nTulis umpan balik sekarang.` }]
    const hasil = await callAI(pesan, prompt, { maxTokens: 900, json: true, temperature: 0.4 })
    if (!hasil) return NextResponse.json({ umpanBalik: null })

    try {
      return NextResponse.json({ umpanBalik: rapikanUmpanBalik(extractJSON(hasil.text)) })
    } catch {
      return NextResponse.json({ umpanBalik: null })
    }
  } catch (error) {
    console.error('Interview feedback error:', error)
    return NextResponse.json({ umpanBalik: null })
  }
}
