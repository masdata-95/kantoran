// Akses D1 (pengganti getServiceClient Supabase).
// Binding DB dan TASK_FILES dideklarasikan di wrangler.jsonc. Dipanggil dari route handler,
// jadi getCloudflareContext() sinkron cukup; di `next dev` binding datang dari D1 lokal.
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

interface Bindings {
  DB: D1Database
  TASK_FILES: R2Bucket
}

export function bindings(): Bindings {
  return getCloudflareContext().env as unknown as Bindings
}

export const db = (): D1Database => bindings().DB

// Variabel dan secret Worker. Di Cloudflare keduanya ada di binding env; di `next dev` nilai dari
// wrangler.jsonc ikut lewat binding, sedangkan secret biasanya datang dari .env.local (process.env).
export function envVar(name: string): string | undefined {
  const v = (getCloudflareContext().env as unknown as Record<string, unknown>)[name]
  return typeof v === 'string' && v ? v : process.env[name]
}

// D1 menolak `undefined` di bind(); ubah ke NULL supaya pemanggil tak perlu ingat.
const clean = (p: unknown[]) => p.map(v => (v === undefined ? null : v))

export async function one<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db().prepare(sql).bind(...clean(params)).first<T>()) ?? null
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  return (await db().prepare(sql).bind(...clean(params)).all<T>()).results
}

export async function run(sql: string, ...params: unknown[]) {
  return db().prepare(sql).bind(...clean(params)).run()
}

// Beberapa pernyataan dalam satu transaksi (D1 batch bersifat atomik).
export async function batch(statements: { sql: string; params?: unknown[] }[]) {
  const d = db()
  return d.batch(statements.map(s => d.prepare(s.sql).bind(...clean(s.params ?? []))))
}

// Waktu disimpan sebagai teks ISO-8601 UTC, sama dengan format TIMESTAMPTZ yang dibaca
// kode sejak awal; urutan teksnya identik dengan urutan waktunya.
export const nowIso = () => new Date().toISOString()

// Kolom JSON disimpan sebagai TEXT (JSONB dan TEXT[] di Postgres).
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const placeholders = (n: number) => Array(n).fill('?').join(',')
