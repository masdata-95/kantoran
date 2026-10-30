import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { all, one, run, parseJson, nowIso } from '@/lib/db'
import { POSITIONS } from '@/lib/positions'

// Nilai numerik dari client di-clamp — server tidak menelan angka bebas
const clampInt = (v: unknown, min: number, max: number, fallback = 0): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), min), max)
}

// chat_history adalah kolom terbesar — batasi supaya satu user tidak bisa
// membanjiri database (payload normal satu run < 200KB; batas baris D1 2 MB)
const MAX_CHAT_HISTORY_BYTES = 900_000

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { progress } = body

    if (!progress || !progress.position) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!POSITIONS[progress.position]) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    const step = clampInt(progress.step, 0, 10)
    const chatJson = JSON.stringify(progress.chatHistory || {})
    if (chatJson.length > MAX_CHAT_HISTORY_BYTES) {
      return NextResponse.json({ error: 'Chat history too large' }, { status: 413 })
    }

    const existing = await one<{ step: number; sim_day: number | null }>(
      'SELECT step, sim_day FROM user_progress WHERE user_id = ? AND position = ?',
      user.id, progress.position
    )

    // Hari simulasi (day 2+). Default ke nilai tersimpan supaya save yang tidak mengirim
    // simDay tidak pernah memundurkan hari.
    const simDay = clampInt(progress.simDay, 1, 400, existing?.sim_day ?? 1)

    // Progress tidak boleh mundur — save dari tab/sesi lama tidak boleh menimpa run yang
    // sudah lebih maju. Pemeriksaan ada DI DALAM statement (klausa WHERE pada DO UPDATE),
    // jadi atomik: dua save bersamaan tidak bisa saling melewati pemeriksaan.
    // Mundur yang sah hanya lewat /api/reset (hapus baris).
    const now = nowIso()
    const res = await run(
      `INSERT INTO user_progress
         (id, user_id, first_name, email, background, bg_role, position, level,
          step, coins, tasks_done, streak, sim_day, last_active, chat_history, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, position) DO UPDATE SET
         first_name = excluded.first_name, email = excluded.email,
         background = excluded.background, bg_role = excluded.bg_role,
         level = excluded.level, step = excluded.step, coins = excluded.coins,
         tasks_done = excluded.tasks_done, streak = excluded.streak,
         sim_day = excluded.sim_day, last_active = excluded.last_active,
         chat_history = excluded.chat_history, updated_at = excluded.updated_at
       WHERE excluded.step >= user_progress.step AND excluded.sim_day >= user_progress.sim_day`,
      crypto.randomUUID(),
      user.id,
      String(progress.firstName || '').slice(0, 80),
      String(progress.email || '').slice(0, 200),
      String(progress.background || '').slice(0, 40),
      String(progress.bgRole || '').slice(0, 120),
      progress.position,
      progress.level ? String(progress.level).slice(0, 40) : null,
      step,
      clampInt(progress.coins, 0, 100000),
      clampInt(progress.tasksDone, 0, 1000),
      clampInt(progress.streak, 0, 10000),
      simDay,
      now,
      chatJson,
      now
    )

    if (res.meta.changes === 0) {
      const cur = await one<{ step: number; sim_day: number | null }>(
        'SELECT step, sim_day FROM user_progress WHERE user_id = ? AND position = ?',
        user.id, progress.position
      )
      return NextResponse.json(
        { error: 'Stale progress', currentStep: cur?.step ?? existing?.step ?? 0, currentDay: cur?.sim_day ?? 1 },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Progress save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ?list=1 → semua run milik user (tanpa chat_history) untuk hub karir di job listing
    if (req.nextUrl.searchParams.get('list') === '1') {
      const rows = await all(
        `SELECT position, level, step, coins, tasks_done, background, first_name, last_active
           FROM user_progress WHERE user_id = ? ORDER BY last_active DESC`,
        user.id
      )
      return NextResponse.json({ progresses: rows })
    }

    // ?position=... → progress run posisi itu; tanpa position → run terakhir aktif (kompat lama)
    const position = req.nextUrl.searchParams.get('position')

    // ?light=1 → tanpa chat_history (kolom terbesar) — cukup untuk routing stage awal
    const light = req.nextUrl.searchParams.get('light') === '1'
    const columns = light
      ? 'step, position, level, background, first_name, coins, tasks_done'
      : '*'

    const row = position
      ? await one<Record<string, unknown>>(
          `SELECT ${columns} FROM user_progress WHERE user_id = ? AND position = ?
            ORDER BY last_active DESC LIMIT 1`, user.id, position)
      : await one<Record<string, unknown>>(
          `SELECT ${columns} FROM user_progress WHERE user_id = ?
            ORDER BY last_active DESC LIMIT 1`, user.id)

    if (row && !light) {
      // Klien membaca objek, bukan teks JSON
      row.chat_history = parseJson(row.chat_history, {})
      row.task_submissions = parseJson(row.task_submissions, {})
    }
    return NextResponse.json({ progress: row })

  } catch (error) {
    console.error('Progress load error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
