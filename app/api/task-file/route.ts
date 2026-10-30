import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { bindings, one } from '@/lib/db'
import { hasSeasonAccess } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// File task premium disajikan dari bucket R2 privat (TASK_FILES) setelah cek entitlement.
// File day-1 boleh tetap di public/tasks/ (gratis); file day >= 2 WAJIB lewat sini —
// kalau ditaruh di public/, seluruh konten berbayar bisa diunduh tanpa bayar.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const slug = req.nextUrl.searchParams.get('slug') || ''
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

    const task = await one<{ day: number; file_name: string | null; is_published: number }>(
      'SELECT day, file_name, is_published FROM tasks WHERE slug = ?', slug
    )

    if (!task || !task.is_published || !task.file_name) {
      return NextResponse.json({ error: 'Task tidak ditemukan' }, { status: 404 })
    }

    // Gate premium di server — satu-satunya jalur menuju file day >= 2
    if (task.day >= 2 && !(await hasSeasonAccess(user.id))) {
      return NextResponse.json(
        { error: 'Konten season. Terbuka setelah kamu punya akses Kantoran penuh.' },
        { status: 403 }
      )
    }

    const obj = await bindings().TASK_FILES.get(task.file_name)
    if (!obj) {
      console.error('Task file tidak ada di R2:', task.file_name)
      return NextResponse.json({ error: 'File belum tersedia' }, { status: 404 })
    }

    return new NextResponse(obj.body as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${task.file_name.replace(/["\r\n]/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('Task file API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
