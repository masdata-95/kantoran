import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter, ChatMessage } from '@/lib/openrouter'
import { getSintaPrompt, getSupPrompt, getJnrPrompt } from '@/lib/prompts'
import { POSITIONS } from '@/lib/positions'

export async function POST(req: NextRequest) {
  console.log('=== CHAT API CALLED ===')
  console.log('API Key:', process.env.OPENROUTER_API_KEY ? 'EXISTS' : 'MISSING')
  console.log('API Key prefix:', process.env.OPENROUTER_API_KEY?.substring(0, 10))

  try {
    const body = await req.json()
    const { npcId, messages, userContext, positionId } = body

    if (!npcId || !messages || !userContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const position = POSITIONS[positionId]
    let systemPrompt = ''

    switch (npcId) {
      case 'sinta':
        systemPrompt = getSintaPrompt(userContext)
        break
      case 'sup':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = getSupPrompt(userContext, position.supervisor.name, position.supervisor.bio)
        break
      case 'jnr':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = getJnrPrompt(userContext, position.junior.name, position.junior.bio)
        break
      case 'mgr':
        if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
        systemPrompt = `Kamu ${position.manager.name}, ${position.manager.role} di PT Vantara Nusantara. ${position.manager.bio}. Balas profesional Bahasa Indonesia.`
        break
      default:
        systemPrompt = getSintaPrompt(userContext)
    }


    const reply = await callOpenRouter(
      messages as ChatMessage[],
      systemPrompt,
      npcId,
      250
    )

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}