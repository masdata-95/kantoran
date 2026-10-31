import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run, nowIso } from '@/lib/db'
import { hasSeasonAccess } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

// Tandai lesson text/video sebagai selesai (atau in_progress).
// Misi TIDAK lewat sini — misi selesai via /api/lessons/submit setelah APPROVED.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const lessonId: string = body.lessonId
    const status: string = body.status
    if (!lessonId || !['in_progress', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validasi server-side: lesson ada, published, bukan mission, dan modulnya day 1 (gratis)
    const lesson = await one<{ type: string; xp: number; is_published: number; day: number; module_published: number; position_id: string; urutan: number }>(
      `SELECT l.type, l.xp, l.is_published, m.day, m.is_published AS module_published, m.position_id,
              (SELECT COUNT(*) FROM lessons x WHERE x.module_id = l.module_id AND x.is_published = 1 AND x.sort_order < l.sort_order) AS urutan
         FROM lessons l JOIN lesson_modules m ON m.id = l.module_id
        WHERE l.id = ?`,
      lessonId
    )

    if (!lesson || !lesson.is_published || !lesson.module_published) {
      return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 })
    }
    if (lesson.type === 'mission') {
      return NextResponse.json({ error: 'Misi diselesaikan lewat submit, bukan tandai selesai' }, { status: 400 })
    }
    if (lesson.day > 1) {
      return NextResponse.json({ error: 'Modul ini belum terbuka' }, { status: 403 })
    }
    // Pustaka Video: hanya video pertama tiap modul gratis, sisanya butuh season.
    if (lesson.position_id === 'pustaka' && lesson.urutan > 0 && !(await hasSeasonAccess(user.id))) {
      return NextResponse.json({ error: 'Video ini khusus pemilik season' }, { status: 403 })
    }

    await run(
      `INSERT INTO lesson_progress (user_id, lesson_id, status, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         status = excluded.status,
         completed_at = COALESCE(excluded.completed_at, lesson_progress.completed_at)`,
      user.id, lessonId, status, status === 'completed' ? nowIso() : null
    )

    return NextResponse.json({ success: true, xp: status === 'completed' ? lesson.xp : 0 })
  } catch (error) {
    console.error('Lesson progress API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
