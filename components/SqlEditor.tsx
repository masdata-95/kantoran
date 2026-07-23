'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import type { Database } from 'sql.js'
import { resultsMatch, type QueryResult } from '@/lib/sqlCompare'
import { track } from '@/lib/track'

// "Database Vantara" — SQL editor in-story untuk Data Analyst.
// Seluruh database berjalan DI BROWSER (sql.js WASM + public/data/vantara.db) —
// tidak pernah menyentuh database asli. Tantangan dinilai otomatis dengan
// membandingkan hasil query user vs query referensi (lib/sqlCompare.ts), tanpa AI.

type ChLevel = 'intern' | 'junior' | 'mid'

interface Challenge {
  id: string
  level: ChLevel
  title: string
  brief: string
  hint: string
  ref: string
  reward: number
}

// Label kelompok tingkat untuk header di daftar soal.
const LEVEL_GROUP: Record<ChLevel, string> = {
  intern: 'Dasar · cocok untuk Intern',
  junior: 'Menengah · cocok untuk Junior',
  mid: 'Lanjutan · investigasi kasus (Mid)',
}

// Semua soal tampil untuk SEMUA level (latihan opsional, boleh lompat tingkat).
// Tiap query referensi (ref) SUDAH diverifikasi jalan terhadap public/data/vantara.db.
// Tingkat mid langsung menyambung investigasi task day 2-3 (Jatim anjlok, tunggakan Berkah Jaya).
const CHALLENGES: Challenge[] = [
  // ── Dasar (Intern): SELECT, WHERE, satu agregat ──
  {
    id: 'c1', level: 'intern',
    title: 'Pemanasan: total revenue Januari 2026',
    brief: 'Berapa total revenue (satu angka) dari semua penjualan di Januari 2026?',
    hint: "SUM(revenue), lalu saring bulannya: WHERE order_date LIKE '2026-01%'",
    ref: "SELECT SUM(revenue) FROM sales WHERE order_date LIKE '2026-01%'",
    reward: 15,
  },
  {
    id: 'in2', level: 'intern',
    title: 'Berapa order lewat E-commerce di 2026?',
    brief: 'Hitung jumlah baris order (satu angka) yang channel-nya E-commerce sepanjang tahun 2026.',
    hint: "COUNT(*) dengan dua filter digabung AND: channel = 'E-commerce' dan order_date LIKE '2026%'",
    ref: "SELECT COUNT(*) FROM sales WHERE channel = 'E-commerce' AND order_date LIKE '2026%'",
    reward: 15,
  },
  {
    id: 'in3', level: 'intern',
    title: 'Channel mana penyumbang terbesar (2026)?',
    brief: 'Tampilkan total revenue per channel sepanjang 2026, urut dari terbesar.',
    hint: 'GROUP BY channel, lalu ORDER BY totalnya DESC',
    ref: "SELECT channel, SUM(revenue) AS revenue FROM sales WHERE order_date LIKE '2026%' GROUP BY channel ORDER BY revenue DESC",
    reward: 20,
  },
  // ── Menengah (Junior): JOIN sederhana, kebersihan data ──
  {
    id: 'jr1', level: 'junior',
    title: 'Revenue per brand (2026)',
    brief: 'Tabel sales hanya punya SKU, bukan nama brand. Gabungkan dengan tabel products untuk menghitung total revenue per brand di 2026, urut terbesar.',
    hint: 'JOIN products ON products.sku = sales.sku, lalu GROUP BY brand',
    ref: "SELECT p.brand AS brand, SUM(s.revenue) AS revenue FROM sales s JOIN products p ON p.sku = s.sku WHERE s.order_date LIKE '2026%' GROUP BY p.brand ORDER BY revenue DESC",
    reward: 25,
  },
  {
    id: 'c2', level: 'junior',
    title: 'Top 5 SKU sepanjang 2025',
    brief: 'Tampilkan 5 SKU dengan total revenue terbesar di 2025. Hati-hati: penulisan SKU tidak konsisten (ada yang huruf kecil), satukan dulu sebelum grouping.',
    hint: 'UPPER(sku) supaya lum-001 dan LUM-001 terhitung satu, lalu GROUP BY, ORDER BY ... DESC, LIMIT 5',
    ref: "SELECT UPPER(sku) AS sku, SUM(revenue) AS total FROM sales WHERE order_date LIKE '2025%' GROUP BY UPPER(sku) ORDER BY total DESC LIMIT 5",
    reward: 25,
  },
  {
    id: 'jr3', level: 'junior',
    title: 'Revenue per region (2026) — ada yang janggal',
    brief: 'Hitung total revenue per region sepanjang 2026, urut terbesar. Perhatikan: ada baris yang region-nya kosong. Jangan dibuang, justru itu temuan yang perlu dilaporkan.',
    hint: 'GROUP BY region akan menampilkan baris region kosong (NULL) sebagai kelompok tersendiri',
    ref: "SELECT region, SUM(revenue) AS revenue FROM sales WHERE order_date LIKE '2026%' GROUP BY region ORDER BY revenue DESC",
    reward: 30,
  },
  // ── Lanjutan (Mid): investigasi Kasus Region Timur (nyambung task day 2-3) ──
  {
    id: 'c3', level: 'mid',
    title: 'Kapan Jawa Timur mulai anjlok?',
    brief: 'Tampilkan revenue per bulan (format YYYY-MM) untuk region Jawa Timur sepanjang 2026. Dari hasilnya kamu akan lihat sendiri bulan mulai anjloknya, simpan temuan ini.',
    hint: "substr(order_date, 1, 7) menghasilkan 'YYYY-MM' untuk dikelompokkan per bulan",
    ref: "SELECT substr(order_date,1,7) AS bulan, SUM(revenue) AS revenue FROM sales WHERE region = 'Jawa Timur' AND order_date LIKE '2026%' GROUP BY bulan ORDER BY bulan",
    reward: 30,
  },
  {
    id: 'md2', level: 'mid',
    title: 'Distributor mana yang menunggak?',
    brief: 'Dari tabel payments, cari distributor yang tagihannya belum lunas (invoice_amount lebih besar dari paid_amount). Tampilkan nama distributor dan total tunggakannya, hanya yang masih punya tunggakan.',
    hint: 'JOIN distributors untuk ambil nama, SUM(invoice_amount - paid_amount) sebagai tunggakan, lalu saring dengan HAVING ... > 0',
    ref: "SELECT d.name AS distributor, SUM(p.invoice_amount - p.paid_amount) AS tunggakan FROM payments p JOIN distributors d ON d.distributor_id = p.distributor_id GROUP BY d.name HAVING SUM(p.invoice_amount - p.paid_amount) > 0 ORDER BY tunggakan DESC",
    reward: 40,
  },
  {
    id: 'md3', level: 'mid',
    title: 'Seberapa dalam Jawa Timur turun (YoY)?',
    brief: 'Bandingkan total revenue Jawa Timur tahun 2025 vs 2026. Tampilkan dua baris (tahun dan revenue) supaya besar penurunannya kelihatan.',
    hint: 'substr(order_date, 1, 4) mengambil tahun dari tanggal; lalu GROUP BY tahun',
    ref: "SELECT substr(order_date,1,4) AS tahun, SUM(revenue) AS revenue FROM sales WHERE region = 'Jawa Timur' GROUP BY tahun ORDER BY tahun",
    reward: 40,
  },
]

