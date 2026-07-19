import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

// Penerima event funnel + error client (first-party analytics).
// Prinsip: endpoint ini TIDAK PERNAH mengganggu app — selalu balas 200,
// kegagalan insert (termasuk tabel belum ada / migration 005 belum jalan) diabaikan.
const VALID_TYPES = new Set([
  'profile_done', 'apply',
  'interview_start', 'interview_done', 'interview_rejected',
  'offer_signed', 'training_done',
  'task_submitted', 'task_revision', 'task_approved',
  'day1_done', 'waitlist_submitted', 'sql_challenge_done',
  'client_error',
])

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ ok: false })

    const body = await req.json()
    const type = String(body?.type || '')
    if (!VALID_TYPES.has(type)) return NextResponse.json({ ok: false })

    // Cap ukuran meta — jangan biarkan client menyimpan blob bebas
    let meta: Record<string, unknown> = {}
    if (body?.meta && typeof body.meta === 'object') {
      const raw = JSON.stringify(body.meta)
      meta = raw.length > 2000 ? { truncated: raw.slice(0, 2000) } : body.meta
    }

    await getServiceClient().from('events').insert({ user_id: user.id, type, meta })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
