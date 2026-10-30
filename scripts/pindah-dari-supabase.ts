// Ekspor data Supabase → berkas SQL untuk D1. Jalankan SEKALI saat cutover (lihat RENCANA-PINDAH-D1.md).
//
//   npx tsx scripts/pindah-dari-supabase.ts --hitung   hanya hitung baris per tabel (baca saja)
//   npx tsx scripts/pindah-dari-supabase.ts            tulis migrasi-data/*.sql
//
// Skrip ini HANYA MEMBACA dari Supabase dan menulis berkas di laptop. Ia tidak menyentuh Cloudflare.
// Memuatnya ke D1 adalah langkah terpisah (perintah dicetak di akhir). migrasi-data/ berisi data
// pribadi pengguna dan sudah ada di .gitignore.
//
// Tanpa pustaka Supabase: cukup fetch ke REST API-nya. Butuh NEXT_PUBLIC_SUPABASE_URL dan
// SUPABASE_SERVICE_ROLE_KEY di .env.local.
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TABEL, usersSql, type Row } from './lib/pindah'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

try {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* .env.local tidak ada — andalkan env shell */ }

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('❌ Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local')
  process.exit(1)
}
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const HITUNG_SAJA = process.argv.includes('--hitung')
const HALAMAN = 1000

async function ambilSemua(tabel: string, urut: string): Promise<Row[] | null> {
  const baris: Row[] = []
  for (let offset = 0; ; offset += HALAMAN) {
    const res = await fetch(`${URL_}/rest/v1/${tabel}?select=*&order=${urut}.asc&limit=${HALAMAN}&offset=${offset}`, { headers: HEAD })
    if (res.status === 404) return null // tabel belum ada di project ini
    if (!res.ok) throw new Error(`${tabel}: HTTP ${res.status} ${await res.text()}`)
    const page = (await res.json()) as Row[]
    baris.push(...page)
    if (page.length < HALAMAN) return baris
  }
}

async function ambilPengguna(): Promise<Record<string, unknown>[]> {
  const semua: Record<string, unknown>[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=${HALAMAN}`, { headers: HEAD })
    if (!res.ok) throw new Error(`auth users: HTTP ${res.status} ${await res.text()}`)
    const { users } = (await res.json()) as { users: Record<string, unknown>[] }
    semua.push(...users)
    if (users.length < HALAMAN) return semua
  }
}

// Hanya jumlah baris (Prefer: count=exact + HEAD): tidak ada data pengguna yang diunduh.
async function hitungBaris(tabel: string): Promise<number | null> {
  const res = await fetch(`${URL_}/rest/v1/${tabel}?select=*&limit=1`, { method: 'HEAD', headers: { ...HEAD, Prefer: 'count=exact' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${tabel}: HTTP ${res.status}`)
  const total = res.headers.get('content-range')?.split('/')[1]
  return total && total !== '*' ? Number(total) : null
}

async function hitungSaja() {
  console.log('Jumlah baris di Supabase (tanpa mengunduh isinya):\n')
  for (const t of TABEL) {
    const n = await hitungBaris(t.sumber)
    console.log(`  ${t.sumber.padEnd(16)} ${n === null ? '(tabel tidak ada atau jumlah tak tersedia)' : String(n).padStart(7)}`)
  }
  const res = await fetch(`${URL_}/auth/v1/admin/users?page=1&per_page=1`, { headers: HEAD })
  const total = res.ok ? ((await res.json()) as { total?: number }).total : undefined
  console.log(`  ${'auth.users'.padEnd(16)} ${total === undefined ? '(jumlah tak tersedia dari API)' : String(total).padStart(7)}`)
  console.log('\n(--hitung: tidak ada berkas ditulis)')
}

async function main() {
  if (HITUNG_SAJA) return hitungSaja()
  const out = join(ROOT, 'migrasi-data')
  mkdirSync(out, { recursive: true })
  const ringkas: string[] = []

  const users = await ambilPengguna()
  const sqlUsers = users.flatMap(u => usersSql(u as never))
  ringkas.push(`users            ${String(users.length).padStart(6)} akun, ${sqlUsers.length} dimuat (tanpa email dilewati)`)
  writeFileSync(join(out, '00_users.sql'), sqlUsers.join('\n') + '\n', 'utf8')

  let no = 1
  for (const t of TABEL) {
    const rows = await ambilSemua(t.sumber, t.urut)
    if (rows === null) { ringkas.push(`${t.tujuan.padEnd(16)} (tabel tidak ada, dilewati)`); no++; continue }
    const sql = rows.flatMap(t.ke)
    ringkas.push(`${t.tujuan.padEnd(16)} ${String(rows.length).padStart(6)} baris, ${sql.length} pernyataan`)
    writeFileSync(join(out, `${String(no).padStart(2, '0')}_${t.tujuan}.sql`), sql.join('\n') + '\n', 'utf8')
    no++
  }

  console.log('\n' + ringkas.join('\n'))
  console.log(`\n✅ Berkas ada di ${out}`)
  console.log('Muat ke D1 (urut nama berkas), sesudah `npm run db:migrate:remote`:')
  console.log('  for f in migrasi-data/*.sql; do npx wrangler d1 execute kantoran --remote -y --file=$f; done')
  console.log('Lalu: npm run seed:lessons:remote && npm run seed:tasks:remote')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
