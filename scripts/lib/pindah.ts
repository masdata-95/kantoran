// Konversi baris Supabase (Postgres) → pernyataan SQL untuk D1 (SQLite).
// Fungsi murni, tanpa jaringan, supaya bisa diuji (tests/pindah.test.ts).
//
// Aturan penerjemahan:
//   JSONB / TEXT[]  → teks JSON          boolean → 0/1
//   timestamptz     → ISO-8601 UTC 'Z'   UUID    → dipertahankan apa adanya
// Batas D1: satu pernyataan maksimal 100 KB, sedangkan chat_history bisa mendekati 900 KB.
// Kolom besar diisi lewat INSERT kosong lalu UPDATE ... || 'potongan' berurutan.

export type Row = Record<string, unknown>

const CHUNK = 16_000 // karakter per potongan; aman di bawah 100 KB walau penuh karakter 4-byte

export const sqlText = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `'${s.replace(/'/g, "''")}'`
}

export const isoUtc = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// PostgREST mengembalikan JSONB sebagai objek dan TEXT[] sebagai array; keduanya jadi teks JSON.
const jsonText = (v: unknown, fallback: unknown): string =>
  JSON.stringify(v === null || v === undefined ? fallback : v)

// Potong teks tanpa membelah pasangan surrogate (emoji), supaya UTF-8 tidak rusak.
export function potong(teks: string, ukuran = CHUNK): string[] {
  const hasil: string[] = []
  let i = 0
  while (i < teks.length) {
    let akhir = Math.min(i + ukuran, teks.length)
    const c = teks.charCodeAt(akhir - 1)
    if (akhir < teks.length && c >= 0xd800 && c <= 0xdbff) akhir--
    hasil.push(teks.slice(i, akhir))
    i = akhir
  }
  return hasil
}

function insert(tabel: string, kolom: string[], nilai: unknown[]): string {
  return `INSERT OR REPLACE INTO ${tabel} (${kolom.join(',')}) VALUES (${nilai.map(sqlText).join(',')});`
}

// ---------------------------------------------------------------- users
interface AuthIdentity { provider?: string; id?: string; identity_data?: { sub?: string } }
interface AuthUser {
  id: string; email?: string; created_at?: string; last_sign_in_at?: string
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string }
  identities?: AuthIdentity[]
}

export function usersSql(u: AuthUser): string[] {
  if (!u.email) return [] // akun tanpa email tidak bisa dicocokkan saat login
  const google = (u.identities || []).find(i => i.provider === 'google')
  const m = u.user_metadata || {}
  return [insert('users',
    ['id', 'email', 'name', 'avatar_url', 'google_sub', 'created_at', 'last_login'],
    [u.id, u.email.toLowerCase(), m.full_name || m.name || null, m.avatar_url || m.picture || null,
     google?.identity_data?.sub || google?.id || null, isoUtc(u.created_at), isoUtc(u.last_sign_in_at)])]
}

// ------------------------------------------------------- user_progress
export function userProgressSql(r: Row): string[] {
  const chat = jsonText(r.chat_history, {})
  const tail = potong(chat)
  const sql = [insert('user_progress',
    ['id', 'user_id', 'first_name', 'email', 'background', 'bg_role', 'position', 'level', 'step', 'coins',
     'tasks_done', 'streak', 'sim_day', 'last_active', 'chat_history', 'task_submissions', 'created_at', 'updated_at'],
    [r.id, r.user_id, r.first_name, r.email, r.background, r.bg_role, r.position ?? '', r.level, r.step ?? 0,
     r.coins ?? 0, r.tasks_done ?? 0, r.streak ?? 0, r.sim_day ?? 1, isoUtc(r.last_active),
     tail.length > 1 ? '' : chat, jsonText(r.task_submissions, {}),
     isoUtc(r.created_at) ?? new Date().toISOString(), isoUtc(r.updated_at) ?? new Date().toISOString()])]
  if (tail.length > 1) {
    for (const bagian of tail) {
      sql.push(`UPDATE user_progress SET chat_history = chat_history || ${sqlText(bagian)} WHERE id = ${sqlText(r.id)};`)
    }
  }
  return sql
}

// -------------------------------------------------------- user_profiles
export function userProfilesSql(r: Row): string[] {
  return [insert('user_profiles',
    ['user_id', 'full_name', 'gender', 'city', 'education', 'experience', 'skills', 'category',
     'avatar_url', 'linkedin_url', 'created_at', 'updated_at'],
    [r.user_id, r.full_name, r.gender, r.city, jsonText(r.education, []), jsonText(r.experience, []),
     jsonText(r.skills, []), r.category, r.avatar_url, r.linkedin_url,
     isoUtc(r.created_at) ?? new Date().toISOString(), isoUtc(r.updated_at) ?? new Date().toISOString()])]
}

