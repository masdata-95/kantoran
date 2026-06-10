// Server-side auth helper — verifikasi Supabase access token dari header Authorization
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

// Lazy init supaya tidak dievaluasi saat build (page data collection)
let admin: SupabaseClient | null = null
export function getServiceClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return admin
}

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const { data, error } = await getServiceClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
