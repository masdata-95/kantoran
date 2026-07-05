import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export const maxDuration = 10

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getServiceClient()

    const { error } = await db
      .from('user_progress')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Reset error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Pengalaman simulasi ditulis ke profil saat task approved — ikut dibersihkan saat reset,
    // kalau tidak, user yang restart masih punya "pengalaman Vantara" di CV-nya
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

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Reset API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
