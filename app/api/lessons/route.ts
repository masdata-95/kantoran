import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { all, envVar, parseJson, placeholders } from '@/lib/db'
import { buatLinkVideo } from '@/lib/videoToken'
import { POSITIONS } from '@/lib/positions'
import type { LessonDTO, ModuleDTO } from '@/lib/lessons'

export const dynamic = 'force-dynamic'

interface ModuleRow {
  id: string
  slug: string
  title: string
  track: 'tools' | 'business'
  day: number
  sort_order: number
  npc_id: string
  story_intro: string | null
  teaser: string | null
}

interface LessonRow {
  id: string
  module_id: string
  slug: string
  title: string
  type: 'text' | 'video' | 'mission'
  sort_order: number
  content_md: string | null
  youtube_video_id: string | null
  video_code: string | null
  mission: string | null
  xp: number
}

interface ProgressRow {
  lesson_id: string
  status: 'in_progress' | 'completed'
  score: number | null
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const position = req.nextUrl.searchParams.get('position') || ''
    if (!POSITIONS[position]) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Modul untuk posisi ini + modul bersama ('all')
    const moduleRows = await all<ModuleRow>(
      `SELECT id, slug, title, track, day, sort_order, npc_id, story_intro, teaser
         FROM lesson_modules
        WHERE position_id IN (?, 'all') AND is_published = 1
        ORDER BY day, sort_order`,
      position
    )
    if (moduleRows.length === 0) return NextResponse.json({ modules: [] })

    const ids = moduleRows.map(m => m.id)
    const [lessonRows, progressRows] = await Promise.all([
      all<LessonRow>(
        `SELECT id, module_id, slug, title, type, sort_order, content_md, youtube_video_id,
                video_code, mission, xp
           FROM lessons
          WHERE module_id IN (${placeholders(ids.length)}) AND is_published = 1
          ORDER BY sort_order`,
        ...ids
      ),
      all<ProgressRow>('SELECT lesson_id, status, score FROM lesson_progress WHERE user_id = ?', user.id),
    ])

    const progressMap = new Map(progressRows.map(p => [p.lesson_id, p]))

    // Link video bertoken dibuat di server hanya untuk lesson yang terbuka dan punya kode.
    const kunci = envVar('KUNCI_VIDEO')
    const videoBase = envVar('VIDEO_BASE')
    const videoUrls = new Map<string, string>()
    if (kunci && videoBase) {
      const modDay = new Map(moduleRows.map(m => [m.id, m.day]))
      await Promise.all(lessonRows
        .filter(l => l.video_code && (modDay.get(l.module_id) ?? 2) <= 1)
        .map(async l => { videoUrls.set(l.id, await buatLinkVideo(kunci, videoBase, l.video_code!)) }))
    }

    const result: ModuleDTO[] = moduleRows.map(m => {
      // Gate premium di API — konten modul day >= 2 tidak pernah dikirim ke client
      const locked = m.day > 1
      const moduleLessons: LessonDTO[] = lessonRows
        .filter(l => l.module_id === m.id)
        .map(l => {
          const p = progressMap.get(l.id)
          const mission = parseJson<{ brief?: string } | null>(l.mission, null)
          return {
            id: l.id,
            slug: l.slug,
            title: l.title,
            type: l.type,
            sortOrder: l.sort_order,
            ...(locked ? {} : {
              contentMd: l.content_md || undefined,
              youtubeVideoId: l.youtube_video_id,
              videoUrl: videoUrls.get(l.id) ?? null,
              missionBrief: mission?.brief || undefined,
            }),
            xp: l.xp,
            progress: p ? { status: p.status, score: p.score } : null,
          }
        })

      return {
        id: m.id,
        slug: m.slug,
        title: m.title,
        track: m.track,
        day: m.day,
        npcId: m.npc_id,
        storyIntro: locked ? undefined : (m.story_intro || undefined),
        teaser: m.teaser || undefined,
        locked,
        lessons: moduleLessons,
      }
    })

    return NextResponse.json({ modules: result })
  } catch (error) {
    console.error('Lessons API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
