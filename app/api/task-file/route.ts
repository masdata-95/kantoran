import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
import { hasSeasonAccess } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// File task premium disajikan dari bucket PRIVAT 'task-files' setelah cek entitlement.
// File day-1 boleh tetap di public/tasks/ (gratis); file day >= 2 WAJIB lewat sini —
// kalau ditaruh di public/, seluruh konten berbayar bisa diunduh tanpa bayar.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const slug = req.nextUrl.searchParams.get('slug') || ''
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

    const db = getServiceClient()
    const { data: task, error } = await db
      .from('tasks')
      .select('slug, day, task_type, file_name, is_published')
      .eq('slug', slug)
      .single()

    if (error || !task || !task.is_published || !task.file_name) {
      return NextResponse.json({ error: 'Task tidak ditemukan' }, { status: 404 })
    }

    // Gate premium di server — satu-satunya jalur menuju file day >= 2
    if (task.day >= 2 && !(await hasSeasonAccess(db, user.id))) {
      return NextResponse.json(
        { error: 'Konten season. Terbuka setelah kamu punya akses Kantoran penuh.' },
        { status: 403 }
      )
    }

    const { data: blob, error: dlError } = await db.storage
      .from('task-files')
      .download(task.file_name)

    if (dlError || !blob) {
      console.error('Task file download error:', dlError)
      return NextResponse.json({ error: 'File belum tersedia' }, { status: 404 })
    }

    return new NextResponse(await blob.arrayBuffer(), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${task.file_name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('Task file API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
