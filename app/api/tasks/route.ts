import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { all } from '@/lib/db'
import { hasSeasonAccess } from '@/lib/entitlements'
import { POSITIONS } from '@/lib/positions'

export const dynamic = 'force-dynamic'

interface TaskRow {
  slug: string
  position_id: string
  day: number
  sort_order: number
  title: string
  teaser: string | null
  brief: string
  context: string | null
  task_type: string
  file_name: string | null
  cross_ref: string | null
}

// Daftar task per posisi (tabel tasks).
// Gate premium DI SERVER: day 1 gratis; day >= 2 butuh entitlement.
// Task terkunci hanya mengirim {day, title, teaser} — brief/file tidak pernah bocor.
// Rubric TIDAK PERNAH dikirim ke client dalam kondisi apa pun (dinilai server-side).
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const position = req.nextUrl.searchParams.get('position') || ''
    if (!POSITIONS[position]) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const rows = await all<TaskRow>(
      `SELECT slug, position_id, day, sort_order, title, teaser, brief, context,
              task_type, file_name, cross_ref
         FROM tasks WHERE position_id = ? AND is_published = 1
        ORDER BY day, sort_order`,
      position
    )

    const premium = await hasSeasonAccess(user.id)

    const tasks = rows.map(t => {
      const locked = t.day >= 2 && !premium
      return locked
        ? { slug: t.slug, day: t.day, title: t.title, teaser: t.teaser, locked: true }
        : { ...t, locked: false }
    })

    return NextResponse.json({ tasks, premium })
  } catch (e) {
    console.error('Tasks API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
