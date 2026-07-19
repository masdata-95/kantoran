// Event tracking first-party — fire and forget, TIDAK PERNAH mengganggu UX.
// Event masuk ke tabel `events` (migration 005) via /api/track, dibaca dashboard /admin.
import { authFetch } from '@/lib/supabase'

// Batasi banjir error client (loop error bisa mengirim ribuan event)
let clientErrorCount = 0
const MAX_CLIENT_ERRORS_PER_SESSION = 5

export function track(type: string, meta?: Record<string, unknown>) {
  try {
    if (type === 'client_error') {
      if (clientErrorCount >= MAX_CLIENT_ERRORS_PER_SESSION) return
      clientErrorCount++
    }
    authFetch('/api/track', {
      method: 'POST',
      body: JSON.stringify({ type, meta: meta || {} }),
    }).catch(() => { /* tracking gagal = bukan masalah user */ })
  } catch { /* abaikan */ }
}
