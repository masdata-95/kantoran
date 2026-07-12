# Catatan Pengembangan — Temuan Beta (Juli 2026)

Temuan dari testing production oleh founder. Belum dikerjakan — prioritaskan sebelum push user baru,
karena dua-duanya menyentuh pengalaman interview = titik funnel paling kritis.

---

## 0. Fitur multi-role + level + gate Academy (12 Juli 2026) — langkah sebelum deploy

Sudah di kode (lihat CLAUDE.md section User Flow & Database), TAPI:

- [ ] **WAJIB: jalankan `supabase-migrations/004_multi_role.sql` di Supabase Studio SEBELUM deploy.**
      Tanpa ini save progress GAGAL (upsert baru pakai `onConflict: 'user_id,position'`).
- [ ] Uji e2e setelah migration: apply Junior → interview → training Academy (termasuk misi)
      → task brief terbuka otomatis → approve → wishlist → balik hub → coba posisi kedua
      → keluar-masuk posisi (progress harus resume di titik terakhir).
- [ ] Uji user beta lama (baris user_progress pra-level): harus tetap bisa resume,
      level di-infer dari background via `normalizeLevel()`.
- [ ] Catatan perilaku (by design): replay posisi yang sama TIDAK mengulang training,
      karena lesson_progress permanen per user — gate langsung lolos.
