import { NextRequest, NextResponse } from 'next/server'
import { reviewSubmission } from '@/lib/reviewTask'
import { POSITIONS, normalizeLevel } from '@/lib/positions'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run, parseJson } from '@/lib/db'
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
    const { positionId, userContext, submission: rawSubmission, taskSlug } = body

    if (!positionId || !userContext || !rawSubmission) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Cap panjang submission — hasil ekstraksi Excel bisa besar, jangan bakar token tanpa batas
    const submission = String(rawSubmission).slice(0, 15000)

    const position = POSITIONS[positionId]
    if (!position) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Day 1 = rubrik hardcoded di POSITIONS. Day 2+ = rubrik dari tabel tasks by slug,
    // dipilih per level (rubric TIDAK pernah ke client — dinilai di sini). Slug tak
    // dikenal → 404 (bukan diam-diam menilai pakai rubrik day-1 yang salah).
    let taskTitle = position.taskTitle
    let rubric = position.taskRubric
    if (taskSlug) {
      const task = await one<{ title: string; rubric: string }>(
        'SELECT title, rubric FROM tasks WHERE slug = ? AND position_id = ?',
        String(taskSlug), positionId
      )
      type RubricLevel = { must_find?: string[]; good_to_mention?: string[] }
      const rubricByLevel = parseJson<Record<string, RubricLevel>>(task?.rubric, {})
      const level = normalizeLevel(userContext?.level)
      const r = rubricByLevel[level] || rubricByLevel.junior
      if (!task || !Array.isArray(r?.must_find) || r.must_find.length === 0) {
        return NextResponse.json({ error: 'Task atau rubrik tidak ditemukan' }, { status: 404 })
      }
      taskTitle = task.title
      rubric = { mustFind: r.must_find, goodToMention: r.good_to_mention || [] }
    }

    const result = await reviewSubmission({
      userContext,
      supervisorName: position.supervisor.name,
      supervisorBio: position.supervisor.bio,
      taskTitle,
      rubric,
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
      await run(
        'INSERT INTO events (user_id, type, meta) VALUES (?, ?, ?)',
        user.id, 'task_scored',
        JSON.stringify({ position: positionId, slug: taskSlug || null, score: result.score, approved: result.isApproved })
      )
    } catch { /* gagal mencatat → abaikan */ }

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
