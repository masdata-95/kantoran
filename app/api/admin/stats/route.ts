import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { all, one, parseJson } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// Dashboard monitoring founder — akses HANYA email di env ADMIN_EMAILS
// (dipisah koma). Env kosong = semua ditolak (default aman).
//
// Estimasi biaya AI dihitung dari api_usage (jumlah call per bucket) × perkiraan
// token per call × harga Gemini 2.5 Flash. Ini ESTIMASI kasar untuk monitoring tren,
// bukan tagihan — angka pasti tetap di Google Cloud Billing.
const EST = {
  usdToIdr: 16300,
  pricePerMTokenUsd: { input: 0.30, output: 2.50 }, // gemini-2.5-flash
  tokensPerCall: {
    chat:    { input: 2500, output: 250 },
    review:  { input: 3500, output: 500 },
    cv:      { input: 3000, output: 2000 },
    mission: { input: 2500, output: 400 },
  } as Record<string, { input: number; output: number }>,
}

function estimateCostIdr(calls: Record<string, number>): number {
  let usd = 0
  for (const [bucket, n] of Object.entries(calls)) {
    const t = EST.tokensPerCall[bucket] || EST.tokensPerCall.chat
    usd += (n * t.input / 1e6) * EST.pricePerMTokenUsd.input
    usd += (n * t.output / 1e6) * EST.pricePerMTokenUsd.output
  }
  return Math.round(usd * EST.usdToIdr)
}

