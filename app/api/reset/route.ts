import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export const maxDuration = 10

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getServiceClient()

    // Multi-role: body { position } → reset run posisi itu saja; tanpa position → reset semua
    let position: string | undefined
    try {
      const body = await req.json()
      position = body?.position || undefined
    } catch { /* body kosong = reset semua */ }

    let del = db.from('user_progress').delete().eq('user_id', user.id)
    if (position) del = del.eq('position', position)
    const { error } = await del

    if (error) {
      console.error('Reset error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Pengalaman simulasi ditulis ke profil saat task approved — bersihkan hanya kalau
    // tidak ada run lain yang masih punya task selesai (run posisi lain tetap dihargai)
    const { data: remaining } = await db
      .from('user_progress')
      .select('tasks_done')
      .eq('user_id', user.id)
      .gt('tasks_done', 0)
      .limit(1)

    if (!remaining || remaining.length === 0) {
      const { data: prof } = await db
        .from('user_profiles')
        .select('experience')
        .eq('user_id', user.id)
        .single()

      if (prof?.experience && Array.isArray(prof.experience)) {
        const cleaned = prof.experience.filter(
          (e: { id?: string }) => e?.id !== 'kantoran-sim'
        )
        if (cleaned.length !== prof.experience.length) {
          await db
            .from('user_profiles')
            .update({ experience: cleaned })
            .eq('user_id', user.id)
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Reset API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
