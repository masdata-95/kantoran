# Rekomendasi Pengembangan Kantoran

> 12 Juli 2026. Ringkasan yang baru dikerjakan hari ini ada di bagian akhir.
> Urutan di sini = urutan pengerjaan yang disarankan.

## P0 — Sebelum dorong traffic (minggu ini)

1. **Analytics.** Masih nol instrumentasi. Tanpa ini semua keputusan (termasuk isi KONTEN-ROADMAP.md) menebak. Pasang PostHog (gratis 1jt event/bln, self-serve): event per transisi funnel — `landing_view, login, profile_done, apply, interview_start, interview_done, offer_signed, training_done, task_submitted, day1_done, waitlist_submitted`. Satu sesi kerja, selesai.
2. **Error tracking.** Sentry free tier cukup. Keluhan "gangguan koneksi" user real tidak akan pernah sampai ke founder tanpa ini.
3. **Halaman /privacy + /terms.** UU PDP berlaku sejak data pribadi + chat disimpan, bukan sejak monetisasi. Link dari landing + LoginPage.
4. **Tes mobile 390px** end-to-end, termasuk guided tour baru (drawer sidebar dibuka otomatis saat step tur menyorot sidebar — pastikan mulus di HP asli, bukan cuma devtools).

## P1 — Penggerak funnel (2-4 minggu)

5. **Share card dengan OG image dinamis** (Next ImageResponse): nama, posisi, gaji hasil nego, coin. Ganti tombol copy-teks di WishlistForm. Ini lever pertumbuhan utama sesuai strategi sendiri — konten @masdata mengarahkan ke sini.
6. **Welcome email waitlist** (Resend, gratis 3rb/bln) + verifikasi email. Waitlist yang tidak disapa = mendingin.
7. **Konten Arc 1 Data Analyst hari 2-7** sesuai KONTEN-ROADMAP.md — depth-first, satu posisi dulu. Ini prasyarat monetisasi: tidak ada yang membayar untuk konten yang belum ada.
8. **Task pindah ke Supabase** (tabel `tasks`, pola sama dengan `lessons`) supaya konten Arc rilis tanpa deploy.

## P2 — Kualitas engineering (berjalan paralel, jangan menunda P0-P1)

9. **Test unit untuk logika rapuh:** `normalizeLevel`, deteksi `[SELESAI]` + guard `salaryDiscussed`, filter `buildHistory`, ekstraksi gaji `extractJuta`. Vitest, satu file per fungsi, jalankan di CI (GitHub Actions gratis). Ini pagar sebelum refactor besar.
10. **Refactor SimulatorApp.tsx (2.200 baris)** setelah ada test: pecah per view (InboxView dkk sudah komponen — pindahkan ke file sendiri), tarik state machine step ke module murni yang bisa dites. Sekalian bereskan error react-hooks yang membuat lint merah.
11. **Ganti dependency `xlsx` 0.18.5** — versi npm SheetJS tidak di-update dan punya CVE publik (prototype pollution/ReDoS) tanpa patch; kita memproses file upload user dengannya. Opsi: build resmi dari CDN SheetJS, atau `exceljs`.
12. **Validasi step server-side yang sesungguhnya.** Hari ini step sudah tidak bisa mundur dan angka di-clamp, tapi klien masih bisa melompat maju. Saat sertifikat/surat referensi jadi produk berbayar, klaim "selesai" harus dihitung server (state machine transisi sah per step). Catat sebagai prasyarat monetisasi sertifikat.

## P3 — Prasyarat komersial (sudah terpetakan, urutan tetap)

PT perorangan → PSE Kominfo → ToS → Midtrans/Xendit → baru terima uang. Jangan mulai sebelum P0-P1 selesai dan angka funnel terlihat.

---

## Penyempurnaan konsep

**Definisi satu kalimat (pegang ini di semua copy):**
Kantoran = *career RPG*: kamu menjalani karir sungguhan di perusahaan fiktif yang hidup, dan pengalamannya menjadi aset nyata di CV-mu.

Tiga pilar yang harus selalu diperkuat, dan uji setiap fitur baru terhadapnya:

