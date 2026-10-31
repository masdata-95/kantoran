import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { all, envVar, placeholders } from '@/lib/db'
import { hasSeasonAccess } from '@/lib/entitlements'
import { buatLinkVideo } from '@/lib/videoToken'
import type { LessonDTO, ModuleDTO } from '@/lib/lessons'

export const dynamic = 'force-dynamic'

interface ModuleRow {
  id: string
  slug: string
  title: string
  sort_order: number
  teaser: string | null // dipakai sebagai nama grup
}

interface LessonRow {
  id: string
  module_id: string
  slug: string
  title: string
  sort_order: number
  video_code: string | null
  xp: number
}

interface ProgressRow {
  lesson_id: string
  status: 'in_progress' | 'completed'
  score: number | null
}

// Pustaka Video Mas Data (Excel dan Looker). Video pertama tiap modul gratis untuk semua
// yang login; sisanya butuh season (entitlement). Kode video dan link bertoken HANYA dikirim
// untuk video yang terbuka; video terkunci cuma membawa judul.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const moduleRows = await all<ModuleRow>(
      `SELECT id, slug, title, sort_order, teaser
         FROM lesson_modules
        WHERE position_id = 'pustaka' AND is_published = 1
        ORDER BY sort_order`
    )
    if (moduleRows.length === 0) return NextResponse.json({ modules: [], season: false })

    const ids = moduleRows.map(m => m.id)
    const [lessonRows, progressRows, season] = await Promise.all([
      all<LessonRow>(
        `SELECT id, module_id, slug, title, sort_order, video_code, xp
           FROM lessons
          WHERE module_id IN (${placeholders(ids.length)}) AND is_published = 1
          ORDER BY sort_order`,
        ...ids
      ),
      all<ProgressRow>('SELECT lesson_id, status, score FROM lesson_progress WHERE user_id = ?', user.id),
      hasSeasonAccess(user.id),
    ])
    const progressMap = new Map(progressRows.map(p => [p.lesson_id, p]))

    const kunci = envVar('KUNCI_VIDEO')
    const videoBase = envVar('VIDEO_BASE')

    const modules: ModuleDTO[] = await Promise.all(moduleRows.map(async m => {
      const rows = lessonRows.filter(l => l.module_id === m.id)
      const lessons: LessonDTO[] = await Promise.all(rows.map(async (l, i) => {
        const locked = !season && i > 0
        const p = progressMap.get(l.id)
        const videoUrl = !locked && l.video_code && kunci && videoBase
          ? await buatLinkVideo(kunci, videoBase, l.video_code)
          : null
        return {
          id: l.id,
          slug: l.slug,
          title: l.title,
          type: 'video' as const,
          sortOrder: l.sort_order,
          locked,
          ...(locked ? {} : { videoUrl }),
          xp: l.xp,
          progress: p ? { status: p.status, score: p.score } : null,
        }
      }))
      return {
        id: m.id,
        slug: m.slug,
        title: m.title,
        track: 'tools' as const,
        day: 1,
        npcId: 'sup',
        locked: false,
        grup: m.teaser || undefined,
        lessons,
      }
    }))

    return NextResponse.json({ modules, season })
  } catch (error) {
    console.error('Pustaka API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
