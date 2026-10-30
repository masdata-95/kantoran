# Rencana Pindah Kantoran: Supabase → Cloudflare D1 + R2

> Ditulis 30 Oktober 2026. Keputusan Mas: Kantoran ikut Portal Mas Data di Cloudflare (Workers + D1 +
> R2), supaya satu dasbor untuk monitoring dan satu tagihan.
> Skema baru: `migrations/0001_awal.sql` (sudah diuji di SQLite lokal).
> **Status 30 Okt 2026 (malam): kode sudah dipindah di salinan ini (`kantoran-d1/`); BELUM ada yang dipasang ke Cloudflare maupun Supabase.**
> Kantoran asli (`kantoran-app/`) tidak diubah dan tetap live.
>
> | | |
> |---|---|
> | Kode | Semua 15 route API, auth Google, 13 komponen klien, 2 skrip seed, pemutar video HLS |
> | `tsc` | lolos |
> | `eslint` | 0 error (28 peringatan lama yang sama) |
> | `next build` | lolos |
> | Tes | 64 lolos (33 lama + 31 baru: keamanan sesi, PKCE, link video, konversi data) |
> | Uji API di D1 lokal | 46 dari 46 lolos (profil, progres, penolakan mundur atomik, Academy, CSRF, admin, reset, logout) |
> | Link video | Dibuat Kantoran, diterima Worker video yang live: 3 kualitas + potongan MPEG-TS valid |
> | Belum teruji | Login Google sungguhan (butuh client Google), build OpenNext (butuh Linux/Workers Builds atau Developer Mode Windows), `workerd` preview |
>
> Isi Supabase saat ini (dihitung dengan `--hitung`, tanpa mengunduh data): 35 profil, 36 run simulasi,
> 5 waitlist, 13 modul + 21 lesson Academy, 65 progres lesson, **1 entitlement**, 296 event.
> Kecil, jadi pemindahan data hanya hitungan detik.
>
> Yang masih menunggu Mas (urut): (1) buat D1 `kantoran` + R2 `kantoran-task-files`; (2) tambah redirect URI
> `/api/auth/callback` di Google OAuth client dan isi `GOOGLE_CLIENT_ID/SECRET`; (3) secret `KUNCI_VIDEO`;
> (4) staging `kantoran-staging.workers.dev` lewat Workers Builds; (5) jeda singkat, ekspor data, cutover.

## 1. Apa yang berubah

| Bagian | Sekarang (Supabase) | Sesudah (Cloudflare) |
|---|---|---|
| Database | Postgres, 11 tabel, RPC `bump_usage` | D1 `kantoran` (APAC), 13 tabel. RPC diganti satu `UPSERT ... RETURNING` |
| Login | Supabase Auth + Google OAuth, JWT di header `Authorization` | Google OAuth langsung di Worker, sesi di cookie `HttpOnly` + tabel `sessions` |
| File task premium | Bucket privat `task-files` | R2 `kantoran-task-files` (binding `TASK_FILES`), tetap lewat `/api/task-file` |
| Video Academy | `youtube_video_id` | `video_code` → Worker video Mas Data (HLS di R2, token bersama). YouTube tetap bisa |
| Akses data | `@supabase/supabase-js` di 15 berkas | `lib/db.ts` (D1 binding via `getCloudflareContext()` dari OpenNext) |

**Yang tidak berubah:** Next.js + OpenNext, AI (`lib/ai.ts`), alur simulator, isi konten, Midtrans.

## 2. Biaya

| | Sekarang | Sesudah |
|---|---|---|
| Hosting | Workers Paid $5 (atau Vercel) | Workers Paid $5, **dipakai bersama portal** |
| Database + Auth + Storage | Supabase Free (auto-pause 7 hari tanpa aktivitas, tanpa backup harian). Pro $25/bln begitu ada user berbayar | Termasuk $5: D1 25 miliar baca + 50 juta tulis per bulan, 5 GB; R2 10 GB gratis |
| **Total saat berbayar** | **± $30/bln** | **± $5/bln** (bersama portal) |

D1 punya **Time Travel**: database bisa dipulihkan ke menit mana pun dalam 30 hari terakhir, tanpa
biaya tambahan. Ini pengganti backup harian Supabase Pro.

