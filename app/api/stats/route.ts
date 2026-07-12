import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// Kehadiran sosial asinkron: berapa orang (distinct) yang aktif menjalani simulasi
// dalam 7 hari terakhir. Dipakai job listing — kantor terasa berpenghuni.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getServiceClient()
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await db
      .from('user_progress')
      .select('user_id')
      .gt('last_active', since)
      .limit(1000)

    if (error) return NextResponse.json({ activeThisWeek: 0 })
    const activeThisWeek = new Set((data || []).map(r => r.user_id)).size
    return NextResponse.json({ activeThisWeek })
  } catch {
    return NextResponse.json({ activeThisWeek: 0 })
  }
}
