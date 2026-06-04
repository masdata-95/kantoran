import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data || null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, profile } = body
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  const { data, error } = await supabase.from('user_profiles')
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
