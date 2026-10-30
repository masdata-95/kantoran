import { NextRequest, NextResponse } from 'next/server'
import { one } from '@/lib/db'
import { getAuthUser } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

// Pengganti supabase.auth.getSession() di sisi klien. Selalu 200: user:null = belum masuk.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } })
    const u = await one<{ id: string; email: string; name: string | null; avatar_url: string | null }>(
      'SELECT id, email, name, avatar_url FROM users WHERE id = ?', auth.id
    )
    return NextResponse.json({ user: u }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('Auth me error:', e)
    return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
