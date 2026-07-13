/**
 * Vantara Data Universe — generator data fiktif yang koheren untuk SEMUA posisi.
 * Satu seed → satu perusahaan: produk, distributor, 18 bulan penjualan, pembayaran,
 * campaign, budget. Anomali cerita DITANAM DI DATA supaya interkoneksi antar posisi
 * nyata, bukan sekadar narasi:
 *   - Penjualan Jawa Timur anjlok ±38% mulai Mei 2026 (case Data Analyst day 3)
 *   - UD Berkah Jaya menunggak pembayaran ±Rp 80 juta (case Finance day 3 / BizDev)
 *   - TikTok conversion rendah (case Marketing day 1)
 *   - Marketing/Sales/IT overspend Q4 2025 (case Finance day 1)
 *
 * Jalankan: npm run generate:universe
 * Output:  public/data/vantara.db (SQLite untuk SQL editor Data Analyst)
 *          public/data/csv/*.csv  (bahan pack Excel posisi lain)
 *          public/sql-wasm.wasm   (runtime sql.js untuk browser)
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const SEED = 20260713

// PRNG deterministik — regenerate kapan pun, cerita tidak berubah
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

// ── Master data ───────────────────────────────────
const BRANDS = [
  { code: 'LUM', name: 'Lumière', category: 'Skincare', priceMin: 45000, priceMax: 180000 },
  { code: 'RTC', name: 'Roots&Co', category: 'Haircare', priceMin: 30000, priceMax: 120000 },
  { code: 'VGL', name: 'Vanta Glow', category: 'Body Care', priceMin: 25000, priceMax: 95000 },
]
const PRODUCT_TYPES: Record<string, string[]> = {
  LUM: ['Serum Vit C', 'Serum Niacinamide', 'Moisturizer Gel', 'Moisturizer Cream', 'Sunscreen SPF50', 'Facial Wash', 'Toner Exfoliating', 'Toner Hydrating', 'Eye Cream', 'Face Mist', 'Night Cream', 'Micellar Water'],
  RTC: ['Shampoo Anti Rontok', 'Shampoo Anti Ketombe', 'Conditioner Smoothing', 'Hair Serum', 'Hair Mask', 'Hair Tonic', 'Dry Shampoo', 'Scalp Scrub', 'Hair Oil', 'Leave-in Cream', 'Hair Vitamin', 'Curl Cream'],
  VGL: ['Body Lotion Brightening', 'Body Serum', 'Body Wash', 'Body Scrub', 'Hand Cream', 'Body Mist', 'Deodorant Serum', 'Sunscreen Body', 'Body Butter', 'Foot Cream', 'Body Oil', 'Sleeping Body Mask'],
}
const REGIONS = ['Jabodetabek', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Sumatera Utara', 'Sumatera Selatan', 'Kalimantan', 'Sulawesi', 'Papua']
// Bobot volume per region (Jabodetabek terbesar)
const REGION_WEIGHT = [30, 16, 13, 15, 8, 6, 5, 5, 2]
const CHANNELS = ['Modern Trade', 'General Trade', 'E-commerce']

const DISTRIBUTORS = [
  { id: 'D01', name: 'PT Maju Bersama', region: 'Jabodetabek' },
  { id: 'D02', name: 'PT Sinar Distribusi', region: 'Jabodetabek' },
  { id: 'D03', name: 'CV Karya Niaga', region: 'Jawa Barat' },
  { id: 'D04', name: 'PT Prima Sejahtera', region: 'Jawa Barat' },
  { id: 'D05', name: 'UD Lancar Jaya', region: 'Jawa Tengah' },
  { id: 'D06', name: 'PT Mitra Dagang Tengah', region: 'Jawa Tengah' },
  { id: 'D07', name: 'UD Berkah Jaya', region: 'Jawa Timur' },      // ← biang kasus Region Timur
  { id: 'D08', name: 'PT Surya Timur Abadi', region: 'Jawa Timur' },
  { id: 'D09', name: 'CV Medan Makmur', region: 'Sumatera Utara' },
  { id: 'D10', name: 'PT Deli Distribusi', region: 'Sumatera Utara' },
  { id: 'D11', name: 'UD Sriwijaya Niaga', region: 'Sumatera Selatan' },
  { id: 'D12', name: 'PT Borneo Sukses', region: 'Kalimantan' },
  { id: 'D13', name: 'CV Kalimantan Sentosa', region: 'Kalimantan' },
  { id: 'D14', name: 'PT Celebes Mandiri', region: 'Sulawesi' },
  { id: 'D15', name: 'UD Makassar Bersama', region: 'Sulawesi' },
  { id: 'D16', name: 'PT Andalan Distribusi', region: 'Papua' },     // ← coverage strategis di case BizDev
  { id: 'D17', name: 'CV Nusantara Timur', region: 'Papua' },
  { id: 'D18', name: 'PT Ecom Fulfillment ID', region: 'Jabodetabek' },
]

// Multiplier musiman per 'YYYY-MM' (Lebaran & Desember naik)
const SEASON: Record<string, number> = {
  '2025-01': 0.95, '2025-02': 0.98, '2025-03': 1.45, '2025-04': 1.1, '2025-05': 1.0,
  '2025-06': 1.02, '2025-07': 0.97, '2025-08': 1.0, '2025-09': 1.03, '2025-10': 1.05,
  '2025-11': 1.12, '2025-12': 1.3, '2026-01': 0.96, '2026-02': 1.2, '2026-03': 1.5,
  '2026-04': 1.05, '2026-05': 1.0, '2026-06': 1.02,
}
const MONTHS = Object.keys(SEASON)
// Anomali cerita: Jatim anjlok mulai Mei 2026
const JATIM_DROP_FROM = '2026-05'
// Dikalibrasi supaya drop YoY terukur ±38% setelah kekotoran data (region null dkk)
const JATIM_DROP_FACTOR = 0.68

interface Product { sku: string; name: string; brand: string; category: string; price: number }
interface SalesRow {
  order_id: string; order_date: string; sku: string; qty: number
  unit_price: number; revenue: number; region: string | null
  channel: string; distributor_id: string
}

function buildProducts(): Product[] {
  const products: Product[] = []
  for (const b of BRANDS) {
    PRODUCT_TYPES[b.code].forEach((type, i) => {
      const price = Math.round((b.priceMin + rand() * (b.priceMax - b.priceMin)) / 500) * 500
      products.push({
        sku: `${b.code}-${String(i + 1).padStart(3, '0')}`,
        name: `${b.name} ${type}`,
        brand: b.name,
        category: b.category,
        price,
      })
    })
  }
  return products
}

function pickRegion(): string {
  const total = REGION_WEIGHT.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < REGIONS.length; i++) {
    r -= REGION_WEIGHT[i]
    if (r <= 0) return REGIONS[i]
  }
  return REGIONS[0]
}

function distributorFor(region: string, channel: string): string {
  if (channel === 'E-commerce') return 'D18'
  const candidates = DISTRIBUTORS.filter(d => d.region === region && d.id !== 'D18')
  return candidates.length ? pick(candidates).id : 'D01'
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function buildSales(products: Product[]): SalesRow[] {
  const rows: SalesRow[] = []
  let orderSeq = 1
  for (const ym of MONTHS) {
    const days = daysInMonth(ym)
    for (let day = 1; day <= days; day++) {
      const date = `${ym}-${String(day).padStart(2, '0')}`
      const baseOrders = randInt(36, 52)
      const orders = Math.round(baseOrders * (SEASON[ym] || 1))
      for (let o = 0; o < orders; o++) {
        let region: string | null = pickRegion()
        // Anomali cerita: order Jatim menyusut drastis mulai Mei 2026
        if (region === 'Jawa Timur' && ym >= JATIM_DROP_FROM && rand() > JATIM_DROP_FACTOR) continue

        const product = pick(products)
        const channel = pick(CHANNELS)
        const qty = randInt(1, 24)
        const unitPrice = product.price
        let sku = product.sku
        let revenue = qty * unitPrice

        // Kekotoran yang disengaja — bahan belajar data cleaning
        if (rand() < 0.015) region = null                       // region kosong
        if (rand() < 0.02) sku = sku.toLowerCase()              // SKU tidak konsisten
        if (rand() < 0.008) revenue = 0                          // revenue 0 padahal qty > 0

        const orderId = `ORD-${String(orderSeq).padStart(6, '0')}`
        orderSeq++
        const row: SalesRow = {
          order_id: orderId, order_date: date, sku, qty,
          unit_price: unitPrice, revenue, region, channel,
          distributor_id: distributorFor(region || 'Jabodetabek', channel),
        }
        rows.push(row)
        if (rand() < 0.01) rows.push({ ...row })                 // duplikat order utuh
      }
    }
  }
  return rows
}

interface PaymentRow {
  invoice_id: string; distributor_id: string; period: string
  invoice_amount: number; due_date: string; paid_date: string | null; paid_amount: number
}

// Tagihan bulanan per distributor dari penjualan non-ecommerce mereka.
// UD Berkah Jaya (D07) mulai April 2026 membayar sebagian dan telat → outstanding ±80jt.
function buildPayments(sales: SalesRow[]): PaymentRow[] {
  const byDistMonth = new Map<string, number>()
  for (const s of sales) {
    if (s.distributor_id === 'D18') continue
    const key = `${s.distributor_id}|${s.order_date.slice(0, 7)}`
    byDistMonth.set(key, (byDistMonth.get(key) || 0) + s.revenue)
  }
  const rows: PaymentRow[] = []
  let seq = 1
  for (const [key, amount] of Array.from(byDistMonth.entries()).sort()) {
    const [dist, ym] = key.split('|')
    const invoiceAmount = Math.round(amount * 0.6) // porsi distributor
    const due = `${ym}-25`
    let paidDate: string | null = due
    let paidAmount = invoiceAmount

    if (rand() < 0.12) { // telat wajar beberapa hari (normal di bisnis)
      const [y, m, d] = due.split('-').map(Number)
      const late = new Date(y, m - 1, d + randInt(2, 9))
      paidDate = `${late.getFullYear()}-${String(late.getMonth() + 1).padStart(2, '0')}-${String(late.getDate()).padStart(2, '0')}`
    }
    // Anomali cerita: Berkah Jaya mulai seret Maret 2026, lalu berhenti bayar total —
    // total outstanding harus mendekati Rp 80 juta (case Finance day 3)
    if (dist === 'D07' && ym >= '2026-03') {
      const paidFactor = ym === '2026-03' ? 0.8 : ym >= '2026-06' ? 0 : 0.45
      paidAmount = Math.round(invoiceAmount * paidFactor)
      paidDate = paidAmount > 0 ? `${ym}-28` : null
    }
    rows.push({
      invoice_id: `INV-${String(seq).padStart(5, '0')}`,
      distributor_id: dist, period: ym,
      invoice_amount: invoiceAmount, due_date: due,
      paid_date: paidDate, paid_amount: paidAmount,
    })
    seq++
  }
  return rows
}

interface CampaignRow {
  campaign_id: string; name: string; brand: string; channel: string
  start_date: string; end_date: string; spend: number
  impressions: number; clicks: number; conversions: number
}

function buildCampaigns(): CampaignRow[] {
  const channels = ['Meta Ads', 'TikTok Ads', 'Google Ads', 'YouTube Ads']
  const themes = ['Awareness', 'Lebaran', 'Payday Sale', '12.12', 'New Launch', 'Retargeting']
  const rows: CampaignRow[] = []
  for (let i = 1; i <= 24; i++) {
    const brand = pick(BRANDS).name
    const channel = pick(channels)
    const theme = pick(themes)
    const ym = pick(MONTHS)
    const spend = randInt(40, 900) * 1000000 / 10 // Rp 4jt - 90jt
    const impressions = spend * randInt(18, 40) / 1000
    const ctr = channel === 'Google Ads' ? 0.032 + rand() * 0.02 : 0.008 + rand() * 0.015
    const clicks = Math.round(impressions * ctr)
    // Anomali cerita: TikTok conversion rendah
    const convRate = channel === 'TikTok Ads' ? 0.002 + rand() * 0.004 : 0.012 + rand() * 0.03
    rows.push({
      campaign_id: `CMP-${String(i).padStart(3, '0')}`,
      name: `${brand} ${theme} ${ym}`,
      brand, channel,
      start_date: `${ym}-01`, end_date: `${ym}-${daysInMonth(ym)}`,
      spend: Math.round(spend),
      impressions: Math.round(impressions),
      clicks,
      conversions: Math.round(clicks * convRate),
    })
  }
  return rows
}

interface BudgetRow { dept: string; period: string; budget: number; actual: number }

function buildBudget(): BudgetRow[] {
  const depts = ['Marketing', 'Sales', 'IT Digital', 'HR', 'Finance', 'Operations']
  const base: Record<string, number> = {
    Marketing: 850, Sales: 700, 'IT Digital': 320, HR: 260, Finance: 210, Operations: 540,
  }
  const rows: BudgetRow[] = []
  for (const ym of MONTHS) {
    for (const dept of depts) {
      const budget = base[dept] * 1000000
      let factor = 0.9 + rand() * 0.18
      // Anomali cerita: overspend Q4 2025 (case Finance day 1)
      if (ym >= '2025-10' && ym <= '2025-12') {
        if (dept === 'Marketing') factor = 1.22 + rand() * 0.12
        if (dept === 'Sales') factor = 1.12 + rand() * 0.08
        if (dept === 'IT Digital') factor = 1.09 + rand() * 0.06
      }
      rows.push({ dept, period: ym, budget, actual: Math.round(budget * factor) })
    }
  }
  return rows
}

// ── CSV util (field kita terkontrol: tanpa koma/kutip di data) ──
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const lines = [cols.join(',')]
  for (const r of rows) lines.push(cols.map(c => r[c] === null || r[c] === undefined ? '' : String(r[c])).join(','))
  return lines.join('\n') + '\n'
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const dataDir = path.join(root, 'public', 'data')
  const csvDir = path.join(dataDir, 'csv')
  fs.mkdirSync(csvDir, { recursive: true })

  console.log(`Seed: ${SEED}`)
  const products = buildProducts()
  const sales = buildSales(products)
  const payments = buildPayments(sales)
  const campaigns = buildCampaigns()
  const budget = buildBudget()

  // ── SQLite untuk SQL editor (Data Analyst) ──
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE products (sku TEXT, name TEXT, brand TEXT, category TEXT, price INTEGER);
    CREATE TABLE distributors (distributor_id TEXT, name TEXT, region TEXT);
    CREATE TABLE sales (order_id TEXT, order_date TEXT, sku TEXT, qty INTEGER, unit_price INTEGER, revenue INTEGER, region TEXT, channel TEXT, distributor_id TEXT);
    CREATE TABLE payments (invoice_id TEXT, distributor_id TEXT, period TEXT, invoice_amount INTEGER, due_date TEXT, paid_date TEXT, paid_amount INTEGER);
  `)
  db.run('BEGIN')
  const pStmt = db.prepare('INSERT INTO products VALUES (?,?,?,?,?)')
  for (const p of products) pStmt.run([p.sku, p.name, p.brand, p.category, p.price])
  pStmt.free()
  const dStmt = db.prepare('INSERT INTO distributors VALUES (?,?,?)')
  for (const d of DISTRIBUTORS) dStmt.run([d.id, d.name, d.region])
  dStmt.free()
  const sStmt = db.prepare('INSERT INTO sales VALUES (?,?,?,?,?,?,?,?,?)')
  for (const s of sales) sStmt.run([s.order_id, s.order_date, s.sku, s.qty, s.unit_price, s.revenue, s.region, s.channel, s.distributor_id])
  sStmt.free()
  const payStmt = db.prepare('INSERT INTO payments VALUES (?,?,?,?,?,?,?)')
  for (const p of payments) payStmt.run([p.invoice_id, p.distributor_id, p.period, p.invoice_amount, p.due_date, p.paid_date, p.paid_amount])
  payStmt.free()
  db.run('COMMIT')

  const dbPath = path.join(dataDir, 'vantara.db')
  fs.writeFileSync(dbPath, Buffer.from(db.export()))

  // ── CSV untuk pack Excel posisi lain (sales sengaja tidak di-CSV-kan: besar, sudah ada di .db) ──
  fs.writeFileSync(path.join(csvDir, 'products.csv'), toCsv(products as unknown as Record<string, unknown>[]))
  fs.writeFileSync(path.join(csvDir, 'distributors.csv'), toCsv(DISTRIBUTORS as unknown as Record<string, unknown>[]))
  fs.writeFileSync(path.join(csvDir, 'payments.csv'), toCsv(payments as unknown as Record<string, unknown>[]))
  fs.writeFileSync(path.join(csvDir, 'campaigns.csv'), toCsv(campaigns as unknown as Record<string, unknown>[]))
  fs.writeFileSync(path.join(csvDir, 'budget.csv'), toCsv(budget as unknown as Record<string, unknown>[]))

  // ── Runtime wasm untuk sql.js di browser ──
  const wasmSrc = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  fs.copyFileSync(wasmSrc, path.join(root, 'public', 'sql-wasm.wasm'))

  // ── Sanity check anomali cerita ──
  // Drop Jatim diukur year-over-year (Mei-Jun 2025 vs Mei-Jun 2026) supaya bersih
  // dari efek musiman — cara analis sungguhan menemukannya
  const jatimBefore = sales.filter(s => s.region === 'Jawa Timur' && s.order_date >= '2025-05' && s.order_date < '2025-07').length / 2
  const jatimAfter = sales.filter(s => s.region === 'Jawa Timur' && s.order_date >= '2026-05').length / 2
  const berkahOutstanding = payments
    .filter(p => p.distributor_id === 'D07')
    .reduce((sum, p) => sum + (p.invoice_amount - p.paid_amount), 0)

  console.log(`products: ${products.length} | distributors: ${DISTRIBUTORS.length}`)
  console.log(`sales: ${sales.length} rows | payments: ${payments.length} | campaigns: ${campaigns.length} | budget: ${budget.length}`)
  console.log(`Jatim orders/bln: ${Math.round(jatimBefore)} → ${Math.round(jatimAfter)} (${Math.round((1 - jatimAfter / jatimBefore) * 100)}% drop)`)
  console.log(`UD Berkah Jaya outstanding: Rp ${berkahOutstanding.toLocaleString('id-ID')}`)
  console.log(`vantara.db: ${(fs.statSync(dbPath).size / 1024 / 1024).toFixed(1)} MB`)
}

main().catch(e => { console.error(e); process.exit(1) })
