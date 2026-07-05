# Runbook Migrasi ke Cloudflare Workers (Free)

Build OpenNext sudah diverifikasi jalan (`.open-next/worker.js` ter-generate).
Langkah di bawah butuh login akun Cloudflare — jalankan berurutan.

## 0. Prasyarat sekali jalan (Supabase)
Di Supabase Studio → SQL Editor, jalankan berurutan:
1. `supabase-migrations/002_rate_limits.sql`
2. `supabase-migrations/003_academy.sql`

Lalu seed konten Academy dari lokal:
```
npm run seed:lessons
```
(butuh `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`)

## 1. Login & set secrets
```
npx wrangler login
npx wrangler secret put GEMINI_API_KEY_1
npx wrangler secret put GROQ_API_KEY_1        # cukup 1, Groq sekarang fallback
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_JWT_SECRET   # opsional tapi disarankan (auth lebih cepat)
```
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` tidak perlu jadi secret —
di-inline saat build dari `.env.local`.

## 2. Tes lokal di workerd (runtime asli Workers)
```
copy .dev.vars.example .dev.vars   # lalu isi nilainya
npm run preview
```
Cek di URL localhost yang muncul: login Google*, chat interview, Academy,
upload xlsx di Workspace, upload PDF di /cv, scan CV.

*Untuk login lokal: tambahkan URL preview ke Supabase → Auth → URL Configuration → Redirect URLs (sementara).

## 3. Deploy
```
npm run deploy
```
Hasilnya di `https://kantoran.<account>.workers.dev`. Tes ulang alur penting di URL ini.

## 4. Cutover domain + OAuth (footgun paling sering!)
1. Cloudflare dashboard → Workers → kantoran → Domains & Routes → tambahkan custom domain.
2. Supabase → Auth → URL Configuration: ganti Site URL + tambah Redirect URL domain baru.
3. Google Cloud Console → OAuth client: tambah Authorized origins + redirect URI domain baru.
4. JANGAN hapus deployment Vercel dulu — biarkan 1-2 minggu sebagai rollback instan.

## 5. Setelah stabil di Cloudflare
- Naikkan limit upload CV: `app/api/cv-extract/route.ts` (4MB → 10MB) dan pre-check di `app/cv/page.tsx` (batas 4.5MB Vercel sudah tidak berlaku).
- `export const maxDuration` di route API jadi dead code (hint Vercel) — boleh dihapus saat Vercel dipensiunkan.
- Monitoring: `npm run cf:tail` untuk log real-time (kegagalan provider AI kelihatan di sini).
- Batas Workers Free: 100rb request/hari, CPU 10ms/request (panggilan AI = fetch wait, tidak makan CPU — aman). Kalau traffic naik, upgrade $5/bln menghapus batas harian.
