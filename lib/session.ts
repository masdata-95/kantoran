// Helper sesi dan OAuth yang murni (tanpa D1 maupun Next), supaya bisa diuji langsung.
// Token sesi: 32 byte acak di cookie; yang disimpan di D1 hanya SHA-256-nya.

export const SESSION_COOKIE = 'kt_sesi'
export const OAUTH_COOKIE = 'kt_oauth'
export const SESSION_DAYS = 30
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600

const b64url = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// PKCE (RFC 7636): challenge = base64url(SHA-256(verifier)).
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(48)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return { verifier, challenge: b64url(digest) }
}

// Tujuan setelah login hanya boleh alamat di situs ini. Tanpa pemeriksaan ini,
// /api/auth/google?next=https://situs-jahat.com menjadi pintu open redirect.
export function safeNext(next: string | null | undefined, fallback = '/simulator'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  if (/[\u0000-\u001f]/.test(next)) return fallback
  return next
}

// Perlindungan CSRF untuk cookie sesi: permintaan yang mengubah data harus berasal dari
// host yang sama. Permintaan tanpa header Origin (curl, server ke server) tidak membawa
// cookie browser korban, jadi aman diizinkan.
export function sameOrigin(method: string, origin: string | null, host: string | null): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true
  if (!origin) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export interface OAuthState {
  state: string
  verifier: string
  next: string
}

export function parseOAuthCookie(raw: string | undefined): OAuthState | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    if (typeof o?.state === 'string' && typeof o?.verifier === 'string' && typeof o?.next === 'string') {
      return { state: o.state, verifier: o.verifier, next: safeNext(o.next) }
    }
  } catch { /* cookie rusak → dianggap tidak ada */ }
  return null
}

// Perbandingan waktu-konstan untuk state OAuth.
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
