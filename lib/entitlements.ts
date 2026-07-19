import type { SupabaseClient } from '@supabase/supabase-js'

// Cek akses konten premium (day >= 2). Sumber entitlement: webhook Xendit (nanti)
// atau insert manual di Studio (pre-sale early-bird sekarang).
// Toleran kalau migration 006 belum jalan: tabel tidak ada → false (semua terkunci, aman).
export async function hasSeasonAccess(db: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('entitlements')
      .select('id, expires_at')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1)
    if (error) return false
    return (data || []).length > 0
  } catch {
    return false
  }
}
