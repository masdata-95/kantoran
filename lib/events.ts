import { run } from '@/lib/db'

// Catat event dari sisi server (first-party analytics). Tidak pernah melempar error:
// pencatatan yang gagal tidak boleh mengganggu permintaan pengguna.
export async function catatEvent(userId: string, type: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await run('INSERT INTO events (user_id, type, meta) VALUES (?, ?, ?)', userId, type, JSON.stringify(meta).slice(0, 2000))
  } catch (e) {
    console.warn('catatEvent gagal:', e)
  }
}