import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'
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
  mission: { brief?: string } | null
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

    const db = getServiceClient()

    // Modul untuk posisi ini + modul bersama ('all')
    const { data: modules, error: modErr } = await db
      .from('lesson_modules')
      .select('id, slug, title, track, day, sort_order, npc_id, story_intro, teaser')
      .in('position_id', [position, 'all'])
      .eq('is_published', true)
      .order('day')
      .order('sort_order')

    if (modErr) {
      console.error('Lessons modules error:', modErr)
      return NextResponse.json({ error: 'Gagal memuat Academy.' }, { status: 500 })
    }

    const moduleRows = (modules || []) as ModuleRow[]
    const moduleIds = moduleRows.map(m => m.id)
    if (moduleIds.length === 0) return NextResponse.json({ modules: [] })

    const [{ data: lessons, error: lesErr }, { data: progress }] = await Promise.all([
      db.from('lessons')
        .select('id, module_id, slug, title, type, sort_order, content_md, youtube_video_id, mission, xp')
        .in('module_id', moduleIds)
        .eq('is_published', true)
        .order('sort_order'),
      db.from('lesson_progress')
        .select('lesson_id, status, score')
        .eq('user_id', user.id),
    ])

    if (lesErr) {
      console.error('Lessons error:', lesErr)
      return NextResponse.json({ error: 'Gagal memuat Academy.' }, { status: 500 })
    }

    const progressMap = new Map<string, ProgressRow>(
      ((progress || []) as ProgressRow[]).map(p => [p.lesson_id, p])
    )

    const result: ModuleDTO[] = moduleRows.map(m => {
      // Gate premium di API — konten modul day >= 2 tidak pernah dikirim ke client
      const locked = m.day > 1
      const moduleLessons: LessonDTO[] = ((lessons || []) as LessonRow[])
        .filter(l => l.module_id === m.id)
        .map(l => {
          const p = progressMap.get(l.id)
          return {
            id: l.id,
            slug: l.slug,
            title: l.title,
            type: l.type,
            sortOrder: l.sort_order,
            ...(locked ? {} : {
              contentMd: l.content_md || undefined,
              youtubeVideoId: l.youtube_video_id,
              missionBrief: l.mission?.brief || undefined,
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
