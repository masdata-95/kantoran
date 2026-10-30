// Auth sisi browser (pengganti lib/supabase.ts). Sesi ada di cookie HttpOnly yang diatur
// server, jadi JavaScript di halaman tidak pernah memegang token apa pun.

export interface AppUser {
  id: string
  email?: string
  name?: string | null
  avatar_url?: string | null
}

// fetch ke /api/* — cookie sesi ikut otomatis (same-origin).
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  // hanya set JSON untuk body string; FormData biar browser yang set multipart boundary
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers, credentials: 'same-origin' })
}

// User yang sedang masuk, atau null. Pengganti supabase.auth.getSession().
export async function getUser(): Promise<AppUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
    const data = await res.json()
    return (data.user as AppUser | null) ?? null
  } catch {
    return null
  }
}

// Halaman penuh, bukan fetch: Google mengharuskan pengalihan di jendela utama.
export function loginWithGoogle(next = '/simulator') {
  window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch { /* tetap muat ulang: cookie lama ditolak server kalau sesinya sudah dihapus */ }
  window.location.href = '/simulator'
}
