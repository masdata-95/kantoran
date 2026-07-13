# Kantoran — Claude Code Context

## Project Overview
Kantoran adalah platform LMS berbasis simulasi dunia kerja (office roleplay) pertama di Indonesia.
Tagline: "Belajar kerja, sambil kerja beneran."
Live: https://kantoran.vercel.app
Repo: github.com/masdata-95/kantoran (Private)

## Tech Stack
- Frontend: Next.js 16.2.7 + TypeScript + Tailwind v4
- Auth + DB: Supabase (Google OAuth, PostgreSQL, RLS)
- AI: Multi-provider — Gemini (paid, primary) → Groq (fallback) → OpenRouter (last resort)
- Deploy: Vercel (team: masdatabusiness-9486)
- Tailwind: v4 — pakai @import "tailwindcss" di globals.css, BUKAN tailwind.config.ts

## Perusahaan Fiktif
PT Vantara Nusantara — FMCG personal care
Produk: Lumière (skincare), Roots&Co (haircare), Vanta Glow (body care)
Kantor: Jakarta Selatan, Hybrid 3x WFO/minggu

## User Flow
1. Landing page (public/landing.html)
2. /simulator → Login Google (onboarding slides sudah dihilangkan)
3. ProfileSetup (5 step: nama/gender/kota, pendidikan, pengalaman, skills, kategori)
4. JobListing = HUB KARIR multi-role: semua 5 posisi tampil dengan status per posisi
   (Tersedia / berjalan / Hari-1 selesai). Modal detail punya pemilih JENJANG
   (intern/junior/mid — bebas dipilih, background profil cuma default).
   Setelah login user SELALU diarahkan ke hub ini, bukan auto-resume.
   Saat pertama masuk simulator: GuidedTour (spotlight overlay, sekali per akun
   via localStorage `kantoran_tour_v1_<user.id>`, components/GuidedTour.tsx).
5. SimulatorApp (progress per (user, posisi) — pindah posisi tidak menghapus run lama;
   tombol 🏢 Lowongan di topbar = keluar ke hub, Restart = reset posisi ini saja):
   - Step 0: Inbox (email undangan interview)
   - Step 1: HR Office (interview + nego gaji dengan Sinta, ikut level)
   - Step 2: Inbox (Offering Letter, gaji ikut level)
   - Step 3: Tanda tangan → Slack welcome
   - Step 4: Supervisor DM → standup + orientasi. Academy di-assign sebagai bekal
     OPSIONAL (bukan gate, diubah 13 Juli 2026): task turun setelah user menjawab
     standup (fallback 2 menit kalau diam). Training yang diselesaikan → apresiasi
     supervisor +10 coin + baris di surat referensi (evalTraining/trainingDone).
   - Step 5: Task brief + File Manager (download Excel)
   - Step 6-8: Workspace (upload Excel, AI review). Step 6 juga memunculkan DILEMA
     dari junior (message role 'choice') — pilihan menentukan gaya kerja user.
   - Step 9: APPROVED → Supervisor "sudah jam 5"
   - Step 10: Premium gate → Wishlist form
6. WishlistForm hanya SEKALI seumur akun (GET /api/waitlist → {submitted});
   sesudahnya selesai posisi → langsung balik hub untuk coba posisi lain

Mekanik "career RPG" (12 Juli 2026, semua derived dari chat_history TANPA migration):
- STAKES: revisi dihitung dari kartu feedback REVISION di sup_chat → grade
  (exceeds/meets/needs_improvement) tampil di kartu day_done + surat referensi;
  supervisor makin dingin di revisi ke-2+ (handleSubmitTask).
- SURAT REFERENSI LIVE: room 'reference' (📜) terbuka setelah kontrak; baris terisi
  per milestone, baris day 2-7 terkunci (teaser premium), kutipan supervisor ikut grade.
- KANTOR HIDUP: kembali setelah > 8 jam (cek last_active di loadProgress) → NPC
  mengirim pesan "selama kamu pergi" (sup kalau sedang ada task, jnr kalau belum).
- GAYA KERJA: dilema 'choice' dari junior (step 6), trait (integritas/aman) dibaca
  getWorkStyle() → dibacakan di penilaian akhir hari + jadi baris surat referensi.
- KEHADIRAN SOSIAL: /api/stats → "N orang menjalani simulasi minggu ini" di JobListing
  (hanya tampil kalau N >= 3).
- TEACH-BACK: setelah task approved, junior minta diajari (POSITIONS[x].teachBack) —
  user gantian menjelaskan, junior AI menanggapi sebagai pembelajar (getJnrPrompt).