const MAX_DISPLAY_ROWS = 200
const STARTER_QUERY = 'SELECT * FROM sales LIMIT 10'

export default function SqlEditor({ userId, onCoins }: {
  userId: string
  onCoins: (n: number) => void
}) {
  const dbRef = useRef<Database | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [schema, setSchema] = useState<{ table: string; columns: string[] }[]>([])
  const [query, setQuery] = useState(STARTER_QUERY)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [challengeMsg, setChallengeMsg] = useState<Record<string, string>>({})

  const doneKey = `kantoran_sql_done_${userId}`

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(doneKey) || '{}')) } catch { /* abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Muat engine + database di browser — sekali per mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const initSqlJs = (await import('sql.js')).default
        const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' })
        const res = await fetch('/data/vantara.db')
        if (!res.ok) throw new Error('File database tidak ditemukan')
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const db = new SQL.Database(new Uint8Array(buf))
        dbRef.current = db

        // Fungsi kompatibilitas: banyak yang datang dari MySQL/Postgres menulis
        // YEAR()/MONTH(). SQLite tak punya (tanggal = teks ISO), jadi kita daftarkan
        // supaya query natural mereka tetap jalan. Kembalikan INTEGER agar
        // perbandingan seperti YEAR(order_date)=2026 cocok. EXTRACT tak bisa dishim
        // karena itu sintaks ("YEAR FROM"), bukan fungsi biasa.
        try {
          const dbFn = db as unknown as { create_function: (n: string, f: (...a: unknown[]) => unknown) => void }
          dbFn.create_function('YEAR', (d: unknown) => d ? parseInt(String(d).slice(0, 4), 10) : null)
          dbFn.create_function('MONTH', (d: unknown) => d ? parseInt(String(d).slice(5, 7), 10) : null)
        } catch { /* versi sql.js lama tanpa create_function → user pakai substr/strftime */ }

        // Schema browser: daftar tabel + kolom
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        const schemaList: { table: string; columns: string[] }[] = []
        for (const row of tables[0]?.values || []) {
          const table = String(row[0])
          const info = db.exec(`PRAGMA table_info(${table})`)
          schemaList.push({ table, columns: (info[0]?.values || []).map(c => String(c[1])) })
        }
        setSchema(schemaList)
        setReady(true)
      } catch (e) {
        console.error('SQL editor load error:', e)
        if (!cancelled) setLoadError('Gagal memuat database. Refresh halaman atau cek koneksi.')
      }
    })()
    return () => { cancelled = true; dbRef.current?.close(); dbRef.current = null }
  }, [])

  const runQuery = (sql: string): QueryResult | { error: string } => {
    const db = dbRef.current
    if (!db) return { error: 'Database belum siap' }
    const trimmed = sql.trim().toLowerCase()
    if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
      return { error: 'Aksesmu read-only, hanya query SELECT yang diizinkan.' }
    }
    try {
      const out = db.exec(sql)
      if (!out.length) return { columns: [], values: [] }
      return { columns: out[0].columns, values: out[0].values as unknown[][] }
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Query error'
      // Bantu user yang menulis sintaks PostgreSQL — database ini SQLite
      const up = sql.toUpperCase()
      if (/EXTRACT\s*\(|DATE_TRUNC/.test(up)) {
        msg += ". Catatan: database ini SQLite, EXTRACT tidak didukung. Untuk ambil tahun/bulan pakai YEAR(order_date), strftime('%Y',order_date), atau saring dengan order_date LIKE '2026-01%'."
      } else if (/\bNOW\s*\(|GETDATE|CURRENT_DATE/.test(up)) {
        msg += ". Untuk tanggal sekarang di SQLite pakai date('now')."
      }
      return { error: msg }
    }
  }

  const handleRun = () => {
    setChallengeMsg({})
    const out = runQuery(query)
    if ('error' in out) {
      setQueryError(out.error)
      setResult(null)
      return
    }
    setQueryError('')
    setRowCount(out.values.length)
    setResult({ columns: out.columns, values: out.values.slice(0, MAX_DISPLAY_ROWS) })
  }

  // Grading otomatis: hasil query user (yang sedang di textarea) vs query referensi
  const handleCheck = (ch: Challenge) => {
    const userOut = runQuery(query)
    if ('error' in userOut) {
      setChallengeMsg({ [ch.id]: `Query-mu error: ${userOut.error}` })
      return
    }
    const refOut = runQuery(ch.ref)
    if ('error' in refOut) return
    if (resultsMatch(userOut, refOut)) {
      if (!done[ch.id]) {
        const newDone = { ...done, [ch.id]: true }
        setDone(newDone)
        try { localStorage.setItem(doneKey, JSON.stringify(newDone)) } catch { /* abaikan */ }
        onCoins(ch.reward)
        track('sql_challenge_done', { challenge: ch.id })
      }
      setChallengeMsg({ [ch.id]: `Benar! +${ch.reward} coin.` })
    } else {
      setChallengeMsg({ [ch.id]: 'Belum cocok. Pastikan filternya sesuai soal (bulan/tahun/region yang diminta), grouping, dan kolomnya benar. Klik Jalankan Query dulu untuk melihat hasil query-mu.' })
    }
  }

  if (loadError) return (
    <div className="flex-1 flex items-center justify-center py-16">
      <p className="text-sm text-[#9A3412] bg-[#FDF2F0] border border-[#C2410C]/20 rounded-xl px-4 py-3">{loadError}</p>
    </div>
  )

  if (!ready) return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="text-center">
        <div className="flex gap-2 justify-center mb-3">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        </div>
        <p className="text-xs text-[#888780]">Menyambungkan ke database Vantara...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-xl px-4 py-3">
        <p className="text-xs text-[#085041] leading-relaxed mb-1.5">
          Akses <strong>read-only</strong> ke database penjualan internal Vantara. Semua query berjalan di komputermu, bebas bereksperimen.
        </p>
        <p className="text-[11px] text-[#085041]/85 leading-relaxed">
          Database ini <strong>SQLite</strong>. Tanggal (order_date) berformat &lsquo;YYYY-MM-DD&rsquo;. Untuk saring tahun/bulan bisa pakai{' '}
          <code className="bg-white/70 px-1 rounded">YEAR(order_date)=2026</code>,{' '}
          <code className="bg-white/70 px-1 rounded">order_date LIKE &lsquo;2026-01%&rsquo;</code>, atau{' '}
          <code className="bg-white/70 px-1 rounded">strftime(&lsquo;%Y&rsquo;,order_date)</code>. Fungsi <code className="bg-white/70 px-1 rounded">EXTRACT</code> tidak didukung SQLite.
        </p>
      </div>

      {/* Schema browser */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Tabel yang tersedia</p>
        <div className="flex flex-col gap-1.5">
          {schema.map(t => (
            <div key={t.table} className="text-xs">
              <span className="font-semibold text-[#0F6E56]">{t.table}</span>
              <span className="text-[#888780]"> ({t.columns.join(', ')})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-3">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRun() } }}
          rows={5}
          spellCheck={false}
          style={{ cursor: 'text', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
          className="w-full resize-y px-3 py-2.5 border border-[#E5E3DC] rounded-lg text-xs text-[#111111] bg-[#FAFAF7] outline-none focus:border-[#0F6E56] min-h-[90px]"
          placeholder="SELECT * FROM sales LIMIT 10"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-[#888780]">Ctrl+Enter untuk menjalankan</p>
          <button onClick={handleRun} style={{ cursor: 'pointer' }} className="btn-teal text-xs px-4 py-2">
            Jalankan Query
          </button>
        </div>
      </div>

      {/* Error / hasil */}
      {queryError && (
        <div className="bg-[#FDF2F0] border border-[#C2410C]/20 rounded-xl px-4 py-3">
          <p className="text-xs text-[#9A3412] font-mono">{queryError}</p>
        </div>
      )}
      {result && (
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-3 overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">
            Hasil: {rowCount} baris{rowCount > MAX_DISPLAY_ROWS ? ` (ditampilkan ${MAX_DISPLAY_ROWS} pertama)` : ''}
          </p>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="text-[11px] w-full">
              <thead>
                <tr className="text-left text-[#0F6E56] border-b border-[#E5E3DC]">
                  {result.columns.map(c => <th key={c} className="py-1.5 pr-4 font-semibold whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.values.map((row, i) => (
                  <tr key={i} className="border-b border-[#F1EFE8] last:border-0 text-[#444441]">
                    {row.map((v, j) => (
                      <td key={j} className="py-1 pr-4 whitespace-nowrap">
                        {v === null ? <span className="text-[#C2410C] italic">NULL</span> : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tantangan dari supervisor — dinilai otomatis, tanpa AI */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">
          Latihan dari supervisormu ({Object.values(done).filter(Boolean).length}/{CHALLENGES.length} selesai)
        </p>
        <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[11px] text-[#444441] leading-relaxed">
            <strong>Cara mengerjakan:</strong> baca soal di bawah, tulis query jawabanmu di <strong>editor di atas</strong>,
            klik <strong>Jalankan Query</strong> untuk lihat hasilnya, lalu klik <strong>Cek Jawaban</strong> di soal yang kamu
            kerjakan. Tombol Cek menilai query yang sedang ada di editor.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {CHALLENGES.map((ch, idx) => (
            <Fragment key={ch.id}>
            {(idx === 0 || CHALLENGES[idx - 1].level !== ch.level) && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E56] mt-1">{LEVEL_GROUP[ch.level]}</p>
            )}
            <div className={`border rounded-xl p-3 ${done[ch.id] ? 'border-[#0F6E56]/30 bg-[#E1F5EE]/40' : 'border-[#E5E3DC]'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-semibold text-[#111111]">
                  {done[ch.id] ? '✓ ' : `Soal ${idx + 1}. `}{ch.title}
                </p>
                <span className="text-[10px] font-semibold text-[#854F0B] bg-[#FAEEDA] px-2 py-0.5 rounded-full flex-shrink-0">
                  +{ch.reward} coin
                </span>
              </div>
              <p className="text-xs text-[#444441] leading-relaxed mb-1.5">{ch.brief}</p>
              <details className="mb-2">
                <summary className="text-[10px] text-[#0F6E56] font-medium" style={{ cursor: 'pointer' }}>Lihat petunjuk</summary>
                <p className="text-[11px] text-[#888780] mt-1 font-mono">{ch.hint}</p>
              </details>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleCheck(ch)}
                  style={{ cursor: 'pointer' }}
                  className="text-xs font-semibold text-white bg-[#0F6E56] rounded-lg px-3.5 py-1.5 hover:bg-[#085041]"
                >
                  Cek Jawaban
                </button>
                {done[ch.id] && !challengeMsg[ch.id] && (
                  <p className="text-[11px] text-[#0F6E56] font-medium">Sudah kamu selesaikan.</p>
                )}
                {challengeMsg[ch.id] && (
                  <p className={`text-[11px] ${challengeMsg[ch.id].startsWith('Benar') ? 'text-[#0F6E56] font-medium' : 'text-[#854F0B]'}`}>
                    {challengeMsg[ch.id]}
                  </p>
                )}
              </div>
            </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
