import { NextRequest, NextResponse } from 'next/server'
import { reviewSubmission } from '@/lib/reviewTask'
import { POSITIONS } from '@/lib/positions'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
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
    const { positionId, userContext, submission: rawSubmission } = body

    if (!positionId || !userContext || !rawSubmission) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Cap panjang submission — hasil ekstraksi Excel bisa besar, jangan bakar token tanpa batas
    const submission = String(rawSubmission).slice(0, 15000)

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

    // Catat skor mentah di server untuk kalibrasi ambang lulus (best-effort, TIDAK
    // pernah dikirim ke client — user hanya melihat feedback bahasa manusia)
    try {
      await getServiceClient().from('events').insert({
        user_id: user.id, type: 'task_scored',
        meta: { position: positionId, score: result.score, approved: result.isApproved },
      })
    } catch { /* events belum ada / gagal → abaikan */ }

    // Skor sengaja TIDAK disertakan di respons
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
