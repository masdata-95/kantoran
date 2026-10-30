import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Kehadiran sosial asinkron: berapa orang (distinct) yang aktif menjalani simulasi
// dalam 7 hari terakhir. Dipakai job listing — kantor terasa berpenghuni.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const row = await one<{ n: number }>(
      'SELECT COUNT(DISTINCT user_id) AS n FROM user_progress WHERE last_active > ?', since
    )
    return NextResponse.json({ activeThisWeek: row?.n ?? 0 })
  } catch {
    return NextResponse.json({ activeThisWeek: 0 })
  }
}