// ------------------------------------------------------------- waitlist
export function waitlistSql(r: Row): string[] {
  return [insert('waitlist',
    ['id', 'user_id', 'email', 'name', 'rating', 'feedback', 'wishlist', 'position_tried', 'created_at'],
    [r.id, r.user_id, r.email, r.name, r.rating, r.feedback, jsonText(r.wishlist, []), r.position_tried,
     isoUtc(r.created_at) ?? new Date().toISOString()])]
}

// ------------------------------------------- Academy (id dipertahankan!)
// lesson_progress menunjuk lessons.id (UUID). Kalau konten di-seed dari nol, id berganti dan
// progres murid yatim. Karena itu modul dan lesson dimuat dengan id lamanya; `seed:lessons`
// sesudahnya hanya meng-update baris yang sama (cocok lewat slug).
export function lessonModulesSql(r: Row): string[] {
  return [insert('lesson_modules',
    ['id', 'position_id', 'slug', 'title', 'track', 'day', 'sort_order', 'npc_id', 'story_intro', 'teaser',
     'is_published', 'created_at', 'updated_at'],
    [r.id, r.position_id, r.slug, r.title, r.track, r.day ?? 1, r.sort_order ?? 0, r.npc_id ?? 'sup',
     r.story_intro, r.teaser, r.is_published ? 1 : 0,
     isoUtc(r.created_at) ?? new Date().toISOString(), isoUtc(r.updated_at) ?? new Date().toISOString()])]
}

export function lessonsSql(r: Row): string[] {
  return [insert('lessons',
    ['id', 'module_id', 'slug', 'title', 'type', 'sort_order', 'content_md', 'youtube_video_id', 'mission', 'xp',
     'is_published', 'created_at', 'updated_at'],
    [r.id, r.module_id, r.slug, r.title, r.type, r.sort_order ?? 0, r.content_md, r.youtube_video_id,
     r.mission === null || r.mission === undefined ? null : jsonText(r.mission, null), r.xp ?? 10,
     r.is_published ? 1 : 0,
     isoUtc(r.created_at) ?? new Date().toISOString(), isoUtc(r.updated_at) ?? new Date().toISOString()])]
}

export function lessonProgressSql(r: Row): string[] {
  return [insert('lesson_progress',
    ['user_id', 'lesson_id', 'status', 'score', 'attempts', 'started_at', 'completed_at'],
    [r.user_id, r.lesson_id, r.status ?? 'in_progress', r.score, r.attempts ?? 0,
     isoUtc(r.started_at) ?? new Date().toISOString(), isoUtc(r.completed_at)])]
}

// ------------------------------------------------- events, entitlements
export function eventsSql(r: Row): string[] {
  return [insert('events', ['id', 'user_id', 'type', 'meta', 'created_at'],
    [r.id, r.user_id, r.type, jsonText(r.meta, {}), isoUtc(r.created_at) ?? new Date().toISOString()])]
}

// Yang paling penting: tanpa ini orang yang sudah bayar kehilangan akses season.
export function entitlementsSql(r: Row): string[] {
  return [insert('entitlements', ['id', 'user_id', 'product', 'starts_at', 'expires_at', 'source', 'created_at'],
    [r.id, r.user_id, r.product ?? 'season_1', isoUtc(r.starts_at) ?? new Date().toISOString(),
     isoUtc(r.expires_at), r.source, isoUtc(r.created_at) ?? new Date().toISOString()])]
}

// Urutan muat penting: induk dulu (users, modul), baru anak (progres, lesson).
export const TABEL: { sumber: string; tujuan: string; urut: string; ke: (r: Row) => string[] }[] = [
  { sumber: 'user_profiles',   tujuan: 'user_profiles',   urut: 'user_id',    ke: userProfilesSql },
  { sumber: 'user_progress',   tujuan: 'user_progress',   urut: 'id',         ke: userProgressSql },
  { sumber: 'waitlist',        tujuan: 'waitlist',        urut: 'id',         ke: waitlistSql },
  { sumber: 'lesson_modules',  tujuan: 'lesson_modules',  urut: 'id',         ke: lessonModulesSql },
  { sumber: 'lessons',         tujuan: 'lessons',         urut: 'id',         ke: lessonsSql },
  { sumber: 'lesson_progress', tujuan: 'lesson_progress', urut: 'user_id',    ke: lessonProgressSql },
  { sumber: 'entitlements',    tujuan: 'entitlements',    urut: 'id',         ke: entitlementsSql },
  { sumber: 'events',          tujuan: 'events',          urut: 'id',         ke: eventsSql },
]
