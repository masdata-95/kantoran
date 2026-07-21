import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
import { checkLimit, LIMIT_MESSAGE } from '@/lib/rateLimit'
import { reviewSubmission } from '@/lib/reviewTask'
import { POSITIONS } from '@/lib/positions'
import type { MissionSpec } from '@/lib/lessons'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Submit jawaban misi Academy — direview supervisor (engine yang sama dengan task simulator,
// jadi suara feedback konsisten dengan dunia cerita).
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkLimit(user.id, 'mission'))) {
      return NextResponse.json({ error: LIMIT_MESSAGE.mission }, { status: 429 })
    }

    const body = await req.json()
    const lessonId: string = body.lessonId
    const submission: string = (body.submission || '').toString().slice(0, 6000)
    const positionId: string = body.positionId
    const userContext = body.userContext

    if (!lessonId || !submission.trim() || !positionId || !userContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (submission.trim().length < 30) {
      return NextResponse.json({ error: 'Jawaban terlalu pendek. Kerjakan dulu misinya dengan serius ya.' }, { status: 400 })
    }

    const position = POSITIONS[positionId]
    if (!position) return NextResponse.json({ error: 'Invalid position' }, { status: 400 })

    const db = getServiceClient()
    const { data: lesson } = await db
      .from('lessons')
      .select('id, title, type, mission, xp, is_published, lesson_modules!inner(day, is_published)')
      .eq('id', lessonId)
      .single()

    const moduleInfo = lesson?.lesson_modules as unknown as { day: number; is_published: boolean } | null
    if (!lesson || !lesson.is_published || !moduleInfo?.is_published || lesson.type !== 'mission') {
      return NextResponse.json({ error: 'Misi tidak ditemukan' }, { status: 404 })
    }
    if (moduleInfo.day > 1) {
      return NextResponse.json({ error: 'Misi ini belum terbuka' }, { status: 403 })
    }

    const mission = lesson.mission as MissionSpec | null
    if (!mission?.rubric?.mustFind?.length) {
      return NextResponse.json({ error: 'Misi belum dikonfigurasi' }, { status: 500 })
    }

    const result = await reviewSubmission({
      userContext,
      supervisorName: position.supervisor.name,
      supervisorBio: position.supervisor.bio,
      taskTitle: lesson.title,
      rubric: mission.rubric,
      submission,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Layanan AI lagi sibuk. Coba submit lagi 1-2 menit ya.' },
        { status: 503 }
      )
    }

    // Update progress: attempts selalu naik, completed hanya saat APPROVED
    const { data: existing } = await db
      .from('lesson_progress')
      .select('attempts, status')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .single()

    const alreadyCompleted = existing?.status === 'completed'
    await db.from('lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      attempts: (existing?.attempts || 0) + 1,
      ...(result.isApproved
        ? { status: 'completed', score: result.score, completed_at: new Date().toISOString() }
        : alreadyCompleted ? {} : { status: 'in_progress' }),
    }, { onConflict: 'user_id,lesson_id' })

    return NextResponse.json({
      review: result.review,
      isApproved: result.isApproved,
      // xp hanya diberikan saat pertama kali approved (jangan bisa di-farm)
      xp: result.isApproved && !alreadyCompleted ? lesson.xp : 0,
    })
  } catch (error) {
    console.error('Mission submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
