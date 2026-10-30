import { NextRequest, NextResponse } from 'next/server'
import { OAUTH_COOKIE, pkcePair, randomToken, safeNext } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Awal login Google (Authorization Code + PKCE). State dan verifier disimpan di cookie
// pendek yang hanya dikirim ke /api/auth/*, lalu dicocokkan di callback.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Login Google belum dikonfigurasi.' }, { status: 500 })
  }

  const url = new URL(req.url)
  const next = safeNext(url.searchParams.get('next'))
  const state = randomToken(16)
  const { verifier, challenge } = await pkcePair()

  const g = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  g.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()

  const res = NextResponse.redirect(g)
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 600,
  })
  return res
}
