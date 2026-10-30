import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/serverAuth'
import { SESSION_COOKIE, sameOrigin } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.method, req.headers.get('origin'), req.headers.get('host'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete({ name: SESSION_COOKIE, path: '/' })
  return res
}
