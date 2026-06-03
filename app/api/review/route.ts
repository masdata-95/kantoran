import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/openrouter'
import { getTaskReviewPrompt } from '@/lib/prompts'
import { POSITIONS } from '@/lib/positions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { positionId, userContext, submission } = body

    if (!positionId || !userContext || !submission) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const position = POSITIONS[positionId]
    if (!position) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const systemPrompt = getTaskReviewPrompt(
      userContext,
      position.supervisor.name,
      position.supervisor.bio,
      position.taskTitle,
      position.taskRubric.mustFind,
      position.taskRubric.goodToMention,
      submission
    )

    const review = await callOpenRouter(
      [{ role: 'user', content: 'Review hasil kerja saya.' }],
      systemPrompt,
      'review',
      350
    )

    const isApproved = review.includes('Status: APPROVED') && !review.includes('REVISION NEEDED')
    const cleanReview = review
      .replace(/Status: APPROVED/g, '')
      .replace(/Status: REVISION NEEDED.*$/gm, '')
      .trim()

    return NextResponse.json({
      review: cleanReview,
      isApproved,
      status: isApproved ? 'APPROVED' : 'REVISION NEEDED'
    })

  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