## 3. Login tanpa Supabase Auth

Alur **Authorization Code + PKCE** ditulis sendiri (sekitar 150 baris, memakai `jose` yang sudah
terpasang). Tidak perlu pustaka auth baru.

1. `GET /api/auth/google` membuat `state` dan `code_verifier`, menyimpannya di cookie pendek, lalu
   redirect ke Google.
2. `GET /api/auth/callback` menukar `code` dengan token, lalu memverifikasi `id_token` dengan JWKS
   Google. Dari situ didapat `sub`, `email`, `name`, dan `picture`.
3. User dicari berdasarkan `google_sub`. Kalau belum ada, dicari berdasarkan `email`: inilah
   **jembatan untuk user lama**, karena id mereka sudah dipindah dari Supabase. Kalau tetap tidak
   ada, user baru dibuat dengan `crypto.randomUUID()`.
4. Sesi dibuat: 32 byte acak di cookie `kt_sesi` (`HttpOnly; Secure; SameSite=Lax`, 30 hari),
   yang disimpan di D1 hanya SHA-256-nya.
5. `lib/serverAuth.ts → getAuthUser(req)` membaca cookie, bukan header lagi. Bentuk kembaliannya
   (`{ id, email }`) **sama**, jadi isi semua route API tidak perlu diubah.
6. Di sisi klien, `authFetch` cukup memanggil `fetch` dengan `credentials: 'same-origin'`.
   Pengganti `supabase.auth.getSession()` adalah `GET /api/auth/me`.
   `signInWithOAuth` diganti tautan ke `/api/auth/google`.
   `signOut` diganti `POST /api/auth/logout`.

Google Cloud Console: tambahkan redirect URI `https://kantoran.id/api/auth/callback` ke OAuth
client yang sama. Secret baru: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
Yang tidak dipakai lagi: `SUPABASE_*` dan `NEXT_PUBLIC_SUPABASE_*`.

Bonus: layar login tidak lagi menampilkan "...supabase.co" (GO-LIVE D, opsional polish, otomatis beres).

## 4. Berkas yang diubah

| Berkas | Perubahan |
|---|---|
| `lib/db.ts` (baru) | `db()` → `D1Database`; helper `one`, `all`, `run`, `json()` untuk kolom JSON |
| `lib/serverAuth.ts` | Baca cookie sesi dari D1. `getServiceClient` dihapus |
| `lib/supabase.ts` | Diganti `lib/authClient.ts`: `authFetch`, `getMe`, `login`, `logout` |
| `app/api/auth/*` (baru) | `google`, `callback`, `me`, `logout` |
| `lib/rateLimit.ts` | `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count` |
| `lib/entitlements.ts` | Satu SELECT |
| `app/api/progress`, `profile`, `reset`, `stats`, `waitlist`, `track`, `review`, `tasks`, `lessons/*`, `admin/stats` | Query builder → SQL. Kolom JSON di-`stringify`/`parse` |
| `app/api/task-file` | `env.TASK_FILES.get(file_name)` |
| `app/simulator/page.tsx`, `app/cv/page.tsx`, `components/LoginPage.tsx`, `JobListing.tsx`, `SimulatorApp.tsx` | Pemanggilan `supabase.auth.*` diganti `authClient` |
| `scripts/seed-lessons.ts`, `seed-tasks.ts` | Menulis berkas SQL lalu `wrangler d1 execute`; file diunggah dengan `wrangler r2 object put` |
| `components/academy/YouTubeEmbed.tsx` | Ditambah `VideoPlayer` (hls.js) untuk `video_code` |
| `wrangler.jsonc` | Binding `DB` (D1 `kantoran`), `TASK_FILES` (R2), var `VIDEO_BASE` |

## 5. Memindahkan data user lama

Skrip `scripts/pindah-dari-supabase.ts` dijalankan sekali dari laptop, memakai service role key
yang ada di `.env.local`:

1. **Ekspor.** `auth.admin.listUsers()` menghasilkan `users` (id, email, nama, avatar). Lalu
   `select *` dari setiap tabel, per halaman 1.000 baris.
