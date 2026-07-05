// Rate limiting harian per user — counter atomic di Postgres (RPC bump_usage).
// Bekerja identik di Vercel dan Cloudflare Workers (tidak bergantung state in-memory).
import { getServiceClient } from '@/lib/serverAuth'

export type RateBucket = 'chat' | 'review' | 'cv' | 'mission'

// Cap harian per bucket — cukup longgar untuk pemakaian wajar,
// cukup ketat untuk mencegah satu akun menguras kuota AI
export const DAILY_LIMITS: Record<RateBucket, number> = {
  chat: 300,
  review: 25,
  cv: 10,
  mission: 30,
}

// TRUE = boleh lanjut. Fail-open: kalau RPC error (mis. migration belum jalan),
// request tetap diizinkan supaya fitur tidak mati total.
export async function checkLimit(userId: string, bucket: RateBucket): Promise<boolean> {
  try {
    const { data, error } = await getServiceClient().rpc('bump_usage', {
      uid: userId,
      b: bucket,
      max_count: DAILY_LIMITS[bucket],
    })
    if (error) {
      console.warn(`Rate limit RPC error (${bucket}):`, error.message)
      return true
    }
    return data === true
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
