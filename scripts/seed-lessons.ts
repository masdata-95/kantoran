// Seed konten Vantara Academy ke Supabase — idempotent (upsert by slug).
// Jalankan: npx tsx scripts/seed-lessons.ts
// Butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local
//
// Alur authoring solo-founder:
//   edit file di content/lessons/ → jalankan ulang script ini.
//   Untuk isi youtube_video_id belakangan: cukup edit kolomnya di Supabase Studio, tanpa deploy.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(__dirname, '..', 'content', 'lessons')

// Baca .env.local manual (tanpa dependency dotenv)
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
if (!url) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL kosong/tidak ditemukan di .env.local')
  process.exit(1)
}
if (!key) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY kosong di .env.local')
  console.error('   Ambil di: Supabase Studio → Project Settings → API → service_role (secret)')
  console.error('   Lalu isi baris SUPABASE_SERVICE_ROLE_KEY="eyJ..." di .env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

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

async function main() {
  // 1) Modul dari modules.json
  const modules: ModuleDef[] = JSON.parse(readFileSync(join(CONTENT_DIR, 'modules.json'), 'utf8'))
  console.log(`📦 ${modules.length} modul ditemukan`)

  const moduleIdBySlug = new Map<string, string>()
  for (const m of modules) {
    const { data, error } = await db
      .from('lesson_modules')
      .upsert({
        slug: m.slug,
        position_id: m.position_id,
        title: m.title,
        track: m.track,
        day: m.day,
        sort_order: m.sort_order,
        npc_id: m.npc_id || 'sup',
        story_intro: m.story_intro || null,
        teaser: m.teaser || null,
        is_published: m.is_published !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
      .select('id, slug')
      .single()
    if (error || !data) {
      console.error(`❌ Modul ${m.slug}:`, error?.message)
      process.exit(1)
    }
    moduleIdBySlug.set(data.slug, data.id)
    console.log(`  ✓ modul ${m.slug}`)
  }

  // 2) Lessons dari file .md per folder posisi
  const folders = readdirSync(CONTENT_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
  let count = 0
  for (const folder of folders) {
    const files = readdirSync(join(CONTENT_DIR, folder.name)).filter(f => f.endsWith('.md')).sort()
    for (const file of files) {
      const raw = readFileSync(join(CONTENT_DIR, folder.name, file), 'utf8')
      const { data: fm, content } = matter(raw)

      const moduleId = moduleIdBySlug.get(fm.module)
      if (!moduleId) {
        console.error(`❌ ${folder.name}/${file}: module slug "${fm.module}" tidak ada di modules.json`)
        process.exit(1)
      }

      const mission = fm.type === 'mission'
        ? { brief: fm.mission_brief || '', rubric: { mustFind: fm.must_find || [], goodToMention: fm.good_to_mention || [] } }
        : null

      const { error } = await db.from('lessons').upsert({
        slug: fm.slug,
        module_id: moduleId,
        title: fm.title,
        type: fm.type,
        sort_order: fm.sort_order ?? 0,
        content_md: content.trim() || null,
        // Jangan timpa video id yang sudah diisi manual di Studio: hanya set kalau frontmatter mengisinya
        ...(fm.youtube_video_id ? { youtube_video_id: fm.youtube_video_id } : {}),
        mission,
        xp: fm.xp ?? 10,
        is_published: fm.is_published !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
      if (error) {
        console.error(`❌ Lesson ${fm.slug}:`, error.message)
        process.exit(1)
      }
      count++
      console.log(`  ✓ lesson ${fm.slug} (${fm.type})`)
    }
  }

  console.log(`\n✅ Selesai: ${modules.length} modul, ${count} lesson di-seed.`)
}

main()