2. **Ubah.** JSONB dan array ditulis sebagai teks JSON, boolean menjadi 0/1, dan waktu ditulis
   sebagai ISO UTC. **UUID tidak diubah.**
3. **Tulis** ke `migrasi-data/*.sql` dengan pecahan kecil, karena satu pernyataan D1 maksimal
   100 KB. Baris `user_progress` yang `chat_history`-nya besar dimasukkan lewat beberapa `UPDATE`
   bertahap.
4. **Muat** dengan `wrangler d1 execute kantoran --remote --file=...`.
5. **Cocokkan.** Jumlah baris per tabel harus sama, dan 5 user acak dibandingkan isinya.
6. **File task.** Semua objek bucket `task-files` diunduh, lalu diunggah ke R2.

`google_sub` sengaja dibiarkan kosong. Nilainya terisi otomatis saat user login pertama kali
setelah pindah (dicocokkan lewat email di langkah 3 bagian login).

## 6. Urutan pengerjaan

1. **Persiapan:**
   - pasang Node 22 di laptop (sekarang belum ada);
   - `npx wrangler login` ke akun masdata;
   - `wrangler d1 create kantoran --location apac`;
   - `wrangler r2 bucket create kantoran-task-files`.
2. **Kode di branch `pindah-d1`:** bagian 3 dan 4. `npm run lint`, `test`, dan `build` harus lolos.
3. **Uji di `kantoran-staging.workers.dev`** dengan D1 staging berisi salinan data. Jalankan
   checklist Step 2 di `DEPLOY-CLOUDFLARE.md` plus:
   - user lama login dan progresnya utuh;
   - user baru bisa daftar;
   - logout dan login di 2 perangkat;
   - rate limit tercapai di batasnya.
4. **Mode baca saja di Supabase.** Umumkan jeda sekitar 15 menit di malam sepi, lalu tolak tulis
   di API lama (`503`).
5. **Ekspor akhir, muat ke D1 produksi, lalu cocokkan** (bagian 5).
6. **Deploy ke `kantoran.id`, lalu tes login dari incognito.** Pantau `npm run cf:tail` selama
   satu jam pertama.
7. **Seminggu kemudian:** Supabase di-pause (jangan langsung dihapus, simpan ekspornya), lalu
   paket `@supabase/*` dibuang dari `package.json`.

**Rollback** (sebelum langkah 7): deploy ulang versi lama. Supabase masih utuh, dan data yang
masuk selama jeda dipindah balik dengan skrip yang sama ke arah sebaliknya.

## 7. Risiko dan jawabannya

| Risiko | Jawaban |
|---|---|
| `chat_history` besar | Sudah dibatasi 900 KB di `/api/progress`. Batas baris D1 2 MB |
| Tulis bersamaan | D1 satu penulis per database. Beban Kantoran (simpan progres per beberapa detik per user aktif) jauh di bawah batasnya. Kalau suatu hari perlu, `chat_history` bisa dipindah ke R2 |
| User lama gagal login | Dicocokkan lewat email (`COLLATE NOCASE`). Diuji di staging dengan akun asli Mas |
| `/admin` memakai agregasi Postgres | Ditulis ulang dengan SQLite (`COUNT`, `GROUP BY`, `json_extract`). Angkanya dibandingkan sebelum dan sesudah |
| Kehilangan data | Ekspor disimpan, Supabase di-pause bukan dihapus, dan D1 Time Travel aktif 30 hari |

## 8. Hubungan dengan Portal Mas Data

- **Video Academy:** `lessons.video_code` merujuk `video.kode` di portal (mis. `excel-t11-2`).
  Kantoran membuat link dengan `buatLinkVideo()` (salinan `portal-masdata/video/src/tanda.ts`) dan
  secret `KUNCI_VIDEO` yang sama.
- **Pembayaran:** satu akun Midtrans atas nama CV. Order id diberi awalan `KT-` (Kantoran) dan
  `MD-` (portal), supaya webhook masing-masing mengenali pesanannya sendiri.
- **Akun murid:** tetap terpisah (database berbeda) sampai keputusan "akun bersama" diambil.
  Karena keduanya memakai Google `sub` dan email, menyatukannya nanti tinggal mencocokkan dua kolom itu.
