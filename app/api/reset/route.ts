import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run, parseJson } from '@/lib/db'

export const maxDuration = 10

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Multi-role: body { position } → reset run posisi itu saja; tanpa position → reset semua
    let position: string | undefined
    try {
      const body = await req.json()
      position = body?.position || undefined
    } catch { /* body kosong = reset semua */ }

    if (position) {
      await run('DELETE FROM user_progress WHERE user_id = ? AND position = ?', user.id, position)
    } else {
      await run('DELETE FROM user_progress WHERE user_id = ?', user.id)
    }

    // Pengalaman simulasi ditulis ke profil saat task approved — bersihkan hanya kalau
    // tidak ada run lain yang masih punya task selesai (run posisi lain tetap dihargai)
    const remaining = await one(
      'SELECT 1 AS ok FROM user_progress WHERE user_id = ? AND tasks_done > 0 LIMIT 1',
      user.id
    )

    if (!remaining) {
      const prof = await one<{ experience: string }>(
        'SELECT experience FROM user_profiles WHERE user_id = ?', user.id
      )
      const experience = parseJson<{ id?: string }[]>(prof?.experience, [])
      const cleaned = experience.filter(e => e?.id !== 'kantoran-sim')
      if (cleaned.length !== experience.length) {
        await run(
          'UPDATE user_profiles SET experience = ? WHERE user_id = ?',
          JSON.stringify(cleaned), user.id
        )
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Reset API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
