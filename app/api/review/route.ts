import { NextRequest, NextResponse } from 'next/server'
import { reviewSubmission } from '@/lib/reviewTask'
import { POSITIONS } from '@/lib/positions'
import { getAuthUser } from '@/lib/serverAuth'
import { checkLimit, LIMIT_MESSAGE } from '@/lib/rateLimit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkLimit(user.id, 'review'))) {
      return NextResponse.json({ error: LIMIT_MESSAGE.review }, { status: 429 })
    }

    const body = await req.json()
    const { positionId, userContext, submission } = body

    if (!positionId || !userContext || !submission) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const position = POSITIONS[positionId]
    if (!position) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const result = await reviewSubmission({
      userContext,
      supervisorName: position.supervisor.name,
      supervisorBio: position.supervisor.bio,
      taskTitle: position.taskTitle,
      rubric: position.taskRubric,
      submission,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Layanan AI lagi sibuk. Coba submit lagi 1-2 menit ya.' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      review: result.review,
      isApproved: result.isApproved,
      status: result.isApproved ? 'APPROVED' : 'REVISION NEEDED'
    })

  } catch (error) {
    console.error('Review API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
