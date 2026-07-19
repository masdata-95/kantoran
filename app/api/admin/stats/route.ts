import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

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

    const db = getServiceClient()

    // Users
    const { count: profilesTotal } = await db.from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
    const { count: profilesNew7d } = await db.from('user_profiles')
      .select('user_id', { count: 'exact', head: true })
      .gt('created_at', daysAgoIso(7))

    // Runs (multi-role: satu baris per user×posisi)
    const { data: runs } = await db.from('user_progress')
      .select('user_id, position, step, created_at, last_active')
      .limit(5000)
    const rows = runs || []

    const usersWithRun = new Set(rows.map(r => r.user_id))
    const lastActiveByUser = new Map<string, string>()
    for (const r of rows) {
      const prev = lastActiveByUser.get(r.user_id)
      if (!prev || (r.last_active && r.last_active > prev)) lastActiveByUser.set(r.user_id, r.last_active)
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

    // Waitlist
    const { count: waitlistTotal } = await db.from('waitlist')
      .select('id', { count: 'exact', head: true })
    const { data: ratings } = await db.from('waitlist').select('rating').not('rating', 'is', null).limit(2000)
    const ratingVals = (ratings || []).map(r => Number(r.rating)).filter(n => n > 0)
    const avgRating = ratingVals.length
      ? Math.round((ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length) * 10) / 10 : null

    // Pemakaian AI + estimasi biaya (api_usage: user_id, bucket, day, count)
    const { data: usage } = await db.from('api_usage')
      .select('bucket, day, count')
      .gte('day', daysAgoDate(30))
      .limit(10000)
    const sumCalls = (days: number) => {
      const since = daysAgoDate(days)
      const acc: Record<string, number> = {}
      for (const u of usage || []) {
        if (u.day >= since) acc[u.bucket] = (acc[u.bucket] || 0) + (u.count || 0)
      }
      return acc
    }
    const calls1d = sumCalls(1)
    const calls7d = sumCalls(7)
    const calls30d = sumCalls(30)

    // Event funnel 7 hari + error client terbaru (tabel events, migration 005) —
    // toleran kalau migration belum jalan: field null + catatan
    let events7d: Record<string, number> | null = null
    let clientErrors: { at: string; message: string; path?: string }[] | null = null
    try {
      const { data: evts, error: evErr } = await db.from('events')
        .select('type, meta, created_at')
        .gt('created_at', daysAgoIso(7))
        .order('created_at', { ascending: false })
        .limit(5000)
      if (!evErr && evts) {
        events7d = {}
        clientErrors = []
        for (const e of evts) {
          events7d[e.type] = (events7d[e.type] || 0) + 1
          const meta = (e.meta || {}) as Record<string, unknown>
          if (e.type === 'client_error' && clientErrors.length < 10) {
            clientErrors.push({
              at: e.created_at,
              message: String(meta.message || '').slice(0, 200),
              path: meta.path ? String(meta.path) : undefined,
            })
          }
        }
      }
    } catch { /* tabel events belum ada */ }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      events: {
        available: events7d !== null,
        counts7d: events7d,
        clientErrors,
        note: events7d === null ? 'Jalankan supabase-migrations/005_observability.sql di Supabase Studio.' : undefined,
      },
      users: {
        total: profilesTotal ?? 0,
        new7d: profilesNew7d ?? 0,
        withRun: usersWithRun.size,
        active1d: activeUsers(1),
        active7d: activeUsers(7),
        dormant14d,
        churnProxyPct,
      },
      funnel: { ...funnel, completionPct },
      byPosition,
      waitlist: { total: waitlistTotal ?? 0, avgRating },
      ai: {
        calls1d, calls7d, calls30d,
        estCostIdr1d: estimateCostIdr(calls1d),
        estCostIdr7d: estimateCostIdr(calls7d),
        estCostIdr30d: estimateCostIdr(calls30d),
        note: 'Estimasi dari jumlah call × perkiraan token × harga gemini-2.5-flash. Angka pasti: Google Cloud Billing.',
      },
      // Revenue menyusul saat Xendit terpasang (tabel payments/entitlements)
      revenue: { connected: false, totalIdr: 0, note: 'Belum terhubung — menunggu integrasi Xendit.' },
    })
  } catch (e) {
    console.error('Admin stats error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
