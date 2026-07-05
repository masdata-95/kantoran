// Server-side auth helper — verifikasi Supabase access token dari header Authorization.
// Jalur cepat: verifikasi JWT lokal (tanpa network round-trip ke Supabase Auth per request).
// Fallback: auth.getUser() via network kalau verifikasi lokal tidak tersedia/gagal.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose'

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

// Bentuk minimal yang dipakai semua route (hanya id + email)
export interface AuthUser {
  id: string
  email?: string
}

// HS256 (legacy JWT secret) — set SUPABASE_JWT_SECRET di env untuk mengaktifkan
let hsSecret: Uint8Array | null | undefined
function getHSSecret(): Uint8Array | null {
  if (hsSecret === undefined) {
    const raw = process.env.SUPABASE_JWT_SECRET
    hsSecret = raw ? new TextEncoder().encode(raw) : null
  }
  return hsSecret
}

// Asymmetric signing keys (project baru Supabase) — JWKS di-cache oleh jose
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
    )
  }
  return jwks
}

function payloadToUser(payload: JWTPayload): AuthUser | null {
  if (!payload.sub) return null
  if (payload.aud !== 'authenticated' && !(Array.isArray(payload.aud) && payload.aud.includes('authenticated'))) {
    return null
  }
  return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)

  // 1) Verifikasi lokal HS256 (kalau secret di-set)
  const secret = getHSSecret()
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, secret)
      return payloadToUser(payload)
    } catch {
      // token expired/invalid → jangan fallback ke network, tolak saja
      // KECUALI error karena algoritma tidak cocok (project pakai signing keys baru)
    }
  }

  // 2) Verifikasi lokal via JWKS (signing keys asimetris)
  try {
    const { payload } = await jwtVerify(token, getJWKS())
    return payloadToUser(payload)
  } catch { /* lanjut ke fallback network */ }

  // 3) Fallback: network call ke Supabase Auth (jalur lama, selalu benar)
  const { data, error } = await getServiceClient().auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? undefined }
}
