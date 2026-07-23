// Seed task season ke Supabase — idempotent (upsert by slug), meniru seed-lessons.
// Jalankan: npm run seed:tasks
// Butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local
//
// Alur authoring:
//   1. Tulis/edit content/tasks/<slug>.md (frontmatter + brief suara supervisor)
//   2. Kalau task_type=file: pastikan file-nya ada di content/task-files/
//      (dihasilkan `npm run generate:universe`)
//   3. `npm run seed:tasks` → upsert tabel tasks + upload file ke bucket privat
//      'task-files'. Rubric hidup di server, tidak pernah ke client.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TASKS_DIR = join(__dirname, '..', 'content', 'tasks')
const FILES_DIR = join(__dirname, '..', 'content', 'task-files')

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* .env.local tidak ada — andalkan env shell */ }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const VALID_TYPES = new Set(['file', 'text', 'sql', 'chat'])
const LEVELS = ['intern', 'junior', 'mid']

async function main() {
  if (!existsSync(TASKS_DIR)) {
    console.error(`❌ Folder ${TASKS_DIR} tidak ada`)
    process.exit(1)
  }
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.md')).sort()
  console.log(`📦 ${files.length} task ditemukan`)

  let uploaded = 0
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

    const { error } = await db.from('tasks').upsert({
      slug: fm.slug,
      position_id: fm.position_id,
      day: fm.day,
      sort_order: fm.sort_order ?? 1,
      title: fm.title,
      teaser: fm.teaser || null,
      brief: content.trim(),
      context: fm.context || null,
      task_type: fm.task_type,
      file_name: fm.file_name || null,
      cross_ref: fm.cross_ref || null,
      rubric: fm.rubric,
      approved_reaction: fm.approved_reaction || null,
      revision_reaction: fm.revision_reaction || null,
      is_published: fm.is_published !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
    if (error) {
      console.error(`❌ Task ${fm.slug}:`, error.message)
      process.exit(1)
    }
    console.log(`  ✓ task ${fm.slug} (day ${fm.day}, ${fm.task_type})`)

    // Upload file premium ke bucket privat (day 1 boleh tetap di public/tasks)
    if (fm.task_type === 'file' && fm.file_name && fm.day >= 2) {
      const filePath = join(FILES_DIR, fm.file_name)
      if (!existsSync(filePath)) {
        console.error(`❌ ${file}: ${fm.file_name} tidak ada di content/task-files/ — jalankan npm run generate:universe dulu`)
        process.exit(1)
      }
      const { error: upErr } = await db.storage
        .from('task-files')
        .upload(fm.file_name, readFileSync(filePath), {
          upsert: true,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      if (upErr) {
        console.error(`❌ Upload ${fm.file_name}:`, upErr.message)
        process.exit(1)
      }
      uploaded++
      console.log(`    ↑ ${fm.file_name} → bucket task-files`)
    }
  }

  console.log(`\n✅ Selesai: ${files.length} task di-seed, ${uploaded} file premium di-upload.`)
}

main()