const daysAgoIso = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString()
const daysAgoDate = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (!admins.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Users
    const profilesTotal = (await one<{ n: number }>('SELECT COUNT(*) AS n FROM user_profiles'))?.n ?? 0
    const profilesNew7d = (await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM user_profiles WHERE created_at > ?', daysAgoIso(7)))?.n ?? 0

    // Runs (multi-role: satu baris per user×posisi)
    const rows = await all<{ user_id: string; position: string; step: number; created_at: string; last_active: string | null }>(
      'SELECT user_id, position, step, created_at, last_active FROM user_progress LIMIT 5000'
    )

    const usersWithRun = new Set(rows.map(r => r.user_id))
    const lastActiveByUser = new Map<string, string>()
    for (const r of rows) {
      const prev = lastActiveByUser.get(r.user_id)
      if (!prev || (r.last_active && r.last_active > prev)) lastActiveByUser.set(r.user_id, r.last_active as string)
    }
    const activeUsers = (days: number) => {
      const since = daysAgoIso(days)
      return [...lastActiveByUser.values()].filter(t => t && t > since).length
    }
    // Churn proxy (belum ada revenue): user yang pernah main tapi diam > 14 hari
    const dormant14d = [...lastActiveByUser.values()].filter(t => !t || t <= daysAgoIso(14)).length
    const churnProxyPct = usersWithRun.size ? Math.round((dormant14d / usersWithRun.size) * 100) : 0

    // Funnel hari-1 (per RUN, sesuai definisi step di CLAUDE.md)
    const funnel = {
      runStarted: rows.length,
      interviewDone: rows.filter(r => r.step >= 2).length,      // offering keluar
      hired: rows.filter(r => r.step >= 3).length,               // kontrak diteken
      taskReceived: rows.filter(r => r.step >= 5).length,
      day1Done: rows.filter(r => r.step >= 10).length,
    }
    const completionPct = funnel.runStarted
      ? Math.round((funnel.day1Done / funnel.runStarted) * 100) : 0

    // Distribusi per posisi
    const byPosition: Record<string, { runs: number; done: number }> = {}
    for (const r of rows) {
      const p = r.position || 'unknown'
      byPosition[p] = byPosition[p] || { runs: 0, done: 0 }
      byPosition[p].runs++
      if (r.step >= 10) byPosition[p].done++
    }

    // Waitlist: hitung dan rata-rata rating langsung di SQL
    const wl = await one<{ n: number; avg: number | null }>(
      'SELECT COUNT(*) AS n, AVG(CASE WHEN rating > 0 THEN rating END) AS avg FROM waitlist'
    )
    const avgRating = wl?.avg != null ? Math.round(wl.avg * 10) / 10 : null

    // Pemakaian AI + estimasi biaya (api_usage: user_id, bucket, day, count)
    const usage = await all<{ bucket: string; day: string; count: number }>(
      'SELECT bucket, day, count FROM api_usage WHERE day >= ? LIMIT 10000', daysAgoDate(30)
    )
    const sumCalls = (days: number) => {
      const since = daysAgoDate(days)
      const acc: Record<string, number> = {}
      for (const u of usage) {
        if (u.day >= since) acc[u.bucket] = (acc[u.bucket] || 0) + (u.count || 0)
      }
      return acc
    }
    const calls1d = sumCalls(1)
    const calls7d = sumCalls(7)
    const calls30d = sumCalls(30)

    // Event funnel 7 hari + error client terbaru
    let events7d: Record<string, number> | null = null
    let clientErrors: { at: string; message: string; path?: string }[] | null = null
    const taskScores: number[] = []
    let taskPassCount = 0
    try {
      const evts = await all<{ type: string; meta: string; created_at: string }>(
        `SELECT type, meta, created_at FROM events WHERE created_at > ?
          ORDER BY created_at DESC LIMIT 5000`, daysAgoIso(7))
      events7d = {}
      clientErrors = []
      for (const e of evts) {
        events7d[e.type] = (events7d[e.type] || 0) + 1
        const meta = parseJson<Record<string, unknown>>(e.meta, {})
        if (e.type === 'client_error' && clientErrors.length < 10) {
          clientErrors.push({
            at: e.created_at,
            message: String(meta.message || '').slice(0, 200),
            path: meta.path ? String(meta.path) : undefined,
          })
        }
        // Skor review task (server-side) — untuk kalibrasi ambang lulus
        if (e.type === 'task_scored' && typeof meta.score === 'number') {
          taskScores.push(meta.score)
          if (meta.approved === true) taskPassCount++
        }
      }
    } catch { /* tabel events tidak terbaca */ }
    const avgTaskScore = taskScores.length
      ? Math.round(taskScores.reduce((a, b) => a + b, 0) / taskScores.length) : null

    // Revenue dari pesanan lunas (tabel orders)
    const rev = await one<{ n: number; total: number | null }>(
      "SELECT COUNT(*) AS n, SUM(amount) AS total FROM orders WHERE status = 'paid'"
    )

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      events: {
        available: events7d !== null,
        counts7d: events7d,
        clientErrors,
        note: events7d === null ? 'Tabel events tidak terbaca. Pastikan migrations/0001_awal.sql sudah dipasang.' : undefined,
      },
      review: {
        submissions7d: taskScores.length,
        avgScore: avgTaskScore,
        passRatePct: taskScores.length ? Math.round((taskPassCount / taskScores.length) * 100) : null,
        passScore: Math.min(Math.max(Number(process.env.KANTORAN_PASS_SCORE) || 70, 1), 100),
      },
      users: {
        total: profilesTotal,
        new7d: profilesNew7d,
        withRun: usersWithRun.size,
        active1d: activeUsers(1),
        active7d: activeUsers(7),
        dormant14d,
        churnProxyPct,
      },
      funnel: { ...funnel, completionPct },
      byPosition,
      waitlist: { total: wl?.n ?? 0, avgRating },
      ai: {
        calls1d, calls7d, calls30d,
        estCostIdr1d: estimateCostIdr(calls1d),
        estCostIdr7d: estimateCostIdr(calls7d),
        estCostIdr30d: estimateCostIdr(calls30d),
        note: 'Estimasi dari jumlah call × perkiraan token × harga gemini-2.5-flash. Angka pasti: Google Cloud Billing.',
      },
      revenue: rev && rev.n > 0
        ? { connected: true, totalIdr: rev.total ?? 0, orders: rev.n }
        : { connected: false, totalIdr: 0, note: 'Belum ada pesanan lunas.' },
    })
  } catch (e) {
    console.error('Admin stats error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
