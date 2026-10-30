// Rate limiting harian per user — counter atomic di D1 (UPSERT ... RETURNING),
// pengganti RPC bump_usage di Postgres.
import { one } from '@/lib/db'

export type RateBucket = 'chat' | 'review' | 'cv' | 'mission'

// Cap harian per bucket — cukup longgar untuk pemakaian wajar,
// cukup ketat untuk mencegah satu akun menguras kuota AI
export const DAILY_LIMITS: Record<RateBucket, number> = {
  chat: 300,
  review: 25,
  cv: 10,
  mission: 30,
}

// TRUE = boleh lanjut. Fail-open: kalau D1 error, request tetap diizinkan
// supaya fitur tidak mati total.
export async function checkLimit(userId: string, bucket: RateBucket): Promise<boolean> {
  try {
    const day = new Date().toISOString().slice(0, 10)
    const row = await one<{ count: number }>(
      `INSERT INTO api_usage (user_id, bucket, day, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (user_id, bucket, day) DO UPDATE SET count = count + 1
       RETURNING count`,
      userId, bucket, day
    )
    return (row?.count ?? 0) <= DAILY_LIMITS[bucket]
  } catch (e) {
    console.warn(`Rate limit check gagal (${bucket}):`, e)
    return true
  }
}

export const LIMIT_MESSAGE: Record<RateBucket, string> = {
  chat: 'Kamu sudah banyak banget ngobrol hari ini. Lanjut lagi besok ya!',
  review: 'Batas review hari ini sudah tercapai. Coba lagi besok ya.',
  cv: 'Batas cek CV hari ini sudah tercapai (10x per hari). Coba lagi besok ya.',
  mission: 'Batas submit misi hari ini sudah tercapai. Lanjut lagi besok ya.',
}