- [ ] Gate menaikkan bobot Academy → isi `youtube_video_id` (item #3 di bawah) jadi lebih
      penting; lesson video tanpa video tampil "Video menyusul" tapi tetap bisa diselesaikan.

## 0b. Penilaian kesiapan go-live (12 Juli 2026) — gap di luar fitur

Verdict: konsep sudah benar; yang kurang adalah loop di sekelilingnya. Urut prioritas:

**P0 — sebelum dorong traffic:**
- [ ] Beresin env Gemini production (item #2 di bawah) — titik gagal paling kritis.
- [ ] Pasang analytics — saat ini NOL instrumentasi (tidak ada Vercel Analytics/PostHog).
      Metrik utama "% selesai hari-1" tidak bisa diukur; minimal event per transisi stage
      (landing→login→profile→apply→interview→task→gate).
- [ ] Halaman Privacy Policy (`/privacy`) + link di landing & LoginPage — UU PDP berlaku
      sejak data pribadi + chat history disimpan, bukan sejak monetisasi.
- [ ] Tes serius di mobile (390px) — traffic dari IG/TikTok = HP.

**P1 — penggerak funnel:**
- [ ] Share card personal (nama, posisi, gaji nego, coin) sebagai halaman share dengan
      OG image dinamis (Next.js ImageResponse) — ganti tombol copy-teks generik di WishlistForm.
      Ini lever pertumbuhan utama menurut strategi sendiri.
- [ ] Welcome email otomatis untuk waitlist (Resend, gratis 3K/bln) — sekalian verifikasi email.
      Tanpa ini signup waitlist mendingin.
- [ ] (Jangka menengah) Pindahkan gerbang login: interview bisa mulai sebagai guest, login
      saat tanda tangan offering letter ("tanda tangani kontrak" = sign in, in-story).
      Ukur dulu drop-off login+ProfileSetup begitu analytics terpasang.
- [ ] Error tracking (Sentry/sejenis) — keluhan "gangguan koneksi" user real tidak akan
      pernah sampai ke founder tanpa ini.

**P2 — prasyarat komersial (sudah terpetakan di CLAUDE.md):**
- [ ] PT perorangan → PSE Kominfo → ToS → Midtrans/Xendit. Jangan sebelum P0-P1.

---

## 1. Interview sering "lompat topik" / tidak follow-up

**Gejala:** Sinta (dan NPC lain) pindah ke pertanyaan tahap berikutnya padahal jawaban user
belum digali, terasa seperti checklist yang dikebut. Paling terasa setelah error koneksi:
begitu pulih, percakapan lanjut ke topik berikutnya seolah jawaban sebelumnya sudah dibahas.

**Akar masalah yang sudah teridentifikasi (dari kode):**

1. **Pesan error mencemari memori AI.** Di `SimulatorApp.tsx → handleSend`, saat `callChat`
   gagal, teks fallback "Maaf ada gangguan koneksi. Coba lagi ya!" di-`addMsg` sebagai pesan
   NPC biasa (`role: 'npc', npcId: 'sinta'`). `buildHistory` lalu mengirim pesan palsu ini ke
   AI sebagai "jawaban Sinta" atas pertanyaan user. AI membacanya seolah topik sudah dijawab →
   lanjut ke tahap berikutnya. **Ini penyebab utama "lompat setelah error".**
2. **Server menyamarkan kegagalan sebagai sukses.** `app/api/chat/route.ts` mengembalikan
   status 200 + fallback text saat semua provider gagal — client tidak bisa membedakan
   balasan asli vs kegagalan, jadi tidak bisa menawarkan "coba lagi".
3. **Prompt Sinta berbentuk daftar tahapan 1-11.** Model cenderung memperlakukannya sebagai
   checklist. Sudah ada instruksi "gali lebih dalam dengan follow up", tapi belum ada aturan
   eksplisit kapan BOLEH pindah tahap.

**Rencana perbaikan (urutan disarankan):**

- [x] ~~Pesan error JANGAN masuk history AI~~ — SELESAI (Juli 2026): pesan error kini
      `role: 'system'` + `isError: true`, difilter di `buildHistory`, dirender sebagai
      banner + tombol "Kirim ulang" (`handleRetry` kirim ulang pesan user terakhir
      tanpa duplikasi).
- [x] ~~`api/chat` return `{ reply, failed: true }`~~ — SELESAI: kedua jalur gagal
      (callAI null + catch) sekarang mengirim `failed: true`, client cek flag ini.
- [x] ~~Aturan pindah tahap di `getSintaPrompt`~~ — SELESAI: section baru
      "ATURAN PINDAH TAHAP (WAJIB)" di lib/prompts.ts.
- [ ] Pertimbangkan menaikkan `maxTokens` chat dari 250 → 350 (balasan Sinta kadang
      terpotong sehingga terasa loncat; cek dulu di log apakah `finishReason: MAX_TOKENS`
      sering muncul sebelum menaikkan — ada trade-off biaya).
- [ ] Ide lanjutan: kirim "stage tracker" eksplisit — hitung tahap interview di client dan
      sisipkan ke prompt ("Kamu sekarang di tahap X, belum boleh ke tahap Y") supaya alur
      tidak bergantung pada ingatan model.

## 2. Error "gangguan koneksi" berkala — dugaan limit API per-menit

**Gejala:** Beberapa kali chat error "gangguan koneksi", lalu setelah ditunggu 5-10 menit
normal lagi. Pola pulih-setelah-beberapa-menit = tanda tangan quota **per menit** (RPM/TPM),
bukan kuota harian habis.

**Fakta yang sudah diverifikasi:**
- Key Gemini di `.env.local` lokal = paid (`serviceTier: "standard"`), limit paid tier
  gemini-2.5-flash ±1.000 req/menit — mustahil tersentuh 1 user.
- Free tier = 10 req/menit → sangat cocok dengan gejala.

**Langkah diagnosa (lakukan dulu sebelum coding):**
- [ ] Vercel → Logs, kirim beberapa chat, cari baris `Gemini key failed (429)` →
      kalau ada, env production masih memakai key lama/free.
- [ ] Pastikan di Vercel Settings → Environment Variables: `GEMINI_API_KEY_1` = key paid
      baru, `GEMINI_API_KEY_2..5` DIHAPUS, semua `GROQ_API_KEY_*` DIHAPUS (key mati),
      lalu **Redeploy** (env baru tidak aktif tanpa redeploy!).
- [ ] Cek log `✓ Gemini success` muncul konsisten setelahnya.

**Rencana perbaikan di kode (kalau setelah env bersih masih terjadi):**
- [ ] Bedakan penanganan 429 vs error lain di `lib/ai.ts`: saat 429, retry sekali dengan
      jeda 2-3 detik (bukan langsung cooldown 60 detik + lempar ke fallback).
- [ ] Surface alasan gagal ke log dengan jelas: provider mana, status berapa, supaya
      diagnosa berikutnya tinggal baca log.
- [ ] Pertimbangkan antrian ringan di client: kalau request gagal karena limit, tampilkan
      "Sinta lagi ngetik..." lebih lama dan auto-retry 1x sebelum menyerah.

## 3. Backlog kecil terkait (sudah diketahui, belum urgent)

- [x] ~~Nego gaji bisa ter-skip~~ — SELESAI (Juli 2026): guard `salaryDiscussed` di
      SimulatorApp (deteksi selesai interview, termasuk `[SELESAI]`, diabaikan kalau
      belum ada pesan berisi gaji/juta/salary di history hr_office).
- [ ] `npm run lint` penuh masih merah karena error react-hooks lama di `SimulatorApp.tsx`
      (pre-existing) — bereskan saat refactor komponen besar itu.
- [ ] Isi `youtube_video_id` untuk 5 lesson video Academy (Excel & Looker) via Supabase Studio.
