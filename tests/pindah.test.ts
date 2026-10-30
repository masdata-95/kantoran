import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  sqlText, isoUtc, potong, usersSql, userProgressSql, userProfilesSql,
  waitlistSql, lessonProgressSql, entitlementsSql, eventsSql, lessonsSql,
} from '../scripts/lib/pindah'

describe('sqlText', () => {
  it('menggandakan tanda kutip dan menangani null/boolean/angka', () => {
    expect(sqlText("it's")).toBe("'it''s'")
    expect(sqlText(null)).toBe('NULL')
    expect(sqlText(undefined)).toBe('NULL')
    expect(sqlText(true)).toBe('1')
    expect(sqlText(7)).toBe('7')
    expect(sqlText(NaN)).toBe('NULL')
    expect(sqlText({ a: "x'y" })).toBe(`'{"a":"x''y"}'`)
  })
})

describe('isoUtc', () => {
  it('mengubah format Postgres (offset +00:00, mikrodetik) ke ISO UTC', () => {
    expect(isoUtc('2026-10-30T12:00:00.123456+00:00')).toBe('2026-10-30T12:00:00.123Z')
    expect(isoUtc('2026-10-30T19:00:00+07:00')).toBe('2026-10-30T12:00:00.000Z')
  })
  it('null untuk kosong atau tak terbaca', () => {
    expect(isoUtc(null)).toBeNull()
    expect(isoUtc('')).toBeNull()
    expect(isoUtc('bukan tanggal')).toBeNull()
  })
})

describe('potong (kolom besar)', () => {
  it('gabungan potongan sama persis dengan aslinya', () => {
    const s = 'abc'.repeat(30_000)
    const bagian = potong(s, 16_000)
    expect(bagian.join('')).toBe(s)
    expect(bagian.every(b => b.length <= 16_000)).toBe(true)
  })
  it('tidak membelah pasangan surrogate (emoji)', () => {
    const s = '😀'.repeat(20)
    // ukuran ganjil memaksa batas jatuh di tengah emoji
    const bagian = potong(s, 5)
    expect(bagian.join('')).toBe(s)
    for (const b of bagian) {
      const akhir = b.charCodeAt(b.length - 1)
      expect(akhir >= 0xd800 && akhir <= 0xdbff).toBe(false)
    }
  })
})

describe('users', () => {
  it('mengambil google_sub dari identities dan nama dari metadata', () => {
    const [sql] = usersSql({
      id: 'u1', email: 'Budi@Contoh.com', created_at: '2026-10-01T00:00:00+00:00',
      user_metadata: { full_name: 'Budi', avatar_url: 'https://x/a.png' },
      identities: [{ provider: 'google', identity_data: { sub: '1234567890' } }],
    })
    expect(sql).toContain("'budi@contoh.com'")
    expect(sql).toContain("'1234567890'")
    expect(sql).toContain("'Budi'")
  })
  it('akun tanpa email dilewati', () => {
    expect(usersSql({ id: 'u2' })).toEqual([])
  })
})

describe('user_progress', () => {
  const dasar = { id: 'p1', user_id: 'u1', position: 'data_analyst', step: 6, coins: 40, tasks_done: 1, streak: 2, last_active: '2026-10-30T10:00:00+00:00' }

  it('chat_history objek jadi teks JSON, satu pernyataan', () => {
    const sql = userProgressSql({ ...dasar, chat_history: { hr: [{ t: "halo 'dunia'" }] } })
    expect(sql).toHaveLength(1)
    expect(sql[0]).toContain(`"halo ''dunia''"`)
  })

  it('chat_history besar dipecah: INSERT kosong + UPDATE berurutan, tiap pernyataan < 100 KB', () => {
    const besar = { hr: Array.from({ length: 6000 }, (_, i) => ({ t: `pesan ke-${i} 😀 'kutip' `.repeat(3) })) }
    const json = JSON.stringify(besar)
    expect(json.length).toBeGreaterThan(300_000)
    const sql = userProgressSql({ ...dasar, chat_history: besar })
    expect(sql.length).toBeGreaterThan(5)
    expect(sql[0].startsWith('INSERT')).toBe(true)
    expect(sql.slice(1).every(s => s.startsWith('UPDATE user_progress SET chat_history = chat_history ||'))).toBe(true)
    for (const s of sql) expect(Buffer.byteLength(s, 'utf8')).toBeLessThan(100_000)

    // Susun ulang apa yang akan dihasilkan D1 dan pastikan sama dengan aslinya.
    const potongan = sql.slice(1).map(s => /\|\| '([\s\S]*)' WHERE/.exec(s)![1].replace(/''/g, "'"))
    expect(potongan.join('')).toBe(json)
  })

  it('field kosong diberi nilai bawaan yang sah', () => {
    const [sql] = userProgressSql({ id: 'p2', user_id: 'u1', position: null, chat_history: null })
    expect(sql).toContain("''") // position ''
    expect(sql).toContain("'{}'") // chat_history default
  })
})

