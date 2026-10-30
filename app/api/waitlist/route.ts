import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run } from '@/lib/db'

// Cek apakah user sudah pernah submit waitlist — form hanya muncul sekali seumur akun
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const row = await one('SELECT 1 AS ok FROM waitlist WHERE user_id = ? LIMIT 1', user.id)
  return NextResponse.json({ submitted: row !== null })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { email, name, rating, feedback, wishlist, positionTried } = body
  const items = Array.isArray(wishlist) ? wishlist.filter((w: unknown) => typeof w === 'string').slice(0, 30) : []
  const r = Number(rating)
  await run(
    `INSERT INTO waitlist (id, user_id, email, name, rating, feedback, wishlist, position_tried)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    user.id,
    String(email || user.email || '').slice(0, 200),
    name ? String(name).slice(0, 120) : null,
    Number.isFinite(r) && r > 0 ? Math.min(Math.round(r), 10) : null,
    feedback ? String(feedback).slice(0, 4000) : null,
    JSON.stringify(items),
    positionTried ? String(positionTried).slice(0, 40) : null
  )
  return NextResponse.json({ success: true })
}
