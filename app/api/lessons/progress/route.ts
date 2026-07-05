import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

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

    const db = getServiceClient()

    // Validasi server-side: lesson ada, published, bukan mission, dan modulnya day 1 (gratis)
    const { data: lesson } = await db
      .from('lessons')
      .select('id, type, xp, is_published, lesson_modules!inner(day, is_published)')
      .eq('id', lessonId)
      .single()

    const moduleInfo = lesson?.lesson_modules as unknown as { day: number; is_published: boolean } | null
    if (!lesson || !lesson.is_published || !moduleInfo?.is_published) {
      return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 })
    }
    if (lesson.type === 'mission') {
      return NextResponse.json({ error: 'Misi diselesaikan lewat submit, bukan tandai selesai' }, { status: 400 })
    }
    if (moduleInfo.day > 1) {
      return NextResponse.json({ error: 'Modul ini belum terbuka' }, { status: 403 })
    }

    const { error } = await db
      .from('lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        status,
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: 'user_id,lesson_id' })

    if (error) {
      console.error('Lesson progress error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, xp: status === 'completed' ? lesson.xp : 0 })
  } catch (error) {
    console.error('Lesson progress API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