describe('tabel lain', () => {
  it('user_profiles: array skills jadi teks JSON', () => {
    const [sql] = userProfilesSql({ user_id: 'u1', full_name: 'Budi', education: [{ id: 'e' }], experience: null, skills: ['Excel', 'SQL'] })
    expect(sql).toContain(`'["Excel","SQL"]'`)
    expect(sql).toContain(`'[{"id":"e"}]'`)
    expect(sql).toContain(`'[]'`) // experience null → []
  })
  it('waitlist: wishlist array jadi teks JSON', () => {
    expect(waitlistSql({ id: 'w1', user_id: 'u1', email: 'a@b.c', wishlist: ['Sertifikat'] })[0]).toContain(`'["Sertifikat"]'`)
  })
  it('lessons: mission JSONB jadi teks JSON, boolean jadi 0/1', () => {
    const [sql] = lessonsSql({ id: 'l1', module_id: 'm1', slug: 's', title: 't', type: 'mission', mission: { brief: 'b' }, is_published: true })
    expect(sql).toContain(`'{"brief":"b"}'`)
    expect(sql).toMatch(/,1,'20\d\d-/) // is_published = 1 sebelum created_at
  })
  it('lesson_progress, entitlements, events', () => {
    expect(lessonProgressSql({ user_id: 'u', lesson_id: 'l', status: 'completed', score: 90, attempts: 2, completed_at: '2026-10-30T00:00:00Z' })[0]).toContain("'completed',90,2")
    expect(entitlementsSql({ id: 'e1', user_id: 'u', product: 'season_1', expires_at: null, source: 'presale-manual' })[0]).toContain('NULL,\'presale-manual\'')
    expect(eventsSql({ id: 12, user_id: 'u', type: 'apply', meta: { position: 'x' } })[0]).toContain(`'{"position":"x"}'`)
  })
})

describe('SQL hasil konversi valid di SQLite sungguhan', () => {
  it('skema 0001_awal menerima semua pernyataan', async () => {
    // node:sqlite ada di Node 22 tetapi belum di @types/node v20 proyek ini, jadi bentuk yang
    // dipakai dideklarasikan di sini. Nama modul lewat variabel supaya bundler tidak ikut memprosesnya.
    interface Db { exec(s: string): void; prepare(s: string): { get(...p: unknown[]): unknown } }
    const modul = 'node:sqlite'
    const { DatabaseSync } = (await import(/* @vite-ignore */ modul)) as { DatabaseSync: new (p: string) => Db }
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec(readFileSync(join(__dirname, '..', 'migrations', '0001_awal.sql'), 'utf8'))

    const stmts = [
      ...usersSql({ id: 'u1', email: 'budi@contoh.com', identities: [{ provider: 'google', identity_data: { sub: '9' } }] }),
      ...userProfilesSql({ user_id: 'u1', full_name: 'Budi', skills: ['Excel'] }),
      ...userProgressSql({ id: 'p1', user_id: 'u1', position: 'data_analyst', step: 3, chat_history: { a: "x'y".repeat(20_000) } }),
      ...waitlistSql({ id: 'w1', user_id: 'u1', email: 'budi@contoh.com', wishlist: ['A'] }),
      ...entitlementsSql({ id: 'e1', user_id: 'u1', source: 'presale-manual' }),
      ...eventsSql({ id: 1, user_id: 'u1', type: 'apply', meta: {} }),
    ]
    for (const s of stmts) db.exec(s)

    const progres = db.prepare('SELECT chat_history FROM user_progress WHERE id = ?').get('p1') as { chat_history: string }
    expect(JSON.parse(progres.chat_history).a).toBe("x'y".repeat(20_000))
    expect((db.prepare('SELECT google_sub FROM users').get() as { google_sub: string }).google_sub).toBe('9')
    expect(JSON.parse((db.prepare('SELECT skills FROM user_profiles').get() as { skills: string }).skills)).toEqual(['Excel'])
  })
})
