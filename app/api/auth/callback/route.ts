import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { one, run, nowIso } from '@/lib/db'
import { createSession } from '@/lib/serverAuth'
import { OAUTH_COOKIE, SESSION_COOKIE, parseOAuthCookie, sameString } from '@/lib/session'

export const dynamic = 'force-dynamic'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

interface UserRow {
  id: string
  google_sub: string | null
}

// Akhir login Google: tukar code → id_token, verifikasi tanda tangan Google, lalu cari
// atau buat user dan pasang cookie sesi.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const gagal = (alasan: string) => {
    const res = NextResponse.redirect(new URL(`/simulator?login=${alasan}`, url.origin))
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' })
    return res
  }

  const saved = parseOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (url.searchParams.get('error') || !saved || !code || !state || !sameString(state, saved.state)) {
    return gagal('dibatalkan')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return gagal('belum_diatur')

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${url.origin}/api/auth/callback`,
        grant_type: 'authorization_code',
        code_verifier: saved.verifier,
      }),
    })
    if (!tokenRes.ok) {
      console.error('Google token exchange gagal:', tokenRes.status)
      return gagal('gagal')
    }
    const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string }
    if (!idToken) return gagal('gagal')

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    })
    const sub = String(payload.sub || '')
    const email = String(payload.email || '').toLowerCase()
    if (!sub || !email || payload.email_verified !== true) return gagal('email_belum_terverifikasi')
    const name = typeof payload.name === 'string' ? payload.name : null
    const avatar = typeof payload.picture === 'string' ? payload.picture : null

    // 1) sudah pernah login dengan akun Google ini; 2) user lama yang dipindah dari
    // Supabase belum punya google_sub, jadi dicocokkan lewat email; 3) user baru.
    let user = await one<UserRow>('SELECT id, google_sub FROM users WHERE google_sub = ?', sub)
    if (!user) user = await one<UserRow>('SELECT id, google_sub FROM users WHERE email = ?', email)

    if (user) {
      await run(
        `UPDATE users SET google_sub = COALESCE(google_sub, ?), name = COALESCE(name, ?),
                avatar_url = ?, last_login = ? WHERE id = ?`,
        sub, name, avatar, nowIso(), user.id
      )
    } else {
      user = { id: crypto.randomUUID(), google_sub: sub }
      await run(
        `INSERT INTO users (id, email, name, avatar_url, google_sub, last_login) VALUES (?,?,?,?,?,?)`,
        user.id, email, name, avatar, sub, nowIso()
      )
    }

    const { token, maxAge } = await createSession(user.id, req.headers.get('user-agent'))
    const res = NextResponse.redirect(new URL(saved.next, url.origin))
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' })
    return res
  } catch (e) {
    console.error('Auth callback error:', e)
    return gagal('gagal')
  }
}
