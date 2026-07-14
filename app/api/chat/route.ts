import { NextRequest, NextResponse } from 'next/server'
import { callAI, type ChatMessage } from '@/lib/ai'
import { getSintaPrompt, getSupPrompt, getJnrPrompt, getMgrPrompt } from '@/lib/prompts'
import { POSITIONS } from '@/lib/positions'
import { getAuthUser } from '@/lib/serverAuth'
import { checkLimit, LIMIT_MESSAGE } from '@/lib/rateLimit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Batas payload dari client — history dan konteks dikirim client, jadi server
// wajib membatasi supaya biaya token terkendali dan konteks tidak bisa dikarang bebas
const MAX_MESSAGES = 40
const MAX_MSG_LEN = 2000
const VALID_NPC = new Set(['sinta', 'sup', 'jnr', 'mgr'])

const capStr = (v: unknown, max: number) => String(v ?? '').slice(0, max)

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Limit tercapai → balas sebagai reply biasa (200) supaya UI chat tidak rusak
    if (!(await checkLimit(user.id, 'chat'))) {
      return NextResponse.json({ reply: LIMIT_MESSAGE.chat })
    }

    const body = await req.json()
    const { npcId, messages: rawMessages, userContext: rawCtx, positionId } = body

    if (!npcId || !Array.isArray(rawMessages) || !rawCtx) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!VALID_NPC.has(npcId)) {
      return NextResponse.json({ error: 'Invalid npcId' }, { status: 400 })
    }

    // Ambil hanya pesan terakhir, paksa role user/assistant, potong yang kepanjangan
    const messages: ChatMessage[] = rawMessages
      .slice(-MAX_MESSAGES)
      .map((m: { role?: string; content?: unknown }) => ({
        role: m?.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: capStr(m?.content, MAX_MSG_LEN),
      }))
      .filter(m => m.content.length > 0)

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Empty messages' }, { status: 400 })
    }

    // Konteks user dibangun ulang field per field — tidak meneruskan objek client mentah
    const userContext = {
      firstName: capStr(rawCtx.firstName, 80),
      email: capStr(rawCtx.email, 200),
      background: capStr(rawCtx.background, 40),
      bgRole: capStr(rawCtx.bgRole, 120),
      position: capStr(rawCtx.position, 60),
      level: capStr(rawCtx.level, 40),
      experience: capStr(rawCtx.experience, 600),
      motivation: capStr(rawCtx.motivation, 600),
      step: Number.isFinite(Number(rawCtx.step)) ? Number(rawCtx.step) : undefined,
    }

    const position = POSITIONS[positionId]
    let systemPrompt = ''

    switch (npcId) {
      case 'sinta':
        systemPrompt = getSintaPrompt(userContext, position?.reqs)
        break
      case 'sup':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = getSupPrompt(userContext, position.supervisor.name, position.supervisor.bio, position.taskFile, position.taskTitle)
        break
      case 'jnr':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = getJnrPrompt(userContext, position.junior.name, position.junior.bio)
        break
      case 'mgr':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = getMgrPrompt(userContext, position.manager.name, position.manager.bio, position.manager.role)
        break
      default:
        systemPrompt = getSintaPrompt(userContext)
    }

    const result = await callAI(messages, systemPrompt, { maxTokens: 250 })
    if (!result) {
      // failed: true → client render sebagai banner error + tombol retry,
      // BUKAN bubble NPC (pesan palsu di history bikin AI lompat topik)
      return NextResponse.json({
        reply: 'Maaf, ada gangguan koneksi. Coba kirim pesan lagi ya!',
        failed: true,
      })
    }

    // Sinta menandai hasil interview dengan token — parse lalu strip sebelum ke user.
    // Tiga tingkat: SELESAI (lulus) | SELESAI_CATATAN (diterima bersyarat) | TOLAK.
    let reply = result.text
    let interviewDone = false
    let interviewOutcome: 'pass' | 'conditional' | 'rejected' | undefined
    if (npcId === 'sinta') {
      const userMsgCount = messages.filter(m => m.role === 'user').length
      if (reply.includes('[TOLAK]')) {
        // Guardrail server: TOLAK terlalu dini (model melanggar aturan minimal
        // 6 tanya-jawab) tidak dihormati — token dibuang, interview lanjut biasa
        if (userMsgCount >= 6) interviewOutcome = 'rejected'
      } else if (reply.includes('[SELESAI_CATATAN]')) {
        interviewDone = true
        interviewOutcome = 'conditional'
      } else if (reply.includes('[SELESAI]')) {
        interviewDone = true
        interviewOutcome = 'pass'
      }
      reply = reply.replace(/\s*\[(SELESAI_CATATAN|SELESAI|TOLAK)\]\s*/g, ' ').trim()
    }

    return NextResponse.json({ reply, interviewDone, interviewOutcome })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      reply: 'Maaf, ada gangguan koneksi. Coba kirim pesan lagi ya!',
      failed: true,
    }, { status: 200 })
  }
}
