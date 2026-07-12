import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

// Cek apakah user sudah pernah submit waitlist — form hanya muncul sekali seumur akun
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await getServiceClient()
    .from('waitlist')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submitted: (data || []).length > 0 })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { email, name, rating, feedback, wishlist, positionTried } = body
  const { error } = await getServiceClient().from('waitlist').insert({
    user_id: user.id, email, name, rating, feedback, wishlist,
    position_tried: positionTried,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