- REFLEKSI: supervisor menanyakan "satu hal yang paling kamu pelajari" setelah jam 5.
- SHARE PERSONAL: buildRecap() di SimulatorApp (role, gaji nego, grade, gaya kerja)
  → dikirim ke WishlistForm via onWishlist(coins, tasksDone, recap).
- REFRESH RESUME: posisi aktif per-tab di sessionStorage (kantoran_active_pos_<uid>),
  room terakhir juga (kantoran_last_view_<uid>_<pos>) — refresh TIDAK melempar ke hub;
  keluar via tombol Lowongan/selesai wishlist menghapus key.

## NPC Characters
- Sinta Maharani (SM) — HR Business Partner, ada di semua posisi
- Per posisi: Supervisor, Manager, Junior (nama berbeda tiap dept)
- Data Analyst: Rizky Pratama (sup), Diana Kusuma (mgr), Galih Ananta (jnr)
- Marketing: Dinda Pratiwi (sup), Budi Kurniawan (mgr), Aldi Lesmana (jnr)
- Finance: Andi Wijaya (sup), Pak Hendra (mgr), Nisa Safitri (jnr)
- HR: Bu Ratna (sup), Pak Tono (mgr), Lili Cahyani (jnr)
- BizDev: Reza Firmansyah (sup), Pak Anton (mgr), Mira Rahayu (jnr)

## Salary Ranges (per LEVEL jenjang, bukan background — lib/positions.ts)
Level hanya 3 sejak 12 Juli 2026 (intern_magang dilebur ke intern):
- intern: Rp 1.8-3 juta (default utk student & fresh_grad)
- junior: Rp 4-6 juta (default utk jobseeker)
- mid: Rp 6-9 juta (default utk career_switch)
Akses via getSalaryRange()/normalizeLevel() — menerima 'intern_magang' lama
dan key background lama (run pra-level), keduanya dinormalisasi.

## AI System (lib/ai.ts)
Multi-provider dengan key rotation, urutan: Gemini (paid) → Groq → OpenRouter:
- GEMINI_API_KEY_1 sampai _5 (key di header x-goog-api-key)
- Model via env: GEMINI_MODEL (default gemini-2.5-flash) & GROQ_MODEL (default
  llama-3.3-70b-versatile) — migrasi model cukup ganti env + redeploy
- GROQ_API_KEY_1 sampai _5
- OPENROUTER_API_KEY (last resort, model :free)
- `callAI(messages, systemPrompt, opts)` — opts: `{ maxTokens, temperature, json, clean, deadlineMs }`. Return `AIResult | null` (null = semua provider gagal; route yang menentukan pesan error).
- `json: true` → structured output (Gemini responseMimeType / Groq response_format), temp 0.3, cleanResponse dimatikan. Wajib untuk endpoint yang parse JSON (cv-review, review via lib/reviewTask.ts).
- Deadline budget total 25s mencegah rantai fallback melewati maxDuration 30s.
- Rate limiting harian per user via lib/rateLimit.ts + RPC bump_usage (chat 300, review 25, cv 10, mission 30). Migration: supabase-migrations/002_rate_limits.sql.
- Auth API: verifikasi JWT lokal (jose) di lib/serverAuth.ts; set SUPABASE_JWT_SECRET di env untuk jalur tercepat, fallback otomatis ke JWKS lalu auth.getUser network.

## CV Kantoran (/cv — satelit AI CV scorer)
- app/cv/page.tsx — upload PDF/DOCX/TXT (maks 4MB, pre-check client) atau tempel manual, autofill dari profil
- app/api/cv-extract/route.ts — ekstraksi teks (unpdf/mammoth), runtime nodejs
- app/api/cv-review/route.ts — skor ATS + rewrite via callAI json mode (2500 token)
- lib/cvPrompt.ts — prompt JSON schema

