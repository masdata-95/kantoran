# Pindah Deploy ke Cloudflare Workers — Step by Step

> Diperbarui 13 Okt 2026. Alasan pindah: paket Hobby Vercel tidak boleh dipakai komersial, dan
> Kantoran akan memasang payment gateway (Midtrans). Workers Paid (~$5/bln) vs Vercel Pro (~$20/bln).
> Konfigurasi di repo: `wrangler.jsonc`, `open-next.config.ts`, script `preview` / `deploy` / `cf:tail`.
> Prinsip: kantoran.id tetap di Vercel sampai versi Cloudflare lolos semua tes. Database (Supabase)
> TIDAK ikut pindah, jadi rollback = arahkan DNS balik, tanpa risiko data.

## Step 0 — Prasyarat

- [ ] **Akun Cloudflare yang benar.** `npx wrangler whoami` harus menunjukkan akun tempat zona
      `kantoran.id` berada (akun bisnis masdata). Pernah terdeteksi login ke akun lain
      (talent.development18@…) — kalau begitu: `npx wrangler logout` lalu `npx wrangler login`.
- [ ] **Paket Workers Paid** (dashboard → Workers & Pages → Plans). Paket Free membatasi CPU 10 ms
      per request, terlalu kecil untuk render halaman Next.js. Menunggu respons AI tidak dihitung CPU.
- [ ] Pilih cara build:
  - **(a) Workers Builds — disarankan.** Dashboard → Workers & Pages → kantoran → Settings → Builds →
    hubungkan repo `masdata-95/kantoran`, branch `main`. Build command: `npx opennextjs-cloudflare build`,
    deploy command: `npx opennextjs-cloudflare deploy`. Variabel build `NEXT_PUBLIC_SUPABASE_URL` dan
    `NEXT_PUBLIC_SUPABASE_ANON_KEY` diisi di pengaturan build (di-inline saat `next build`).
    Build jalan di Linux, jadi masalah symlink Windows tidak relevan.
  - **(b) Build dari laptop Windows.** Aktifkan Settings → System → For developers → Developer Mode
    (OpenNext butuh symlink; tanpa ini gagal `EPERM`). Lalu `npm run deploy`.

## Step 1 — Secrets runtime

```bash
npx wrangler secret put GEMINI_API_KEY_1          # key PAID yang aktif di Vercel production
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_JWT_SECRET       # Supabase → Project Settings → API → JWT Secret
npx wrangler secret put ADMIN_EMAILS              # email founder, dipisah koma
npx wrangler secret put OPENROUTER_API_KEY        # cadangan terakhir (opsional tapi disarankan)
```

- Default model sudah `gemini-3.5-flash` di `lib/ai.ts`; `GEMINI_MODEL` hanya untuk override.
- Opsional: `KANTORAN_PASS_SCORE` (default 70), `GEMINI_API_KEY_2..5`, `GROQ_API_KEY_1..5` (key Groq lama mati).
- `.env.local` hasil `vercel env pull` TIDAK berisi `SUPABASE_JWT_SECRET`, `ADMIN_EMAILS`,
  `OPENROUTER_API_KEY` — ambil dari dashboard Vercel/Supabase.

## Step 2 — Deploy pertama ke workers.dev (kantoran.id belum disentuh)

Via Workers Builds: push ke `main` atau "Retry build" di dashboard. Via laptop: `npm run deploy`.
Hasilnya di `https://kantoran.<subdomain-akun>.workers.dev`.

Tambahkan URL itu ke Supabase → Authentication → URL Configuration → Redirect URLs (sementara), lalu tes:

- [ ] Landing `/` tampil (rewrite ke `landing.html`), `/landing.html` redirect ke `/`
- [ ] Login Google → profil → lowongan (foto kartu tampil)
- [ ] Lamar → interview Sinta (chat AI jalan) → offering letter → tanda tangan
- [ ] Slack tim → standup → task → unduh file → upload `.xlsx` → review supervisor
- [ ] Refresh di tengah interview: percakapan kembali
- [ ] `/cv`: upload PDF dan DOCX → skor keluar (unpdf/mammoth butuh `nodejs_compat`, sudah diset)
- [ ] `/tentang`, `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`
- [ ] Data Analyst: room Database (sql.js WASM) terbuka

Pantau log selama tes: `npm run cf:tail` (cari `Gemini key failed` / `ALL PROVIDERS FAILED`).

## Step 3 — Cutover domain (bagian paling rawan)

1. Cloudflare → Workers & Pages → kantoran → **Domains & Routes** → Add **Custom Domain** `kantoran.id`,
   lalu `www.kantoran.id`. Cloudflare mengganti record A ke Vercel (76.76.21.21) secara otomatis;
   kalau menolak karena record sudah ada, hapus record A/CNAME lama dulu.
   **JANGAN sentuh record MX / TXT** — email `halo@kantoran.id` (Email Routing) bergantung padanya.
2. `www` → apex: redirect `www.kantoran.id` di `next.config.ts` ikut berjalan di Workers. Redirect
   `kantoran.vercel.app` hanya berlaku selama Vercel hidup.
3. Supabase → Auth → URL Configuration: **Site URL** `https://kantoran.id`; Redirect URLs berisi
   `https://kantoran.id/**`, `https://www.kantoran.id/**` (biarkan URL Vercel sampai Step 5).
4. Google Cloud OAuth client tidak perlu diubah (Google selalu kembali ke `…supabase.co/auth/v1/callback`).
5. Tes login dari kantoran.id di jendela incognito, ulangi checklist Step 2 singkat.
6. Search Console: cek URL Inspection `https://kantoran.id/` → Test live URL masih "available".

## Step 4 — Payment gateway (Midtrans) setelah hosting stabil

- Endpoint notifikasi (webhook) Midtrans → route baru `app/api/payment/notify/route.ts`: verifikasi
  `signature_key` (SHA512 dari order_id + status_code + gross_amount + server key), lalu tulis ke tabel
  `entitlements` (sudah ada, migration 006) yang dibaca `lib/entitlements.ts → hasSeasonAccess()`.
- Secret baru: `npx wrangler secret put MIDTRANS_SERVER_KEY`; client key boleh `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`.
- Mulai di Sandbox Midtrans; set Payment Notification URL ke `https://kantoran.id/api/payment/notify`.

## Step 5 — Pensiunkan Vercel (setelah 1-2 minggu stabil)

1. Pastikan tidak ada traffic berarti ke Vercel.
2. Hapus Redirect URL Vercel dari Supabase Auth.
3. Pause/hapus project di Vercel; hapus `export const maxDuration` di route API (hint khusus Vercel).
4. Opsional: naikkan batas upload CV (`app/api/cv-extract/route.ts` + pre-check di `app/cv/page.tsx`),
   batas body 4.5 MB milik Vercel tidak berlaku lagi.
5. Update CLAUDE.md (bagian Deploy) dan memory: deploy resmi = Cloudflare.

## Rollback darurat

Gejala yang tidak bisa didiagnosis cepat (auth loop, 500 massal, chat AI gagal massal):
1. Hapus Custom Domain di Worker, kembalikan record `A @ → 76.76.21.21` (DNS only) ke Vercel.
2. Diagnosis dengan `npm run cf:tail` tanpa tekanan user.
Database tidak pernah ikut pindah — risiko kehilangan data dari langkah deploy ini nol.
