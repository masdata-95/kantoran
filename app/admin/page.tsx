'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase'

// Dashboard monitoring founder — akses diatur env ADMIN_EMAILS (lihat /api/admin/stats).
// Sengaja ringan: tanpa chart library, funnel digambar dengan div bar.

interface Stats {
  generatedAt: string
  users: { total: number; new7d: number; withRun: number; active1d: number; active7d: number; dormant14d: number; churnProxyPct: number }
  funnel: { runStarted: number; interviewDone: number; hired: number; taskReceived: number; day1Done: number; completionPct: number }
  byPosition: Record<string, { runs: number; done: number }>
  waitlist: { total: number; avgRating: number | null }
  ai: { calls1d: Record<string, number>; calls7d: Record<string, number>; calls30d: Record<string, number>; estCostIdr1d: number; estCostIdr7d: number; estCostIdr30d: number; note: string }
  revenue: { connected: boolean; totalIdr: number; note: string }
}

const idr = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const sumVals = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E5E3DC] rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-3">{title}</p>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <p className="font-serif text-2xl font-bold text-[#0F6E56] leading-tight">{value}</p>
      <p className="text-xs text-[#444441]">{label}</p>
      {sub && <p className="text-[10px] text-[#888780]">{sub}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await authFetch('/api/admin/stats')
        if (res.status === 401) { setError('Login dulu di /simulator, lalu buka halaman ini lagi.'); return }
        if (res.status === 403) { setError('Akses khusus founder. Set env ADMIN_EMAILS berisi email Google-mu, lalu redeploy.'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memuat')
        setStats(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat statistik')
      }
    })()
  }, [])

  if (error) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6">
      <p className="text-sm text-[#9A3412] bg-[#FDF2F0] border border-[#C2410C]/20 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
    </div>
  )

  if (!stats) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
      </div>
    </div>
  )

  const funnelSteps: { label: string; n: number }[] = [
    { label: 'Run dimulai', n: stats.funnel.runStarted },
    { label: 'Interview selesai', n: stats.funnel.interviewDone },
    { label: 'Kontrak diteken', n: stats.funnel.hired },
    { label: 'Task diterima', n: stats.funnel.taskReceived },
    { label: 'Hari-1 selesai', n: stats.funnel.day1Done },
  ]
  const funnelMax = Math.max(stats.funnel.runStarted, 1)

  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
          <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
          <span className="text-[#E5E3DC]">·</span>
          <span className="text-xs text-[#888780]">Dashboard Founder</span>
        </div>
        <p className="text-[10px] text-[#888780] mb-5">Diperbarui {new Date(stats.generatedAt).toLocaleString('id-ID')} · refresh halaman untuk data terbaru</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Users */}
          <Card title="Pengguna">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total akun" value={stats.users.total} sub={`+${stats.users.new7d} dalam 7 hari`} />
              <Stat label="Pernah main" value={stats.users.withRun} />
              <Stat label="Aktif 7 hari" value={stats.users.active7d} sub={`${stats.users.active1d} hari ini`} />
              <Stat label="Churn proxy" value={`${stats.users.churnProxyPct}%`} sub={`${stats.users.dormant14d} user diam > 14 hari`} />
            </div>
          </Card>

          {/* Waitlist + Revenue */}
          <Card title="Waitlist & Revenue">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Waitlist" value={stats.waitlist.total} sub={stats.waitlist.avgRating ? `rating rata-rata ${stats.waitlist.avgRating}/5` : 'belum ada rating'} />
              <Stat label="Revenue" value={stats.revenue.connected ? idr(stats.revenue.totalIdr) : 'Rp 0'} />
            </div>
            {!stats.revenue.connected && (
              <p className="text-[10px] text-[#888780] bg-[#F1EFE8] rounded-lg px-2.5 py-1.5">{stats.revenue.note}</p>
            )}
          </Card>

          {/* Funnel */}
          <Card title={`Funnel Hari-1 · completion ${stats.funnel.completionPct}% (target ≥ 40%)`}>
            <div className="flex flex-col gap-2">
              {funnelSteps.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-[11px] text-[#444441] mb-0.5">
                    <span>{s.label}</span>
                    <span className="font-semibold">{s.n}</span>
                  </div>
                  <div className="h-2 bg-[#F1EFE8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${Math.round((s.n / funnelMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Per posisi */}
          <Card title="Per Posisi (run / selesai hari-1)">
            <div className="flex flex-col gap-1.5">
              {Object.entries(stats.byPosition).sort((a, b) => b[1].runs - a[1].runs).map(([pos, v]) => (
                <div key={pos} className="flex justify-between text-xs border-b border-[#F1EFE8] last:border-0 py-1">
                  <span className="text-[#444441]">{pos}</span>
                  <span className="font-semibold text-[#111111]">{v.runs} <span className="text-[#0F6E56]">/ {v.done}</span></span>
                </div>
              ))}
              {Object.keys(stats.byPosition).length === 0 && <p className="text-xs text-[#888780]">Belum ada run.</p>}
            </div>
          </Card>

          {/* Biaya AI */}
          <Card title="Biaya AI (estimasi)">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Stat label="Hari ini" value={idr(stats.ai.estCostIdr1d)} sub={`${sumVals(stats.ai.calls1d)} call`} />
              <Stat label="7 hari" value={idr(stats.ai.estCostIdr7d)} sub={`${sumVals(stats.ai.calls7d)} call`} />
              <Stat label="30 hari" value={idr(stats.ai.estCostIdr30d)} sub={`${sumVals(stats.ai.calls30d)} call`} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(stats.ai.calls7d).map(([bucket, n]) => (
                <span key={bucket} className="text-[10px] bg-[#F1EFE8] text-[#444441] px-2 py-0.5 rounded-full">{bucket}: {n} (7h)</span>
              ))}
            </div>
            <p className="text-[10px] text-[#888780]">{stats.ai.note}</p>
          </Card>

          {/* Kesehatan sistem */}
          <Card title="Catatan">
            <ul className="text-xs text-[#444441] flex flex-col gap-1.5 list-disc pl-4">
              <li>Churn proxy = user pernah main yang diam &gt; 14 hari. Churn revenue menyusul setelah Xendit.</li>
              <li>Biaya hosting/domain tidak tercatat di sini — pantau di dashboard Cloudflare/registrar.</li>
              <li>Error production: pasang Sentry (masih P0) supaya kegagalan user real terlihat.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
