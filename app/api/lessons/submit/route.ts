import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run, parseJson, nowIso } from '@/lib/db'
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

    const lesson = await one<{
      title: string; type: string; mission: string | null; xp: number
      is_published: number; day: number; module_published: number
    }>(
      `SELECT l.title, l.type, l.mission, l.xp, l.is_published, m.day, m.is_published AS module_published
         FROM lessons l JOIN lesson_modules m ON m.id = l.module_id
        WHERE l.id = ?`,
      lessonId
    )

    if (!lesson || !lesson.is_published || !lesson.module_published || lesson.type !== 'mission') {
      return NextResponse.json({ error: 'Misi tidak ditemukan' }, { status: 404 })
    }
    if (lesson.day > 1) {
      return NextResponse.json({ error: 'Misi ini belum terbuka' }, { status: 403 })
    }

    const mission = parseJson<MissionSpec | null>(lesson.mission, null)
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
    const existing = await one<{ attempts: number; status: string; score: number | null; completed_at: string | null }>(
      'SELECT attempts, status, score, completed_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      user.id, lessonId
    )
    const alreadyCompleted = existing?.status === 'completed'

    let status: string, score: number | null, completedAt: string | null
    if (result.isApproved) {
      status = 'completed'; score = result.score; completedAt = nowIso()
    } else if (alreadyCompleted) {
      status = existing!.status; score = existing!.score; completedAt = existing!.completed_at
    } else {
      status = 'in_progress'; score = existing?.score ?? null; completedAt = null
    }

    await run(
      `INSERT INTO lesson_progress (user_id, lesson_id, status, score, attempts, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         status = excluded.status, score = excluded.score,
         attempts = excluded.attempts, completed_at = excluded.completed_at`,
      user.id, lessonId, status, score, (existing?.attempts || 0) + 1, completedAt
    )

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
