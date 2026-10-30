import { one, nowIso } from '@/lib/db'

// Cek akses konten premium (day >= 2). Sumber entitlement: webhook Midtrans (nanti)
// atau insert manual lewat `wrangler d1 execute` (pre-sale early-bird).
// Error apa pun → false (semua terkunci, aman).
export async function hasSeasonAccess(userId: string): Promise<boolean> {
  try {
    const row = await one(
      `SELECT 1 AS ok FROM entitlements
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`,
      userId, nowIso()
    )
    return row !== null
  } catch {
    return false
  }
}