## Vantara Academy (sistem belajar per posisi)
Konsep: e-course DENGAN story + misi, posisinya JUST-IN-TIME (bukan gerbang wajib):
task tetap turun tanpa training; supervisor menyarankan Academy saat revisi pertama
("belajar sebagai penyelamat"). Room 'academy' di sidebar (terbuka step >= 4),
supervisor meng-assign "training module" (in-story). Modul day 1 gratis; day >= 2
tampil sebagai kartu teaser terkunci (umpan premium, konten tidak dikirim API).
- Konten di Supabase (lesson_modules, lessons, lesson_progress) — update tanpa deploy. Migration: supabase-migrations/003_academy.sql.
- Tiap posisi: modul tools (+ modul bisnis bersama position_id='all'), track 'tools' | 'business'. Lesson type: text | video | mission.
- Video: kolom youtube_video_id nullable — isi di Supabase Studio kapan saja (lite-embed di YouTubeEmbed.tsx, placeholder "Video menyusul" kalau kosong).
- Misi direview AI supervisor via lib/reviewTask.ts (engine sama dengan task review → suara konsisten). Rubric mission JSONB tidak pernah dikirim ke client.
- Authoring: content/lessons/*.md (frontmatter) + modules.json → `npm run seed:lessons` (idempotent, upsert by slug). Seed TIDAK menimpa youtube_video_id yang diisi manual.
- API: GET /api/lessons?position=..., POST /api/lessons/progress, POST /api/lessons/submit.
- UI: components/academy/ (AcademyPanel, LessonView, MarkdownLite, YouTubeEmbed) — di-load dinamis, react-markdown tidak membebani bundle chat.

## Database (Supabase)
Project ID: owgxrhtmljwjxzvjcdlt
Tables:
- user_progress: MULTI-ROLE — unique (user_id, position), satu baris per run posisi.
  Kolom: step, coins, tasks_done, streak, chat_history, background, level, position.
  Migration: supabase-migrations/004_multi_role.sql (WAJIB dijalankan sebelum deploy fitur ini)
- user_profiles: full_name, gender, city, education (JSONB), experience (JSONB), skills (TEXT[]), category
- waitlist: email, name, rating, feedback, wishlist, position_tried
- api_usage: rate limiting harian (user_id, bucket, day, count) + RPC bump_usage
- lesson_modules / lessons / lesson_progress: Vantara Academy (lihat section di bawah)
Migrations baru ada di supabase-migrations/*.sql — jalankan manual di Studio SQL Editor.

## Key Files
- components/SimulatorApp.tsx — main simulator (~2000 lines)
- components/ProfileSetup.tsx — form profil 5 step
- components/ProfileTab.tsx — CV panel di sidebar
- components/JobListing.tsx — grid loker + modal
- components/WishlistForm.tsx — ending form
- components/OnboardingSlides.tsx — 4 slide sebelum login
- lib/ai.ts — multi-provider AI system (Gemini primary, json mode, deadline budget)
- lib/reviewTask.ts — engine review terstruktur (dipakai /api/review + misi Academy)
- lib/rateLimit.ts — rate limit harian per user (Postgres RPC)
- lib/lessons.ts — tipe DTO Academy
- lib/prompts.ts — system prompts semua NPC (+ getTaskReviewPromptJSON, token [SELESAI] Sinta)
- lib/positions.ts — data 5 posisi + NPC config
- lib/profile.ts — UserProfile types
- lib/skills.ts — 70+ skills preset
- components/GuidedTour.tsx — tur spotlight untuk user baru di simulator
- components/SqlEditor.tsx — "Database Vantara": SQL editor in-browser (sql.js WASM) khusus data_analyst, room 'database' step >= 5; tantangan dinilai otomatis via lib/sqlCompare.ts (tanpa AI)
- lib/sqlCompare.ts — pembanding hasil query untuk grading tantangan SQL
- scripts/generate-universe.ts — Vantara Data Universe: generator seeded (npm run generate:universe) → public/data/vantara.db + public/data/csv/* + public/sql-wasm.wasm; anomali cerita ditanam di data (Jatim -38% YoY, Berkah Jaya nunggak ±Rp 77jt, TikTok conversion rendah, overspend Q4)
- components/ReferenceLetter.tsx — surat referensi live (room 'reference', terbuka setelah kontrak; baris terisi per milestone, bunyi surat ikut grade)
- lib/performance.ts — grade & gaya kerja diturunkan dari chat_history (countRevisions/computeGrade/getWorkStyle) — SENGAJA tanpa kolom DB baru
- app/api/stats/route.ts — jumlah user aktif 7 hari (kehadiran sosial di job listing)
- app/api/chat/route.ts — AI chat endpoint (cap 40 pesan × 2000 char, userContext dibangun ulang server-side)
- app/api/review/route.ts — task review endpoint (submission di-cap 15rb char)
- app/api/progress/route.ts — save/load progress (angka di-clamp, step tidak boleh mundur → 409)
- app/api/profile/route.ts — user profile CRUD
- app/api/reset/route.ts — reset journey
- app/api/waitlist/route.ts — waitlist submission
- app/simulator/page.tsx — flow orchestration

## Styling Conventions
- Warna utama: #0F6E56 (teal)
- Background: #FAFAF7
- Border: #E5E3DC
- Font: system font stack
- Semua button pakai style={{ cursor: 'pointer' }}
- Class btn-teal sudah didefinisikan di globals.css
- NPC avatar classes: av-teal, av-blue, av-purple, av-amber

## Backlog Aktif
- CATATAN-PENGEMBANGAN.md — temuan beta Juli 2026 + statusnya. Cek dulu sebelum mengerjakan perbaikan interview/AI.
- REKOMENDASI-PENGEMBANGAN.md — prioritas pengembangan (P0 analytics/Sentry/privacy) + penyempurnaan konsep.
- KONTEN-ROADMAP.md — desain Season 1, arc "Kasus Region Timur", katalog study case, interkoneksi antar posisi.
- DEPLOY-CLOUDFLARE.md — rencana pindah deploy Vercel → Cloudflare Workers (step-by-step). Vercel masih live sampai cutover.

## Common Issues & Solutions
- Tailwind v4: tidak pakai tailwind.config.ts, semua lewat @import di globals.css
- Supabase RLS: pakai SUPABASE_SERVICE_ROLE_KEY untuk server-side, bukan anon key
- addMsg race condition: untuk pesan kritis (inbox email), langsung update setState, jangan pakai addMsg lewat setTimeout
- Cursor tidak aktif: useEffect watching loading state + requestAnimationFrame
- Nama posisi redundant: bgRole sudah include full role name, jangan append pos.title lagi

## Founder
Zhofar Murry Setiawan (@masdata) — 190K+ followers di niche data/Excel/karir
Solo founder, fase beta

## Business Context & Strategy
Selalu pikirkan keputusan teknis dalam konteks bisnis ini, bukan cuma "apakah kodenya benar" tapi "apakah ini menggerakkan funnel".

### Posisi pasar
- Kategori: experience, BUKAN konten. User "mengalami kerja", bukan "menonton materi". Ini pembeda utama dari e-course/bootcamp.
- Klaim: simulasi kerja (office roleplay) pertama di Indonesia. Belum ada kompetitor langsung.
- Unfair advantage: 190K followers @masdata di niche data/Excel/karir = persis target market. Distribusi konten = mesin akuisisi utama.
- Aset unik yang bikin orang mau bayar: surat referensi kerja + pengalaman simulasi yang bisa masuk CV/LinkedIn.

### Funnel (titik konversi)
Landing → login Google → profile setup → job listing → simulator (interview, nego gaji, task, review AI) → premium gate "hari pertama selesai" → wishlist/waitlist → (target: beli).
- Metrik utama yang harus dijaga: % user yang menyelesaikan hari-1 (dulu 0% karena bug stuck step 3, sudah diperbaiki Juni 2026). Target ≥40% dari yang mulai interview.
- Konversi free→paid target 3-5% (standar freemium).
- Lever pertumbuhan: share card hasil simulasi + surat referensi yang viral di LinkedIn.

### Monetisasi (urutan prioritas)
1. Freemium B2C: hari-1 gratis → beli "season" 3 bulan Rp 149-249rb sekali bayar (pasar ID anti-subscription) atau langganan Rp 49-99rb/bln.
2. Sertifikat + surat referensi berbayar (add-on Rp 25-50rb), shareable ke LinkedIn.
3. B2B kampus & bootcamp (Rp 1,5-5jt/kohort atau Rp 20-35rb/mahasiswa).
4. Kartu Prakerja (channel pemerintah, butuh badan usaha + kurasi).
5. Employer branding/recruiting funnel (perusahaan jadi "perusahaan simulasi" + assessment kandidat) — potensi nilai tertinggi jangka panjang.

### Sebelum terima uang (prasyarat)
PT perorangan → daftar PSE Kominfo (wajib platform digital ID) → Privacy Policy + ToS (UU PDP, simpan data pribadi + chat) → payment gateway Midtrans/Xendit (QRIS/VA/e-wallet, bukan kartu kredit) → verifikasi email waitlist.

### Prinsip produk untuk konversi
- Jangan jual fitur, lanjutkan cerita lalu kunci di momen paling penasaran (cliffhanger DM manager, roadmap task terkunci).
- NPC harus terasa manusia (anti AI-slop): no markdown, no dash, kalimat pendek, partikel chat ID. Ini inti "terasa nyata" yang bikin orang mau lanjut.
- Setiap posisi (5 divisi) harus terasa setara — tapi Data Analyst kemungkinan converting tertinggi karena niche follower @masdata. Pertimbangkan saat prioritas konten/marketing.
