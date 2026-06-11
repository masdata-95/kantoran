# Kantoran — Claude Code Context

## Project Overview
Kantoran adalah platform LMS berbasis simulasi dunia kerja (office roleplay) pertama di Indonesia.
Tagline: "Belajar kerja, sambil kerja beneran."
Live: https://kantoran.vercel.app
Repo: github.com/masdata-95/kantoran (Private)

## Tech Stack
- Frontend: Next.js 16.2.7 + TypeScript + Tailwind v4
- Auth + DB: Supabase (Google OAuth, PostgreSQL, RLS)
- AI: Multi-provider — Groq (primary) → Gemini (fallback) → OpenRouter (last resort)
- Deploy: Vercel (team: masdatabusiness-9486)
- Tailwind: v4 — pakai @import "tailwindcss" di globals.css, BUKAN tailwind.config.ts

## Perusahaan Fiktif
PT Vantara Nusantara — FMCG personal care
Produk: Lumière (skincare), Roots&Co (haircare), Vanta Glow (body care)
Kantor: Jakarta Selatan, Hybrid 3x WFO/minggu

## User Flow
1. Landing page (public/landing.html)
2. /simulator → OnboardingSlides (4 slide: apply, interview, kerja, feedback)
3. Login Google
4. ProfileSetup (5 step: nama/gender/kota, pendidikan, pengalaman, skills, kategori)
5. JobListing (grid 2 kolom, modal detail, klik Apply)
6. SimulatorApp:
   - Step 0: Inbox (email undangan interview)
   - Step 1: HR Office (interview + nego gaji dengan Sinta)
   - Step 2: Inbox (Offering Letter)
   - Step 3: Tanda tangan → Slack welcome
   - Step 4: Supervisor DM → standup + orientasi perusahaan/posisi/SOP
   - Step 5: Task brief + File Manager (download Excel)
   - Step 6-8: Workspace (upload Excel, AI review)
   - Step 9: APPROVED → Supervisor "sudah jam 5"
   - Step 10: Premium gate → Wishlist form
7. WishlistForm → konfirmasi waitlist

## NPC Characters
- Sinta Maharani (SM) — HR Business Partner, ada di semua posisi
- Per posisi: Supervisor, Manager, Junior (nama berbeda tiap dept)
- Data Analyst: Rizky Pratama (sup), Diana Kusuma (mgr), Galih Ananta (jnr)
- Marketing: Dinda Pratiwi (sup), Budi Kurniawan (mgr), Aldi Lesmana (jnr)
- Finance: Andi Wijaya (sup), Pak Hendra (mgr), Nisa Safitri (jnr)
- HR: Bu Ratna (sup), Pak Tono (mgr), Lili Cahyani (jnr)
- BizDev: Reza Firmansyah (sup), Pak Anton (mgr), Mira Rahayu (jnr)

## Salary Ranges (per background)
- fresh_grad: Rp 2-3.5 juta (Intern)
- student: Rp 1.2-2 juta (Intern Magang)
- jobseeker: Rp 4-6 juta (Junior)
- career_switch: Rp 6-9 juta (Mid-Level)

## AI System (lib/ai.ts)
Multi-provider dengan key rotation:
- GROQ_API_KEY_1 sampai _5 (llama-3.3-70b-versatile)
- GEMINI_API_KEY_1 sampai _5 (gemini-2.0-flash-exp)
- OPENROUTER_API_KEY (fallback)

## Database (Supabase)
Project ID: owgxrhtmljwjxzvjcdlt
Tables:
- user_progress: step, coins, tasks_done, streak, chat_history, background, position
- user_profiles: full_name, gender, city, education (JSONB), experience (JSONB), skills (TEXT[]), category
- waitlist: email, name, rating, feedback, wishlist, position_tried

## Key Files
- components/SimulatorApp.tsx — main simulator (~2000 lines)
- components/ProfileSetup.tsx — form profil 5 step
- components/ProfileTab.tsx — CV panel di sidebar
- components/JobListing.tsx — grid loker + modal
- components/WishlistForm.tsx — ending form
- components/OnboardingSlides.tsx — 4 slide sebelum login
- lib/ai.ts — multi-provider AI system
- lib/prompts.ts — system prompts semua NPC
- lib/positions.ts — data 5 posisi + NPC config
- lib/profile.ts — UserProfile types
- lib/skills.ts — 70+ skills preset
- app/api/chat/route.ts — AI chat endpoint
- app/api/review/route.ts — task review endpoint
- app/api/progress/route.ts — save/load progress
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
