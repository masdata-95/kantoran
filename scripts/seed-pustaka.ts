// Seed Pustaka Video (video Excel dan Looker Mas Data) ke D1 — idempotent (upsert by slug).
// Jalankan: npm run seed:pustaka          (D1 lokal)
//           npm run seed:pustaka:remote   (D1 produksi)
//
// Sumber: content/pustaka/katalog.json (satu modul per topik/bab, satu pelajaran per video).
// Modul memakai position_id 'pustaka' sehingga TIDAK pernah muncul di /api/lessons
// (yang hanya membaca posisi pengguna dan 'all'); Pustaka dilayani /api/pustaka.
import { readFileSync } from 'fs'
import { join } from 'path'
import { ROOT, q, NEW_ID, writeSql, runSql } from './_d1'

interface KatalogModul {
  slug: string
  grup: string
  title: string
  sort_order: number
  lessons: { slug: string; title: string; video_code: string; sort_order: number }[]
}

function main() {
  const katalog: KatalogModul[] = JSON.parse(readFileSync(join(ROOT, 'content', 'pustaka', 'katalog.json'), 'utf8'))
  const sql: string[] = ['PRAGMA foreign_keys = ON;']
  let jumlahVideo = 0

  for (const m of katalog) {
    // teaser dipakai sebagai nama grup (Excel / Looker Studio) di daftar Pustaka
    sql.push(
      `INSERT INTO lesson_modules (id, slug, position_id, title, track, day, sort_order, npc_id, teaser, is_published)
       VALUES (${NEW_ID}, ${q(m.slug)}, 'pustaka', ${q(m.title)}, 'tools', 1, ${q(m.sort_order)}, 'sup', ${q(m.grup)}, 1)
       ON CONFLICT (slug) DO UPDATE SET
         position_id = 'pustaka', title = excluded.title, track = 'tools', day = 1,
         sort_order = excluded.sort_order, teaser = excluded.teaser, is_published = 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
    )
    for (const l of m.lessons) {
      sql.push(
        `INSERT INTO lessons (id, slug, module_id, title, type, sort_order, video_code, xp, is_published)
         VALUES (${NEW_ID}, ${q(l.slug)}, (SELECT id FROM lesson_modules WHERE slug = ${q(m.slug)}), ${q(l.title)},
                 'video', ${q(l.sort_order)}, ${q(l.video_code)}, 5, 1)
         ON CONFLICT (slug) DO UPDATE SET
           module_id = excluded.module_id, title = excluded.title, type = 'video',
           sort_order = excluded.sort_order, video_code = excluded.video_code, is_published = 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
      )
      jumlahVideo++
    }
  }

  console.log(`📚 ${katalog.length} modul, ${jumlahVideo} video`)
  const file = writeSql('pustaka.sql', sql)
  runSql(file)
  console.log('\n✅ Selesai: Pustaka di-seed.')
}

main()
