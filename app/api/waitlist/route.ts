import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, email, name, rating, feedback, wishlist, positionTried } = body
  const { error } = await supabase.from('waitlist').insert({
    user_id: userId, email, name, rating, feedback, wishlist,
    position_tried: positionTried,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
