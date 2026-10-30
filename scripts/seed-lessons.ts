// Seed konten Vantara Academy ke D1 — idempotent (upsert by slug).
// Jalankan: npm run seed:lessons          (D1 lokal, untuk dev dan uji)
//           npm run seed:lessons:remote   (D1 produksi)
//
// Alur authoring solo-founder:
//   edit file di content/lessons/ → jalankan ulang script ini.
//   Video: isi `video_code` (kode di pustaka video Mas Data, mis. looker-3-1-1) atau
//   `youtube_video_id` di frontmatter. Kolom yang tidak diisi frontmatter TIDAK menimpa
//   nilai yang sudah ada di database.
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { ROOT, q, NEW_ID, writeSql, runSql } from './_d1'

const CONTENT_DIR = join(ROOT, 'content', 'lessons')

interface ModuleDef {
  slug: string
  position_id: string
  title: string
  track: 'tools' | 'business'
  day: number
  sort_order: number
  npc_id?: string
  story_intro?: string
  teaser?: string
  is_published?: boolean
}

function main() {
  const sql: string[] = ['PRAGMA foreign_keys = ON;']

  // 1) Modul dari modules.json
  const modules: ModuleDef[] = JSON.parse(readFileSync(join(CONTENT_DIR, 'modules.json'), 'utf8'))
  console.log(`📦 ${modules.length} modul ditemukan`)
  for (const m of modules) {
    sql.push(
      `INSERT INTO lesson_modules (id, slug, position_id, title, track, day, sort_order, npc_id, story_intro, teaser, is_published)
       VALUES (${NEW_ID}, ${q(m.slug)}, ${q(m.position_id)}, ${q(m.title)}, ${q(m.track)}, ${q(m.day)}, ${q(m.sort_order)},
               ${q(m.npc_id || 'sup')}, ${q(m.story_intro || null)}, ${q(m.teaser || null)}, ${q(m.is_published !== false)})
       ON CONFLICT (slug) DO UPDATE SET
         position_id = excluded.position_id, title = excluded.title, track = excluded.track,
         day = excluded.day, sort_order = excluded.sort_order, npc_id = excluded.npc_id,
         story_intro = excluded.story_intro, teaser = excluded.teaser, is_published = excluded.is_published,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
    )
  }
  const moduleSlugs = new Set(modules.map(m => m.slug))

  // 2) Lessons dari file .md per folder posisi
  const folders = readdirSync(CONTENT_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
  let count = 0
  for (const folder of folders) {
    const files = readdirSync(join(CONTENT_DIR, folder.name)).filter(f => f.endsWith('.md')).sort()
    for (const file of files) {
      const raw = readFileSync(join(CONTENT_DIR, folder.name, file), 'utf8')
      const { data: fm, content } = matter(raw)

      if (!moduleSlugs.has(fm.module)) {
        console.error(`❌ ${folder.name}/${file}: module slug "${fm.module}" tidak ada di modules.json`)
        process.exit(1)
      }

      const mission = fm.type === 'mission'
        ? { brief: fm.mission_brief || '', rubric: { mustFind: fm.must_find || [], goodToMention: fm.good_to_mention || [] } }
        : null

      sql.push(
        `INSERT INTO lessons (id, slug, module_id, title, type, sort_order, content_md, youtube_video_id, video_code, mission, xp, is_published)
         VALUES (${NEW_ID}, ${q(fm.slug)}, (SELECT id FROM lesson_modules WHERE slug = ${q(fm.module)}), ${q(fm.title)},
                 ${q(fm.type)}, ${q(fm.sort_order ?? 0)}, ${q(content.trim() || null)},
                 ${q(fm.youtube_video_id || null)}, ${q(fm.video_code || null)}, ${q(mission)}, ${q(fm.xp ?? 10)},
                 ${q(fm.is_published !== false)})
         ON CONFLICT (slug) DO UPDATE SET
           module_id = excluded.module_id, title = excluded.title, type = excluded.type,
           sort_order = excluded.sort_order, content_md = excluded.content_md, mission = excluded.mission,
           xp = excluded.xp, is_published = excluded.is_published,
           youtube_video_id = COALESCE(excluded.youtube_video_id, lessons.youtube_video_id),
           video_code = COALESCE(excluded.video_code, lessons.video_code),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
      )
      count++
      console.log(`  ✓ lesson ${fm.slug} (${fm.type})`)
    }
  }

  const file = writeSql('lessons.sql', sql)
  runSql(file)
  console.log(`\n✅ Selesai: ${modules.length} modul, ${count} lesson di-seed.`)
}

main()
