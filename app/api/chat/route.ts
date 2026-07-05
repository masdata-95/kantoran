import { NextRequest, NextResponse } from 'next/server'
import { callAI, type ChatMessage } from '@/lib/ai'
import { getSintaPrompt, getSupPrompt, getJnrPrompt, getMgrPrompt } from '@/lib/prompts'
import { POSITIONS } from '@/lib/positions'
import { getAuthUser } from '@/lib/serverAuth'
import { checkLimit, LIMIT_MESSAGE } from '@/lib/rateLimit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Limit tercapai → balas sebagai reply biasa (200) supaya UI chat tidak rusak
    if (!(await checkLimit(user.id, 'chat'))) {
      return NextResponse.json({ reply: LIMIT_MESSAGE.chat })
    }

    const body = await req.json()
    const { npcId, messages, userContext, positionId } = body

    if (!npcId || !messages || !userContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    const result = await callAI(messages as ChatMessage[], systemPrompt, { maxTokens: 250 })
    if (!result) {
      return NextResponse.json({
        reply: 'Maaf, ada gangguan koneksi. Coba kirim pesan lagi ya!'
      })
    }

    // Sinta menandai penutupan interview dengan token [SELESAI] — strip sebelum dikirim ke user
    let reply = result.text
    let interviewDone = false
    if (npcId === 'sinta' && reply.includes('[SELESAI]')) {
      interviewDone = true
      reply = reply.replace(/\s*\[SELESAI\]\s*/g, ' ').trim()
    }

    return NextResponse.json({ reply, interviewDone })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ 
      reply: 'Maaf, ada gangguan koneksi. Coba kirim pesan lagi ya!' 
    }, { status: 200 })
  }
}
