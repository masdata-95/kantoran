import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getServiceClient()

    const body = await req.json()
    const { progress } = body

    if (!progress || !progress.position) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        first_name: progress.firstName,
        email: progress.email,
        background: progress.background,
        bg_role: progress.bgRole,
        position: progress.position,
        level: progress.level || null,
        step: progress.step,
        coins: progress.coins,
        tasks_done: progress.tasksDone,
        streak: progress.streak,
        last_active: new Date().toISOString(),
        chat_history: progress.chatHistory || {},
      }, {
        // Multi-role: satu baris per (user, posisi) — butuh migration 004
        onConflict: 'user_id,position'
      })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('Progress save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const db = getServiceClient()

    // ?list=1 → semua run milik user (tanpa chat_history) untuk hub karir di job listing
    if (req.nextUrl.searchParams.get('list') === '1') {
      const { data, error } = await db
        .from('user_progress')
        .select('position, level, step, coins, tasks_done, background, first_name, last_active')
        .eq('user_id', user.id)
        .order('last_active', { ascending: false })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ progresses: data || [] })
    }

    // ?position=... → progress run posisi itu; tanpa position → run terakhir aktif (kompat lama)
    const position = req.nextUrl.searchParams.get('position')

    // ?light=1 → tanpa chat_history (kolom terbesar) — cukup untuk routing stage awal
    const light = req.nextUrl.searchParams.get('light') === '1'
    const columns = light
      ? 'step, position, level, background, first_name, coins, tasks_done'
      : '*'

    let query = db
      .from('user_progress')
      .select(columns)
      .eq('user_id', user.id)

    if (position) query = query.eq('position', position)

    const { data, error } = await query
      .order('last_active', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ progress: data || null })

  } catch (error) {
    console.error('Progress load error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
