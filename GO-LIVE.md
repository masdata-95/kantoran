# GO-LIVE Checklist — Kantoran

> Dibuat 21 Juli 2026. Payment gateway: **Midtrans** (Snap). Model: hari-1 gratis → Season Pass.
> Legenda: **[saya]** = bisa dikerjakan lewat kode (Claude), **[kamu]** = aksi dunia nyata founder.
> Prinsip: jangan bangun checkout sebelum ada yang dijual, jangan tarik traffic sebelum pipa siap.

## ⚠️ Jalur kritis (urutan yang menentukan, jangan dibalik)

1. **Konten Arc 1** (barang yang dijual) — tanpa ini, menjual "season" = janji kosong / risiko refund.
2. **Legalitas** (PT Perorangan → PSE → refund policy) — syarat MENERIMA uang secara sah + aktivasi Midtrans penuh.
3. **Integrasi Midtrans + wiring entitlement** (menagih & membuka konten) — teknis, paling gampang, fondasinya SUDAH ada (migration 006: tabel entitlements + sim_day + bucket task-files).
4. **Domain + cutover** (kepercayaan saat orang bayar).
5. **QA menyeluruh + soft launch berbayar** ke lingkaran kecil sebelum @masdata.

---

## A. Konten — yang sebenarnya dijual (BLOKER #1)

- [ ] **[saya+kamu]** Tulis Arc 1 Data Analyst hari 2-7 (5 task) — pola sudah ada di `content/tasks/da-day2-dashboard.md`. DA dulu (converting tertinggi). Tiap task: brief suara supervisor + file dari generator + rubric 3 level + reaksi NPC + cross-ref divisi lain.
- [ ] **[kamu]** Validasi: rilis Arc 1 DA ke sebagian tester, ukur berapa % lanjut hari 2→3 di `/admin`. Baru tulis posisi kedua.
- [ ] **[saya]** Isi `youtube_video_id` lesson Academy (opsional, "Video menyusul" tetap jalan tanpa ini).
- Keputusan produk **[kamu]**: satu Season = berapa hari konten? Realistis untuk launch: Arc 1 (hari 2-7 DA) + janji arc berikutnya, dengan harga "founding member" lebih murah.

## B. Pembayaran Midtrans (BLOKER #3 — fondasi sudah ada)

