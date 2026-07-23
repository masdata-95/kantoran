import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
import { POSITIONS } from '@/lib/positions'

// Nilai numerik dari client di-clamp — server tidak menelan angka bebas
const clampInt = (v: unknown, min: number, max: number, fallback = 0): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), min), max)
}

// chat_history adalah kolom terbesar — batasi supaya satu user tidak bisa
// membanjiri database (payload normal satu run < 200KB)
const MAX_CHAT_HISTORY_BYTES = 900_000

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
    if (!POSITIONS[progress.position]) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const step = clampInt(progress.step, 0, 10)
    const chatHistory = progress.chatHistory || {}
    if (JSON.stringify(chatHistory).length > MAX_CHAT_HISTORY_BYTES) {
      return NextResponse.json({ error: 'Chat history too large' }, { status: 413 })
    }

    // Progress tidak boleh mundur — save dari tab/sesi lama tidak boleh menimpa
    // run yang sudah lebih maju. Mundur yang sah hanya lewat /api/reset (hapus baris).
    const { data: existing } = await supabase
      .from('user_progress')
      .select('step, sim_day')
      .eq('user_id', user.id)
      .eq('position', progress.position)
      .maybeSingle()

    // Hari simulasi (day 2+). Default ke nilai tersimpan supaya save yang tidak mengirim
    // simDay tidak pernah memundurkan hari; step & hari sama-sama tak boleh mundur (stale tab).
    const simDay = clampInt(progress.simDay, 1, 400, existing?.sim_day ?? 1)
    if (existing && (step < existing.step || simDay < (existing.sim_day ?? 1))) {
      return NextResponse.json(
        { error: 'Stale progress', currentStep: existing.step, currentDay: existing.sim_day ?? 1 },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        first_name: String(progress.firstName || '').slice(0, 80),
        email: String(progress.email || '').slice(0, 200),
        background: String(progress.background || '').slice(0, 40),
        bg_role: String(progress.bgRole || '').slice(0, 120),
        position: progress.position,
        level: progress.level ? String(progress.level).slice(0, 40) : null,
        step,
        coins: clampInt(progress.coins, 0, 100000),
        tasks_done: clampInt(progress.tasksDone, 0, 1000),
        streak: clampInt(progress.streak, 0, 10000),
        sim_day: simDay,
        last_active: new Date().toISOString(),
        chat_history: chatHistory,
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
