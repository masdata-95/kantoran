// Seed task season ke D1 + R2 — idempotent (upsert by slug), meniru seed-lessons.
// Jalankan: npm run seed:tasks          (D1 + R2 lokal)
//           npm run seed:tasks:remote   (produksi)
//
// Alur authoring:
//   1. Tulis/edit content/tasks/<slug>.md (frontmatter + brief suara supervisor)
//   2. Kalau task_type=file: pastikan file-nya ada di content/task-files/
//      (dihasilkan `npm run generate:universe`)
//   3. `npm run seed:tasks` → upsert tabel tasks + unggah file premium ke bucket R2 privat
//      kantoran-task-files. Rubric hidup di server, tidak pernah ke client.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { ROOT, q, NEW_ID, writeSql, runSql, putR2 } from './_d1'

const TASKS_DIR = join(ROOT, 'content', 'tasks')
const FILES_DIR = join(ROOT, 'content', 'task-files')
const BUCKET = 'kantoran-task-files'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const VALID_TYPES = new Set(['file', 'text', 'sql', 'chat'])
const LEVELS = ['intern', 'junior', 'mid']

function main() {
  if (!existsSync(TASKS_DIR)) {
    console.error(`❌ Folder ${TASKS_DIR} tidak ada`)
    process.exit(1)
  }
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.md')).sort()
  console.log(`📦 ${files.length} task ditemukan`)

  const sql: string[] = []
  const uploads: { name: string; path: string }[] = []

  for (const file of files) {
    const raw = readFileSync(join(TASKS_DIR, file), 'utf8')
    let parsed: ReturnType<typeof matter>
    try {
      parsed = matter(raw)
    } catch (e) {
      console.error(`❌ ${file}: frontmatter YAML tidak valid — ${(e as Error).message}`)
      console.error(`   Hint umum: nilai yang memuat ": " (titik dua + spasi) dibaca YAML sebagai mapping. Kutip nilainya atau ganti tanda lain.`)
      process.exit(1)
    }
    const { data: fm, content } = parsed

    // Validasi authoring — gagal keras supaya typo ketahuan saat seed, bukan saat user main
    for (const req of ['slug', 'position_id', 'day', 'title', 'task_type', 'rubric']) {
      if (fm[req] === undefined || fm[req] === null || fm[req] === '') {
        console.error(`❌ ${file}: frontmatter '${req}' wajib diisi`)
        process.exit(1)
      }
    }
    if (!VALID_TYPES.has(fm.task_type)) {
      console.error(`❌ ${file}: task_type '${fm.task_type}' tidak dikenal (file|text|sql|chat)`)
      process.exit(1)
    }
    const rubricLevels = Object.keys(fm.rubric || {})
    if (!rubricLevels.some(l => LEVELS.includes(l))) {
      console.error(`❌ ${file}: rubric harus punya minimal satu level (intern/junior/mid)`)
      process.exit(1)
    }
    for (const lv of rubricLevels) {
      if (!Array.isArray(fm.rubric[lv]?.must_find) || fm.rubric[lv].must_find.length === 0) {
        console.error(`❌ ${file}: rubric.${lv}.must_find wajib berisi minimal 1 item`)
        process.exit(1)
      }
    }
    if (fm.task_type === 'file' && !fm.file_name) {
      console.error(`❌ ${file}: task_type 'file' butuh file_name`)
      process.exit(1)
    }

    sql.push(
      `INSERT INTO tasks (id, slug, position_id, day, sort_order, title, teaser, brief, context, task_type,
                          file_name, cross_ref, rubric, approved_reaction, revision_reaction, is_published)
       VALUES (${NEW_ID}, ${q(fm.slug)}, ${q(fm.position_id)}, ${q(fm.day)}, ${q(fm.sort_order ?? 1)}, ${q(fm.title)},
               ${q(fm.teaser || null)}, ${q(content.trim())}, ${q(fm.context || null)}, ${q(fm.task_type)},
               ${q(fm.file_name || null)}, ${q(fm.cross_ref || null)}, ${q(fm.rubric)},
               ${q(fm.approved_reaction || null)}, ${q(fm.revision_reaction || null)}, ${q(fm.is_published !== false)})
       ON CONFLICT (slug) DO UPDATE SET
         position_id = excluded.position_id, day = excluded.day, sort_order = excluded.sort_order,
         title = excluded.title, teaser = excluded.teaser, brief = excluded.brief, context = excluded.context,
         task_type = excluded.task_type, file_name = excluded.file_name, cross_ref = excluded.cross_ref,
         rubric = excluded.rubric, approved_reaction = excluded.approved_reaction,
         revision_reaction = excluded.revision_reaction, is_published = excluded.is_published,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
    )
    console.log(`  ✓ task ${fm.slug} (day ${fm.day}, ${fm.task_type})`)

    // File premium ke bucket privat (day 1 boleh tetap di public/tasks)
    if (fm.task_type === 'file' && fm.file_name && fm.day >= 2) {
      const filePath = join(FILES_DIR, fm.file_name)
      if (!existsSync(filePath)) {
        console.error(`❌ ${file}: ${fm.file_name} tidak ada di content/task-files/ — jalankan npm run generate:universe dulu`)
        process.exit(1)
      }
      uploads.push({ name: fm.file_name, path: filePath })
    }
  }

  runSql(writeSql('tasks.sql', sql))
  for (const u of uploads) {
    putR2(BUCKET, u.name, u.path, XLSX)
    console.log(`    ↑ ${u.name} → R2 ${BUCKET}`)
  }
  console.log(`\n✅ Selesai: ${files.length} task di-seed, ${uploads.length} file premium diunggah.`)
}

main()
