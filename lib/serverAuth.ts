// Auth server: sesi cookie yang disimpan di D1 (pengganti verifikasi JWT Supabase).
// Bentuk kembalian getAuthUser sengaja sama dengan versi lama ({ id, email }), jadi isi
// route API yang memanggilnya tidak perlu berubah.
import type { NextRequest } from 'next/server'
import { one, run, nowIso } from '@/lib/db'
import { SESSION_COOKIE, SESSION_MAX_AGE, randomToken, sha256Hex, sameOrigin } from '@/lib/session'

export interface AuthUser {
  id: string
  email?: string
}

const HOUR = 3600 * 1000

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  if (!sameOrigin(req.method, req.headers.get('origin'), req.headers.get('host'))) return null

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || token.length < 20) return null

  const id = await sha256Hex(token)
  const row = await one<{ user_id: string; email: string; expires_at: string; last_seen: string }>(
    `SELECT s.user_id, u.email, s.expires_at, s.last_seen
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    id
  )
  if (!row || row.expires_at <= nowIso()) return null

  // Catat aktivitas paling banyak sekali per jam supaya tidak menulis di tiap request.
  if (Date.parse(row.last_seen) < Date.now() - HOUR) {
    await run('UPDATE sessions SET last_seen = ? WHERE id = ?', nowIso(), id)
  }
  return { id: row.user_id, email: row.email }
}

export async function createSession(userId: string, userAgent: string | null): Promise<{ token: string; maxAge: number }> {
  const token = randomToken(32)
  const now = Date.now()
  await run(
    `INSERT INTO sessions (id, user_id, created_at, last_seen, expires_at, user_agent) VALUES (?,?,?,?,?,?)`,
    await sha256Hex(token),
    userId,
    new Date(now).toISOString(),
    new Date(now).toISOString(),
    new Date(now + SESSION_MAX_AGE * 1000).toISOString(),
    (userAgent || '').slice(0, 200)
  )
  // Sesi kedaluwarsa dibersihkan sambil lewat, supaya tabel tidak menumpuk.
  await run('DELETE FROM sessions WHERE expires_at < ?', new Date(now).toISOString())
  return { token, maxAge: SESSION_MAX_AGE }
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return
  await run('DELETE FROM sessions WHERE id = ?', await sha256Hex(token))
}