- [ ] **[kamu]** Ambil Server Key + Client Key Midtrans (Sandbox dulu) → masukkan ke env: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`.
- [ ] **[saya]** `POST /api/payments/create` — bikin transaksi Snap, balas token untuk popup checkout.
- [ ] **[saya]** `POST /api/payments/webhook` — verifikasi signature (SHA512 order_id+status_code+gross_amount+ServerKey), lalu **INSERT ke tabel `entitlements`** yang sudah ada → user dapat akses season. Idempoten (webhook bisa dobel).
- [ ] **[saya]** Tabel `orders` (migration 007) untuk rekonsiliasi: order_id, user_id, produk, amount, status, raw payload.
- [ ] **[saya]** Wire entitlement → gameplay: `sim_day` naik setelah hari selesai; task hari ≥2 buka HANYA kalau `hasSeasonAccess()` true (API `/api/tasks` + `/api/task-file` sudah cek ini).
- [ ] **[saya]** Paywall UI di momen "hari-1 selesai": ganti/lengkapi WishlistForm dengan halaman harga + tombol beli (Snap). Waitlist tetap ada untuk yang belum siap bayar.
- [ ] **[kamu]** Definisikan harga & SKU: Season Pass sekali bayar (Rp 149-249rb) atau langganan bulanan. Rekomendasi pasar ID: sekali bayar.
- [ ] **[kamu]** Tes end-to-end di Midtrans **Sandbox** (kartu/VA/QRIS simulator) sebelum production.

## C. Legalitas & compliance (BLOKER #2 — proses dunia nyata, mulai SEKARANG)

- [ ] **[kamu]** PT Perorangan (online via AHU, butuh NIB dari OSS) — syarat aktivasi Midtrans production + legitimasi.
- [ ] **[kamu]** NPWP badan.
- [ ] **[kamu]** Daftar **PSE Kominfo** (wajib platform digital di Indonesia).
- [ ] **[saya]** Halaman `/refund` (kebijakan pengembalian) — WAJIB ada sebelum jualan; draft saya, kamu review.
- [ ] **[saya]** Update `/terms` & `/privacy`: tambah klausa pembayaran, langganan, refund, data transaksi.
- [ ] **[kamu]** Rekening bisnis untuk settlement Midtrans.

## D. Domain & infrastruktur (BLOKER #4)

- [ ] **[kamu]** Beli **kantoran.id** (masih tersedia per cek terakhir — jangan tunda).
- [ ] **[kamu+saya]** Cutover domain: DNS → Vercel, lalu update **Google OAuth** (origins + redirect) & **Supabase** (Site URL + Redirect URLs). Footgun paling sering, kerjakan sekali & teliti.
- [ ] **[saya]** Ganti semua URL hardcoded `kantoran.vercel.app` → `kantoran.id` (layout OG, sitemap, share text, HTTP-Referer OpenRouter).
- [ ] **[kamu]** (Opsional polish) Supabase Custom Domain `auth.kantoran.id` → hilangkan "...supabase.co" di layar login Google.
- [ ] **[kamu]** Supabase: pertimbangkan paus paid tier (backup harian, tidak auto-pause) begitu ada user berbayar.
- **Cloudflare: JANGAN migrasi tepat saat launch.** Vercel stabil & jalan. Migrasi menambah risiko di momen paling salah. Tunda sampai pasca-launch (runbook siap di DEPLOY-CLOUDFLARE.md).

## E. Email transaksional & retensi

- [ ] **[kamu]** Akun Resend (gratis 3rb/bln) → `RESEND_API_KEY` di env.
- [ ] **[saya]** Email: (1) struk/akses setelah bayar, (2) welcome signup, (3) verifikasi waitlist.
- [ ] **[kamu]** Inbox `halo@kantoran.id` (Cloudflare Email Routing gratis) → ganti placeholder di halaman legal.

## F. Growth readiness (baru digas SETELAH A-E hijau)

- [ ] **[kamu]** @kantoranid_: isi 4-6 post dulu (bahan di memory ide-konten-marketing) sebelum @masdata mengarahkan traffic.
- [ ] **[saya]** Share card personal + OG image dinamis (nama, posisi, gaji nego, grade) — lever viral utama, ganti copy-teks generik.
- [ ] **[kamu]** Pre-sale founding member ke waitlist (validasi bayar sebelum broadcast besar).

## G. QA sebelum menerima uang (WAJIB)

- [ ] **[kamu]** Jalankan **TESTING.md penuh** — belum pernah dilakukan; makin krusial karena banyak menumpuk.
- [ ] **[kamu]** Tes alur bayar end-to-end (sandbox → production dengan 1 transaksi asli kecil).
- [ ] **[kamu]** Tes mobile 390px (traffic IG/TikTok = HP).
- [ ] **[kamu]** Cek `/admin`: funnel apply→interview sudah membaik (fix terbaru), error client bersih.

---

## Ringkasan: apa yang saya bisa mulai kapan pun

Begitu kamu kasih **Midtrans Sandbox key** + keputusan **harga**, saya bisa langsung bangun jalur pembayaran penuh (create + webhook + orders + entitlement wiring + paywall UI) — fondasinya sudah ada dari migration 006. Paralel, saya bisa **draft Arc 1 DA hari-2** (satu contoh sudah jadi) untuk kamu review. Sisanya (PT, PSE, domain, Resend) aksi kamu yang jalannya di dunia nyata, jadi mulai itu SEKARANG karena makan waktu berhari-hari.
