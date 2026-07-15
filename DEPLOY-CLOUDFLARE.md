# Pindah Deploy ke Cloudflare Workers — Step by Step

> Diperbarui 12 Juli 2026. Build OpenNext sudah terverifikasi jalan (`.open-next/worker.js` ter-generate).
> Konfigurasi sudah ada di repo: `wrangler.jsonc`, `open-next.config.ts`, script `preview` / `deploy` / `cf:tail` di package.json.
> Kerjakan berurutan dari atas. Estimasi total: 1-2 jam + masa pemantauan.

## Step 0 — Checklist prasyarat (5 menit)

- [x] Migration `002_rate_limits.sql`, `003_academy.sql`, `004_multi_role.sql` sudah dijalankan di Supabase Studio (004 selesai 12 Juli 2026).
- [ ] Konten Academy sudah di-seed: `npm run seed:lessons` (butuh `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`).
- [ ] `.env.local` berisi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` — dua nilai ini di-inline saat build, bukan secret runtime.
- [ ] Punya akses: dashboard Cloudflare, Supabase Studio, Google Cloud Console (OAuth client).

## Step 1 — Login Wrangler + set secrets (10 menit)

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY_1          # key PAID yang sudah aktif di Vercel
npx wrangler secret put OPENROUTER_API_KEY        # last resort fallback
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_JWT_SECRET       # disarankan: verifikasi JWT lokal = auth tercepat
npx wrangler secret put ADMIN_EMAILS              # email founder untuk dashboard /admin
```

Catatan:
- Key Groq lama sudah mati — JANGAN dipindahkan. Kalau nanti bikin key Groq baru: `npx wrangler secret put GROQ_API_KEY_1`.
- Nama model sekarang bisa dioverride tanpa deploy kode: `npx wrangler secret put GEMINI_MODEL` (default `gemini-2.5-flash`; siapkan ini untuk migrasi ke `gemini-3.5-flash` sebelum 16 Okt 2026).

## Step 2 — Tes lokal di runtime Workers asli (15 menit)

```bash
copy .dev.vars.example .dev.vars    # isi nilainya (sama dengan secrets di atas)
npm run preview
```

Tambahkan URL preview yang muncul ke Supabase → Auth → URL Configuration → Redirect URLs (sementara), lalu tes checklist ini:

- [ ] Login Google → masuk job listing
- [ ] Apply posisi → email undangan masuk → interview dengan Sinta (chat AI jalan)
- [ ] Guided tour muncul untuk akun baru
- [ ] Academy terbuka di step 4, lesson bisa diselesaikan, misi direview
- [ ] Upload xlsx di Workspace → review supervisor jalan
- [ ] /cv: upload PDF → skor keluar
- [ ] Keluar-masuk posisi: progress resume di titik terakhir

## Step 3 — Deploy pertama ke workers.dev (10 menit)

```bash
npm run deploy
```

Hasil di `https://kantoran.<account>.workers.dev`. Tambahkan URL ini juga ke Supabase Redirect URLs, lalu ulangi checklist Step 2 di URL ini. Pantau log real-time selama tes:

```bash
npm run cf:tail
```

Kegagalan provider AI (`Gemini key failed`, `ALL PROVIDERS FAILED`) kelihatan di sini.

## Step 4 — Cutover domain + OAuth (bagian paling rawan, 20 menit)

Urutannya penting:

1. Cloudflare dashboard → Workers & Pages → kantoran → **Domains & Routes** → Add custom domain (mis. `kantoran.id` / subdomain yang dipakai).
2. Supabase → Auth → URL Configuration:
   - **Site URL** → ganti ke domain baru.
   - **Redirect URLs** → tambah domain baru (JANGAN hapus URL Vercel dulu).
3. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:
   - Authorized JavaScript origins → tambah domain baru.
   - Authorized redirect URIs → tambah `https://<project>.supabase.co/auth/v1/callback` (biasanya sudah ada) + domain baru bila dipakai langsung.
4. Tes login Google DARI domain baru dalam incognito.
5. **Sekalian bereskan branding layar login Google** (lihat CATATAN-PENGEMBANGAN.md item 2b):
   OAuth consent screen diberi nama+logo Kantoran, dan pertimbangkan Supabase Custom Domain
   (`auth.<domain>`) supaya layar Google tidak lagi menulis `...supabase.co`.
6. **Biarkan deployment Vercel hidup 1-2 minggu** sebagai rollback instan. Rollback = arahkan DNS balik, tidak ada migrasi data (database tetap di Supabase).

## Step 5 — Rapikan jejak URL lama (10 menit)

- [x] Link "Kembali ke Kantoran" (WishlistForm) dan tombol cliffhanger (SimulatorApp) sudah diganti ke URL relatif (12 Juli 2026).
- [ ] Teks share di `WishlistForm.tsx` masih menulis `kantoran.vercel.app` — ganti ke domain baru saat cutover (teks ini dibagikan keluar, harus absolut).
- [ ] `lib/ai.ts` header `HTTP-Referer` OpenRouter masih `kantoran.vercel.app` — ganti ke domain baru (tidak fatal, hanya atribusi).
- [ ] Update `CLAUDE.md` bagian Live URL setelah cutover.

## Step 6 — Setelah stabil di Cloudflare

- **Analytics gratis bawaan:** Cloudflare Web Analytics (dashboard → Analytics) aktifkan untuk domain — belum menggantikan event funnel (tetap butuh PostHog/sejenis), tapi minimal traffic terlihat.
- **Naikkan limit upload CV:** `app/api/cv-extract/route.ts` (4MB → 10MB) + pre-check di `app/cv/page.tsx`. Batas body 4.5MB milik Vercel sudah tidak berlaku.
- **`export const maxDuration`** di route API jadi dead code (hint khusus Vercel) — hapus saat Vercel dipensiunkan. Timeout di Workers diatur runtime, fetch AI sudah dibatasi `deadlineMs` 25s di `lib/ai.ts`.
- **Batas Workers Free:** 100rb request/hari, CPU 10ms/request. Panggilan AI = fetch wait (tidak makan CPU) — aman. Kalau traffic naik: paket $5/bln menghapus batas harian.
- **Monitoring rutin:** `npm run cf:tail` saat ada keluhan; observability sudah `enabled: true` di `wrangler.jsonc` (dashboard → Workers → Logs).

## Step 7 — Pensiunkan Vercel (setelah 1-2 minggu stabil)

1. Pastikan tidak ada traffic berarti ke `kantoran.vercel.app` (cek analytics Vercel).
2. Hapus Redirect URL Vercel dari Supabase Auth.
3. Pause/hapus project di Vercel.
4. Update memory/dokumentasi: deploy resmi = Cloudflare.

## Rollback darurat

Gejala apa pun yang tidak bisa didiagnosis cepat (auth loop, 500 massal):
1. Arahkan DNS/custom domain kembali ke Vercel (atau umumkan URL vercel.app).
2. Site URL Supabase balikkan ke URL Vercel.
3. Diagnosis dengan `npm run cf:tail` tanpa tekanan user.
Database tidak pernah ikut pindah — risiko kehilangan data dari langkah deploy ini nol.
