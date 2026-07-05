// Validasi konten Academy tanpa menulis ke database — cek sebelum seed.
// Jalankan: npx tsx scripts/validate-lessons.ts
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(__dirname, '..', 'content', 'lessons')

const modules = JSON.parse(readFileSync(join(CONTENT_DIR, 'modules.json'), 'utf8'))
const moduleSlugs = new Set(modules.map((m: { slug: string }) => m.slug))
console.log(`Modul: ${modules.length}`)
for (const m of modules) {
  if (!m.slug || !m.position_id || !m.title || !m.track || m.day == null) throw new Error(`Modul tidak lengkap: ${JSON.stringify(m)}`)
  if (!['tools', 'business'].includes(m.track)) throw new Error(`Track invalid: ${m.slug}`)
}

const lessonSlugs = new Set<string>()
let lessons = 0, missions = 0, videos = 0
const folders = readdirSync(CONTENT_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
for (const folder of folders) {
  for (const file of readdirSync(join(CONTENT_DIR, folder.name)).filter(f => f.endsWith('.md'))) {
    const { data: fm, content } = matter(readFileSync(join(CONTENT_DIR, folder.name, file), 'utf8'))
    const ctx = `${folder.name}/${file}`
    if (!fm.module || !moduleSlugs.has(fm.module)) throw new Error(`${ctx}: module "${fm.module}" tidak ada di modules.json`)
    if (!fm.slug) throw new Error(`${ctx}: slug kosong`)
    if (lessonSlugs.has(fm.slug)) throw new Error(`${ctx}: slug duplikat ${fm.slug}`)
    lessonSlugs.add(fm.slug)
    if (!['text', 'video', 'mission'].includes(fm.type)) throw new Error(`${ctx}: type invalid "${fm.type}"`)
    if (fm.type === 'mission') {
      if (!fm.mission_brief || !Array.isArray(fm.must_find) || fm.must_find.length === 0) throw new Error(`${ctx}: mission_brief/must_find kurang`)
      missions++
    }
    if (fm.type === 'video') videos++
    if (fm.type !== 'mission' && content.trim().length < 200) throw new Error(`${ctx}: konten terlalu pendek`)
    lessons++
  }
}
console.log(`Lesson: ${lessons} (misi: ${missions}, video-slot: ${videos})`)
console.log('✅ Semua konten valid — siap di-seed')
