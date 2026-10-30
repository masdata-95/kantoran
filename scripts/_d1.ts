// Pembantu bersama skrip seed: penulis SQL dan pemanggil wrangler.
// Seed tidak lagi menulis lewat API; ia menghasilkan berkas SQL (upsert) lalu menjalankannya
// dengan `wrangler d1 execute`. Default LOKAL; tambahkan --remote untuk database produksi.
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const REMOTE = process.argv.includes('--remote')
export const DB_NAME = 'kantoran'

// Nilai JS → literal SQL. Objek dan array disimpan sebagai teks JSON (kolom JSONB lama).
export function q(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `'${s.replace(/'/g, "''")}'`
}

// Id baris baru dibuat di SQL; pada konflik (slug sama) id lama dipertahankan.
export const NEW_ID = "lower(hex(randomblob(16)))"

export function writeSql(name: string, statements: string[]): string {
  const dir = join(ROOT, '.seed')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, name)
  writeFileSync(file, statements.join('\n') + '\n', 'utf8')
  return file
}

function wrangler(args: string[]) {
  // shell:true karena npx adalah npx.cmd di Windows
  execFileSync('npx', ['wrangler', ...args], { cwd: ROOT, stdio: 'inherit', shell: true })
}

export function runSql(file: string) {
  console.log(`\n→ wrangler d1 execute ${DB_NAME} ${REMOTE ? '--remote' : '--local'}`)
  wrangler(['d1', 'execute', DB_NAME, REMOTE ? '--remote' : '--local', '-y', `--file=${file}`])
}

export function putR2(bucket: string, key: string, file: string, contentType: string) {
  wrangler(['r2', 'object', 'put', `${bucket}/${key}`, `--file=${file}`, `--content-type=${contentType}`, REMOTE ? '--remote' : '--local'])
}
