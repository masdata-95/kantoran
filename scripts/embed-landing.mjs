// Menyalin public/landing.html menjadi modul TS yang di-import app/route.ts (halaman "/").
// Kenapa: adapter Cloudflare (OpenNext) tidak mendukung rewrite "/" → file di public/,
// jadi landing disajikan oleh route handler. Dijalankan otomatis lewat "prebuild" & "predev";
// sumber kebenaran tetap public/landing.html — JANGAN edit file hasil generate.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const html = readFileSync(path.join(root, 'public', 'landing.html'), 'utf-8')
const out = path.join(root, 'app', 'landing-html.generated.ts')
const body =
  '// FILE HASIL GENERATE oleh scripts/embed-landing.mjs dari public/landing.html — jangan diedit.\n' +
  `export const LANDING_HTML = ${JSON.stringify(html)}\n`
writeFileSync(out, body)
// Salinan sebagai public/index.html: di Cloudflare Workers, "/" langsung dilayani dari static
// assets tanpa menjalankan Worker (CPU ~0, lolos batas Workers Free 10 ms). Di Vercel/Next,
// "/" tetap ditangani app/route.ts (file public/index.html hanya terlihat di /index.html).
writeFileSync(path.join(root, 'public', 'index.html'), html)
console.log(`landing embedded: ${html.length} chars → app/landing-html.generated.ts + public/index.html`)