1. **Dunia yang hidup (immersion).** NPC manusiawi (sudah kuat), kantor yang bergerak sendiri — event feed, kejadian lintas divisi, konsekuensi yang menginap (KONTEN-ROADMAP.md #5). Segala yang berbau "aplikasi belajar" (badge norak, popup gamifikasi, bahasa AI) melemahkan pilar ini. Kebersihan anti-AI-slop hari ini bagian dari pilar ini.
2. **Kemajuan yang terasa (progression).** Saat ini coin belum punya kegunaan — economy tanpa sink. Rekomendasi: coin bisa ditukar hal in-story (sesi 1-on-1 dengan manager = konten bonus, "cuti" = skip task tanpa penalti streak, akses arsip kasus lama). Streak antar sesi + performance review tiap akhir arc = ritme kemajuan. Jenjang intern → junior → mid sekarang rapi (3 level) dan bisa jadi jalur promosi in-game: selesaikan season dengan nilai bagus → tawaran promosi = alasan beli season berikutnya.
3. **Aset yang dibawa pulang (proof).** Surat referensi + pengalaman simulasi di CV = alasan bayar paling kuat. Setiap arc selesai harus menghasilkan artefak yang bisa dipamerkan (share card, ringkasan portofolio, referensi). Jadikan setiap akhir arc momen shareable — itu sekaligus mesin akuisisi.

**Model harga yang disarankan** (selaras pasar ID anti-subscription): Season Pass Rp 149-249rb sekali bayar per season 3 bulan; season berikutnya = cerita + jabatan baru → repeat purchase tanpa langganan. Add-on: surat referensi + sertifikat Rp 25-50rb. B2B kampus menyusul setelah angka retensi B2C terbukti.

**Metrik yang menentukan (pasang di analytics hari pertama):**
- % mulai interview → selesai hari-1 (target ≥40%)
- % selesai hari-1 → daftar waitlist
- (setelah Arc 1 rilis) % hari-2 → hari-7 = angka retensi yang menentukan harga season
- % user yang mencoba posisi kedua (proxy love metric sebelum ada pembayaran)

---

## Yang sudah dikerjakan 13 Juli 2026 (batch konsep)

Lima dari tujuh rekomendasi konsep langsung diimplementasi (semua derived dari
chat_history — sengaja TANPA migration DB baru):

1. **Stakes** — jumlah revisi → grade (Exceeds/Meets/Needs Improvement) di kartu akhir
   hari; supervisor makin dingin di revisi ke-2 dan ke-3 (lib/performance.ts).
2. **Kantor hidup** — kembali setelah > 8 jam → NPC mengirim pesan "selama kamu pergi"
   (supervisor menanyakan task, atau junior cerita kejadian pantry).
3. **Surat referensi live** — room baru 'Surat Referensi' (terbuka setelah kontrak):
   baris terisi per milestone, baris hari 2-7 terkunci, kutipan supervisor berubah
   sesuai grade, catatan gaya kerja ikut tercetak (components/ReferenceLetter.tsx).
4. **Pilihan gaya kerja** — dilema dari junior di step 6 (message role 'choice');
   trait integritas/aman dibacakan di penilaian akhir hari + surat referensi.
5. **Kehadiran sosial asinkron** — /api/stats (distinct user aktif 7 hari) tampil di
   job listing kalau >= 3 orang.

**Update 13 Juli 2026:** reposisi Academy SUDAH dikerjakan (atas keputusan founder,
tanpa menunggu analytics): hard gate dihapus, task turun setelah standup, Academy
disarankan supervisor saat revisi pertama, training selesai → apresiasi + 10 coin +
baris surat referensi. Yang masih ditunda: guest-first login (tunggu data funnel).

## Yang sudah dikerjakan 12 Juli 2026 (batch pertama)

- Level dilebur jadi 3: intern / junior / mid (`normalizeLevel` tetap menerima `intern_magang` & background lama — run lama aman).
- Guided tour spotlight untuk user baru (components/GuidedTour.tsx, sekali per akun, langkah sidebar membuka drawer di mobile).
- Hardening API: progress divalidasi & di-clamp + tidak bisa mundur (409), chat dibatasi 40 pesan × 2.000 char + userContext dibangun ulang server, submission review di-cap 15rb char, model AI via env (`GEMINI_MODEL`, `GROQ_MODEL`).
- Bersih AI slop: title tab `Kantoran | Simulasi Dunia Kerja`, emoji dekoratif dihapus dari notifikasi/tombol/chip, copy "direview AI" → suara in-story, ikon HR Office 🔥 → 🤝, statistik placeholder rapi.
- Interkoneksi antar posisi ditanam di teaser day 2-7 (storyline "Kasus Region Timur" saling menyebut antar divisi).
- URL hardcoded vercel.app di UI diganti relatif (persiapan pindah domain).
- Dokumen: KONTEN-ROADMAP.md (baru), DEPLOY-CLOUDFLARE.md (step-by-step lengkap), file ini.
