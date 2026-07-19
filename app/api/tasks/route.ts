import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
import { hasSeasonAccess } from '@/lib/entitlements'
import { POSITIONS } from '@/lib/positions'

export const dynamic = 'force-dynamic'

// Daftar task per posisi (tabel tasks, migration 006).
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

    const db = getServiceClient()
    const { data: rows, error } = await db
      .from('tasks')
      .select('slug, position_id, day, sort_order, title, teaser, brief, context, task_type, file_name, cross_ref')
      .eq('position_id', position)
      .eq('is_published', true)
      .order('day', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) {
      // Tabel belum ada (migration 006 belum jalan) → daftar kosong, bukan error
      return NextResponse.json({ tasks: [], note: 'Jalankan migration 006.' })
    }

    const premium = await hasSeasonAccess(db, user.id)

    const tasks = (rows || []).map(t => {
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
