# BLUEPRINT KANTORAN — Spesifikasi Lengkap untuk Membangun Ulang Sistem

> **Cara pakai dokumen ini:** lempar seluruh file ini ke AI coding agent (Claude Code, Cursor, Codex, dsb) dengan instruksi:
>
> *"Bangun aplikasi persis seperti spesifikasi di dokumen ini. Ikuti urutan build di Bagian 22. Jangan menyederhanakan mekanik yang ditandai KRITIS. Jangan mengganti stack. Tanyakan hanya jika ada kontradiksi di dokumen."*
>
> Dokumen ini adalah spesifikasi implementasi, bukan ringkasan. Semua angka, nama, aturan prompt, dan guardrail di sini adalah hasil iterasi produksi — mengubahnya akan mengubah perilaku produk.

---

## DAFTAR ISI

1. [Apa yang dibangun (product brief)](#1-apa-yang-dibangun-product-brief)
2. [Tech stack & versi](#2-tech-stack--versi)
3. [Struktur folder final](#3-struktur-folder-final)
4. [Environment variables](#4-environment-variables)
5. [Skema database lengkap (SQL siap jalan)](#5-skema-database-lengkap-sql-siap-jalan)
6. [Domain model: posisi, NPC, level, gaji](#6-domain-model-posisi-npc-level-gaji)
7. [Lapisan AI (multi-provider + fallback)](#7-lapisan-ai-multi-provider--fallback)
8. [Prompt engineering: aturan anti AI-slop (KRITIS)](#8-prompt-engineering-aturan-anti-ai-slop-kritis)
9. [Prompt tiap NPC (spesifikasi lengkap)](#9-prompt-tiap-npc-spesifikasi-lengkap)
10. [State machine simulator (step 0-10 + 97/98/99)](#10-state-machine-simulator-step-0-10--979899)
11. [Model pesan & tipe kartu chat](#11-model-pesan--tipe-kartu-chat)
12. [Ruangan (rooms) & aturan kunci](#12-ruangan-rooms--aturan-kunci)
13. [Mekanik "career RPG" (turunan dari chat_history)](#13-mekanik-career-rpg-turunan-dari-chat_history)
14. [Sistem review task (skor internal)](#14-sistem-review-task-skor-internal)
15. [Kontrak API (semua endpoint)](#15-kontrak-api-semua-endpoint)
16. [Vantara Academy (LMS in-story)](#16-vantara-academy-lms-in-story)
17. [Sistem Task Season & pipeline authoring](#17-sistem-task-season--pipeline-authoring)
18. [Vantara Data Universe + SQL editor](#18-vantara-data-universe--sql-editor)
19. [Observability, admin, rate limit, hardening](#19-observability-admin-rate-limit-hardening)
20. [Design system & komponen UI](#20-design-system--komponen-ui)
21. [Jebakan yang SUDAH pernah terjadi (jangan diulang)](#21-jebakan-yang-sudah-pernah-terjadi-jangan-diulang)
22. [Urutan build & acceptance criteria](#22-urutan-build--acceptance-criteria)

---

## 1. Apa yang dibangun (product brief)

**Nama:** Kantoran
**Tagline:** "Belajar kerja, sambil kerja beneran."
**Kategori:** LMS berbasis **simulasi dunia kerja** (office roleplay), bahasa Indonesia.

Bedanya dengan e-course: user **tidak menonton materi**, user **mengalami hari kerja**. Dia dilamar-kan ke perusahaan fiktif, diinterview HR (AI), **negosiasi gaji beneran** (angka hasil nego masuk ke offering letter), tanda tangan kontrak, masuk Slack tim, di-brief supervisor, mengunduh file Excel, mengerjakannya, meng-upload, lalu **direview AI yang berperan sebagai supervisornya** — bisa di-APPROVE atau disuruh revisi.

**Perusahaan fiktif:** PT Vantara Nusantara — FMCG personal care.
Brand: **Lumière** (skincare), **Roots&Co** (haircare), **Vanta Glow** (body care).
Kantor Jakarta Selatan, hybrid 3x WFO/minggu.

**6 posisi yang bisa dilamar:** Data Analyst, Marketing Analyst, Finance Analyst, HR Generalist, Business Development, Admin Operasional.

**Model bisnis:** freemium. Hari-1 gratis penuh → gate premium di ujung hari-1 → season (day 2+) berbayar.

**Prinsip produk yang tidak boleh dilanggar:**

| Prinsip | Implikasi teknis |
|---|---|
| NPC harus terasa manusia | Aturan gaya bicara di Bagian 8 wajib ada di SEMUA system prompt. Tanpa ini produk mati. |
| Kegagalan mengubah cerita, bukan menghentikan | Revisi tidak memblokir; ia menurunkan grade, mendinginkan supervisor, dan mengubah bunyi surat referensi. |
| Aset yang dibangun, bukan janji di akhir | Surat referensi terlihat sejak hari pertama dan terisi per milestone (endowed progress). |
| Belajar itu just-in-time, bukan gerbang | Academy TIDAK memblokir task. Ia ditawarkan saat user gagal (penyelamat). |
| Cliffhanger, bukan paywall telanjang | Konten terkunci ditampilkan sebagai teaser cerita (judul + 1 kalimat), bukan "upgrade to pro". |

---

## 2. Tech stack & versi

Jangan diganti. Versi ini yang sudah terbukti jalan bersama.

```jsonc
// package.json
{
  "name": "kantoran-app",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "seed:lessons": "tsx scripts/seed-lessons.ts",
    "seed:tasks": "tsx scripts/seed-tasks.ts",
    "generate:universe": "tsx scripts/generate-universe.ts",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf:tail": "wrangler tail kantoran"
  },
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.107.0",
    "exceljs": "^4.4.0",
    "jose": "^6.2.3",
    "lucide-react": "^1.17.0",
    "mammoth": "^1.12.0",
    "next": "16.2.7",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "sql.js": "^1.14.1",
    "unpdf": "^1.6.2"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "^1.20.1",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20", "@types/react": "^19", "@types/react-dom": "^19",
    "@types/sql.js": "^1.4.11",
    "eslint": "^9", "eslint-config-next": "16.2.7",
    "gray-matter": "^4.0.3",
    "tailwindcss": "^4",
    "tsx": "^4.23.0",
    "typescript": "^5",
    "vitest": "^4.1.10",
    "wrangler": "^4.107.0",
    "xlsx": "^0.18.5"
  },
  "overrides": { "exceljs": { "uuid": "^11.1.1" } }
}
```

**Catatan wajib:**

- **Tailwind v4** — TIDAK ADA `tailwind.config.ts`. Semua lewat `@import "tailwindcss";` di `app/globals.css`, PostCSS pakai `@tailwindcss/postcss`.
- **xlsx hanya devDependency.** Parser Excel di browser WAJIB `exceljs` (xlsx punya CVE tanpa patch). Konsekuensi: hanya menerima `.xlsx`, bukan `.xls`.
- **Runtime:** semua API route default edge-compatible; route yang parsing PDF/DOCX (`/api/cv-extract`) pakai `export const runtime = 'nodejs'`.
- Deploy target: Vercel (primary) atau Cloudflare Workers via `@opennextjs/cloudflare`. Kode tidak boleh bergantung state in-memory antar-request (makanya rate limit di Postgres).

`next.config.ts` — sajikan landing statis di `/` tanpa flash:

```ts
const nextConfig: NextConfig = {
  experimental: {},
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/landing.html' }], afterFiles: [], fallback: [] }
  },
}
```

---

## 3. Struktur folder final

```
app/
  layout.tsx                 # metadata + OG + viewport (userScalable:false) + <ClientMonitor/>
  globals.css                # @import "tailwindcss" + CSS vars + animasi + .btn-teal + .av-*
  page.tsx                   # fallback (landing sesungguhnya di public/landing.html via rewrite)
  error.tsx  not-found.tsx  sitemap.ts
  privacy/page.tsx  terms/page.tsx
  simulator/page.tsx         # ORCHESTRATOR stage: login → profile → hub → sim → wishlist
  cv/page.tsx                # satelit: AI CV scorer (akuisisi)
  admin/page.tsx             # dashboard founder (gated ADMIN_EMAILS)
  api/
    chat/route.ts            # NPC chat (maxDuration 30)
    review/route.ts          # review task (maxDuration 30)
    progress/route.ts        # GET/POST progress (multi-role)
    profile/route.ts         # CRUD profil
    reset/route.ts           # reset run
    waitlist/route.ts        # GET {submitted} + POST
    stats/route.ts           # kehadiran sosial
    track/route.ts           # event first-party
    tasks/route.ts           # daftar task season (gate premium)
    task-file/route.ts       # stream file premium dari bucket privat
    lessons/route.ts
    lessons/progress/route.ts
    lessons/submit/route.ts
    cv-extract/route.ts  cv-review/route.ts
    admin/stats/route.ts
components/
  SimulatorApp.tsx           # ~2700 baris, jantung produk
  JobListing.tsx             # hub karir multi-role + modal detail + pemilih jenjang
  ProfileSetup.tsx           # wizard 5 langkah
  ProfileTab.tsx             # panel CV di sidebar
  LoginPage.tsx  WishlistForm.tsx  GuidedTour.tsx
  ReferenceLetter.tsx        # surat referensi live
  SqlEditor.tsx              # Database Vantara (sql.js WASM)
  ClientMonitor.tsx          # window.onerror → event client_error
  academy/{AcademyPanel,LessonView,MarkdownLite,YouTubeEmbed}.tsx
lib/
  ai.ts                      # multi-provider + key rotation + cleanResponse
  prompts.ts                 # SEMUA system prompt NPC + STYLE_RULES
  positions.ts               # 6 posisi, NPC, level, salary range
  reviewTask.ts              # engine review (skor internal)
  performance.ts             # grade/work style/conditional dari chat_history
  serverAuth.ts              # verifikasi JWT (jose) + service client
  rateLimit.ts  entitlements.ts  track.ts  supabase.ts
  profile.ts  skills.ts  lessons.ts  sqlCompare.ts  cvPrompt.ts
content/
  lessons/<position>/*.md    # materi Academy (frontmatter)
  lessons/modules.json       # definisi modul
  tasks/<slug>.md            # task season (frontmatter + brief)
  task-files/*.xlsx          # file task premium (JANGAN di public/)
scripts/
  generate-universe.ts  seed-lessons.ts  seed-tasks.ts  validate-lessons.ts
supabase-migrations/*.sql
public/
  landing.html  og-image.png  robots.txt  favicon.svg
  tasks/task_<position>.xlsx # file task DAY-1 saja (gratis)
  data/vantara.db  data/csv/*.csv  sql-wasm.wasm
tests/*.test.ts              # vitest: ai-clean, performance, positions, sqlCompare
```

---

## 4. Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-side saja, JANGAN pernah ke client
SUPABASE_JWT_SECRET=...              # opsional; mengaktifkan verifikasi JWT lokal HS256 (tercepat)

# AI — Gemini primary (berbayar), rotasi key
GEMINI_API_KEY_1=...                 # _2 s/d _5 opsional
GEMINI_MODEL=gemini-2.5-flash        # ganti model = ganti env, bukan ganti kode
GROQ_API_KEY_1=...                   # _2 s/d _5 opsional
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=...               # last resort, model :free

# Tuning
KANTORAN_PASS_SCORE=70               # ambang lulus review task (1-100)
ADMIN_EMAILS=founder@example.com     # comma separated; kosong = /admin tolak semua
NEXT_PUBLIC_APP_URL=https://kantoran.vercel.app
```

---

## 5. Skema database lengkap (SQL siap jalan)

Supabase Postgres. Jalankan berurutan di SQL Editor. **RLS aktif di semua tabel**; server memakai service role.

```sql
-- ══ 001: progress inti ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  first_name TEXT, email TEXT,
  background TEXT, bg_role TEXT, position TEXT NOT NULL DEFAULT '',
  level TEXT,
  step INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  tasks_done INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  sim_day INT DEFAULT 1,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  chat_history JSONB DEFAULT '{}',     -- { room: Message[] } — sumber kebenaran cerita
  task_submissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_progress_user_position_key UNIQUE (user_id, position)  -- MULTI-ROLE
);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON user_progress FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Profil user (CV yang dipakai sebagai konteks cerita)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  full_name TEXT, gender TEXT, city TEXT,
  education JSONB DEFAULT '[]', experience JSONB DEFAULT '[]',
  skills TEXT[] DEFAULT '{}',
  category TEXT,                        -- student|fresh_grad|jobseeker|career_switch
  avatar_url TEXT, linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT, email TEXT NOT NULL, name TEXT,
  rating INTEGER, feedback TEXT, wishlist TEXT[], position_tried TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable service role waitlist" ON waitlist FOR ALL TO service_role USING (true);

-- ══ 002: rate limit atomic (WAJIB — serverless tak boleh andalkan memori) ══
CREATE TABLE IF NOT EXISTS api_usage (
  user_id TEXT NOT NULL, bucket TEXT NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE, count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, day)
);
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION bump_usage(uid TEXT, b TEXT, max_count INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE c INT;
BEGIN
  INSERT INTO api_usage (user_id, bucket, day, count) VALUES (uid, b, CURRENT_DATE, 1)
  ON CONFLICT (user_id, bucket, day) DO UPDATE SET count = api_usage.count + 1
  RETURNING count INTO c;
  RETURN c <= max_count;   -- TRUE = masih boleh
END $$;

-- ══ 003: Academy ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lesson_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id TEXT NOT NULL,                 -- 'data_analyst' | ... | 'all'
  slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('tools','business')),
  day INT NOT NULL DEFAULT 1,                -- 1 = gratis, >=2 = teaser terkunci
  sort_order INT NOT NULL DEFAULT 0,
  npc_id TEXT NOT NULL DEFAULT 'sup',
  story_intro TEXT, teaser TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES lesson_modules(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','video','mission')),
  sort_order INT NOT NULL DEFAULT 0,
  content_md TEXT,
  youtube_video_id TEXT,                     -- nullable; diisi manual di Studio, seed TIDAK menimpanya
  mission JSONB,                             -- { brief, rubric:{mustFind[],goodToMention[]} }
  xp INT NOT NULL DEFAULT 10,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  score INT, attempts INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_modules_pos ON lesson_modules(position_id, day, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lp_lesson ON lesson_progress(lesson_id);
ALTER TABLE lesson_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published modules" ON lesson_modules FOR SELECT USING (is_published);
CREATE POLICY "public read published lessons" ON lessons FOR SELECT USING (is_published);
CREATE POLICY "own lesson progress" ON lesson_progress FOR ALL USING (auth.uid()::text = user_id);

-- ══ 005: observability first-party ══════════════════════════════
CREATE TABLE IF NOT EXISTS events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT, type TEXT NOT NULL, meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_time ON events (created_at DESC);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service events" ON events FOR ALL TO service_role USING (true);

-- ══ 006: task season + monetisasi ═══════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, position_id TEXT NOT NULL,
  day INT NOT NULL, sort_order INT DEFAULT 1,
  title TEXT NOT NULL,
  teaser TEXT,                    -- satu-satunya field cerita yang boleh bocor saat terkunci
  brief TEXT NOT NULL,            -- suara supervisor
  context TEXT, cross_ref TEXT,   -- cross_ref = kaitan ke divisi lain (interkoneksi)
  task_type TEXT NOT NULL DEFAULT 'file',  -- file | text | sql | chat
  file_name TEXT,
  rubric JSONB NOT NULL DEFAULT '{}',       -- { intern:{must_find[],good_to_mention[]}, junior:{}, mid:{} }
  approved_reaction TEXT, revision_reaction TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_pos_day ON tasks (position_id, day, sort_order);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service tasks" ON tasks FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, product TEXT NOT NULL DEFAULT 'season_1',
  starts_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ,  -- NULL = selamanya
  source TEXT,                                                   -- 'xendit:<id>' | 'presale-manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements (user_id, expires_at);
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service entitlements" ON entitlements FOR ALL TO service_role USING (true);

-- Bucket PRIVAT untuk file task premium
INSERT INTO storage.buckets (id, name, public) VALUES ('task-files', 'task-files', false)
ON CONFLICT (id) DO NOTHING;
```

**Aturan keras:** `rubric` (tasks) dan `mission.rubric` (lessons) **TIDAK PERNAH** dikirim ke client dalam kondisi apa pun. Penilaian selalu server-side.

---

## 6. Domain model: posisi, NPC, level, gaji

### 6.1 Level jenjang (3 saja)

```ts
export type LevelType = 'intern' | 'junior' | 'mid'

export const LEVEL_LABEL = { intern: 'Intern', junior: 'Junior', mid: 'Mid-Level' }

export const LEVELS = [
  { id: 'intern', label: 'Intern',    desc: 'Magang untuk mahasiswa dan pemula' },
  { id: 'junior', label: 'Junior',    desc: 'Entry-level dengan tanggung jawab penuh' },
  { id: 'mid',    label: 'Mid-Level', desc: 'Berpengalaman, ekspektasi lebih tinggi' },
]

// Background profil hanya jadi PRE-SELECT, bukan kunci. User bebas pilih jenjang.
export const LEVEL_FOR_BG = {
  student: 'intern', fresh_grad: 'intern', jobseeker: 'junior', career_switch: 'mid',
}

// WAJIB: menerima nilai lama supaya run lama tidak rusak
export function normalizeLevel(v?: string | null): LevelType {
  if (v && v in LEVEL_LABEL) return v as LevelType
  if (v === 'intern_magang') return 'intern'        // level lama yang sudah dilebur
  if (v && LEVEL_FOR_BG[v]) return LEVEL_FOR_BG[v]  // key background era pra-level
  return 'intern'
}
```

### 6.2 Salary range (per level, bukan per background)

```ts
export const SALARY_RANGE: Record<LevelType, { min: number; offer: number; max: number }> = {
  intern: { min: 1_800_000, offer: 2_500_000, max: 3_000_000 },
  junior: { min: 4_000_000, offer: 4_500_000, max: 5_200_000 },
  mid:    { min: 6_500_000, offer: 7_000_000, max: 8_000_000 },
}
export const getSalaryRange = (lv?: string|null) => SALARY_RANGE[normalizeLevel(lv)]
```

Di **prompt Sinta** (Bagian 9) range yang dipakai sedikit berbeda dan itu disengaja (ruang nego):
`intern 1.8–3 (ideal 2.5)`, `junior 4–6 (ideal 4.5)`, `mid 6–9 (ideal 7)`. **Stretch = max × 1.2** — boleh disepakati bila justifikasi kuat.

### 6.3 Interface Position

```ts
interface NPC {
  id: 'sup'|'mgr'|'jnr'; initials: string; avClass: string
  name: string; role: string; status: string; statusDot: string
  bio: string      // 3-6 kalimat: umur, riwayat, KEGAGALAN NYATA, hobi, cara bicara
}

interface Position {
  title: string; dept: string; icon: string
  getRole: (level: string) => string          // mis. "Junior Data Analyst"
  reqs: string[]                              // dipakai Sinta untuk screening kompetensi
  itx: string                                 // ringkasan tanggung jawab (dipakai orientasi)
  taskFile: string                            // nama file day-1 di public/tasks/
  supervisor: NPC; manager: NPC; junior: NPC
  taskRubric: { mustFind: string[]; goodToMention: string[] }   // day-1 hardcoded
  taskTitle: string; taskBody: string; taskContext: string
  teachBack: string                           // pertanyaan junior setelah task approved (protégé effect)
  upcomingTasks: { day: number; title: string; teaser: string }[]  // teaser premium
}
```

### 6.4 Roster NPC lengkap (6 posisi)

| Posisi (key) | Dept | Ikon | Supervisor | Manager | Junior |
|---|---|---|---|---|---|
| `data_analyst` | Data & Analytics | 📊 | Rizky Pratama (RP) | Diana Kusuma (DK) | Galih Ananta (GA) |
| `marketing_analyst` | Marketing & Brand | 📣 | Dinda Pratiwi (DP) | Budi Kurniawan (BK) | Aldi Lesmana (AL) |
| `finance_analyst` | Finance & Accounting | 💰 | Andi Wijaya (AW) | Pak Hendra (PH) | Nisa Safitri (NS) |
| `hr_generalist` | Human Resources | 👥 | Bu Ratna (BR) | Pak Tono (TS) | Lili Cahyani (LL) |
| `bizdev` | Komersial & Strategi | 🚀 | Reza Firmansyah (RF) | Pak Anton (PA) | Mira Rahayu (MR) |
| `admin_ops` | Operations & Sales Support | 🗂️ | Mbak Sari Wulandari (SW) | Pak Darmawan (DW) | Fajar Ramadhan (FR) |

**Sinta Maharani (SM)** — HR Business Partner, sama di semua posisi. Avatar class `av-teal`.
Konvensi avatar: `sup=av-blue`, `mgr=av-purple`, `jnr=av-amber`.

**Cara menulis bio NPC (KRITIS untuk keaslian).** Contoh Rizky Pratama:

> Pria 29 tahun. Lulusan Statistika ITS, 5 tahun di Vantara sejak fresh grad. Kerjaan pertama dan satu-satunya.
> Pengalaman nyata: pernah stuck 3 hari debug pipeline karena satu spasi tersembunyi di CSV. Pernah kena marah Director karena dashboard crash pas presentasi ke client. Punya ritual kopi sebelum coding, tidak mau diganggu sampai kopi habis. Suka chess online, main sela-sela nunggu query panjang jalan.
> Cara bicara: sangat singkat untuk non-teknikal. Demanding tapi fair. Kalau bagus, dia acknowledge. Kalau salah, langsung bilang.

Polanya: **umur + jalur karir → satu kegagalan spesifik yang masih diingat → kebiasaan/hobi remeh → instruksi cara bicara.** Kegagalan spesifik adalah bahan bakar utama; tanpa itu NPC terdengar seperti brosur.

### 6.5 Contoh rubrik day-1 (harus sekonkret ini)

```ts
// data_analyst — "Cek Kualitas Data Penjualan Lumière Jan 2026"
taskRubric: {
  mustFind: [
    'format tanggal tidak konsisten',
    'region null atau kosong',
    'revenue Rp 0 dengan qty lebih dari 0',
    'duplikat order_id',
    'SKU tidak konsisten atau lowercase',
  ],
  goodToMention: [
    'dampak ke total revenue atau laporan',
    'jumlah baris bermasalah',
    'rekomendasi tindak lanjut spesifik',
  ],
}
```

Task day-1 tiap posisi:

| Posisi | Judul task day-1 | Inti yang harus ditemukan |
|---|---|---|
| data_analyst | Cek Kualitas Data Penjualan Lumière Jan 2026 | 5 jenis data kotor |
| marketing_analyst | Analisis Performa Campaign Lumière Q4 2025 | TikTok conversion rendah, Google Ads terbaik, data campaign tidak lengkap |
| finance_analyst | Review Budget Variance Q4 2025 | Marketing overspend terbesar, Sales & IT Digital juga overspend, total overspending |
| hr_generalist | CV Screening Junior Data Analyst Batch 1 | Eko gugur (SMA), Maya terkuat, Rina kedua |
| bizdev | Evaluasi Peluang Partnership Distributor Regional | UD Berkah Jaya ditolak (3x dispute), PT Maju Bersama teratas, PT Andalan (coverage Papua) |
| admin_ops | Rekap & Validasi Invoice Distributor Semester 1 2026 | invoice dobel, tunggakan UD Berkah Jaya, invoice tanpa jatuh tempo |

Perhatikan: **UD Berkah Jaya muncul di 3 posisi berbeda.** Itu bukan kebetulan — lihat Bagian 18 (anomali ditanam di data).

---

## 7. Lapisan AI (multi-provider + fallback)

`lib/ai.ts`. Urutan: **Gemini (berbayar, primary) → Groq → OpenRouter (:free)**.

```ts
export interface AIOptions {
  maxTokens?: number     // default 250
  temperature?: number   // default 0.85; otomatis 0.3 saat json
  json?: boolean         // structured output; mematikan cleanResponse
  clean?: boolean        // default true
  deadlineMs?: number    // budget TOTAL semua provider, default 25000
}
export interface AIResult { text: string; provider: 'gemini'|'groq'|'openrouter' }

export async function callAI(messages, systemPrompt, opts): Promise<AIResult | null>
```

Aturan implementasi yang wajib dipatuhi:

1. **Rotasi key round-robin** untuk `GEMINI_API_KEY_1..5` dan `GROQ_API_KEY_1..5`. Key yang gagal masuk cooldown **60 detik** (`Map<key, timestamp>`).
2. **Timeout per provider:** Gemini 12s, Groq 8s, OpenRouter 8s (`AbortSignal.timeout`).
3. **Deadline budget 25s total** — sebelum mencoba provider berikutnya, cek `deadline - Date.now() >= timeoutProvider`. Ini mencegah rantai fallback menembus `maxDuration = 30` serverless.
4. Percobaan: Gemini maks 2 attempt, Groq maks 2 attempt, OpenRouter 1 attempt.
5. **Gemini spesifik:**
   - endpoint `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
   - key di **header** `x-goog-api-key` (JANGAN di query string — bocor lewat log/proxy)
   - `systemInstruction: { parts: [{ text: systemPrompt }] }`
   - role mapping: `assistant → model`, sisanya `user`
   - **`thinkingConfig: { thinkingBudget: 0 }`** — WAJIB. Tanpa ini 2.5-flash membakar token output untuk reasoning dan balasan jadi kosong.
   - `safetySettings` keempat kategori di `BLOCK_ONLY_HIGH` (roleplay kantor kadang kena filter default)
   - `json: true` → `responseMimeType: 'application/json'`
6. **Groq/OpenRouter:** format OpenAI, `json: true` → `response_format: { type: 'json_object' }`. OpenRouter pakai model konkret + rantai `models[]`: `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-chat-v3-0324:free`, `qwen/qwen3-235b-a22b:free`. (`openrouter/free` bukan model ID valid.)
7. **Return `null` bila semua gagal.** Route pemanggil yang memutuskan pesan error — jangan pernah mengarang balasan NPC.

### 7.1 `cleanResponse` (anti-jejak AI) — KRITIS

Dijalankan pada semua output non-JSON, dan pada field `feedback` hasil JSON.

```ts
export function cleanResponse(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')       // bullet di awal baris
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    // dash sebagai tanda baca dibuang, kata majemuk (sehari-hari) TIDAK boleh tersentuh
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s*,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/[ \t]+([.!?,])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
```

Uji wajib (`tests/ai-clean.test.ts`): `"kerja sehari-hari"` harus tetap utuh; `"ini - itu"` menjadi `"ini, itu"`.

---

## 8. Prompt engineering: aturan anti AI-slop (KRITIS)

Blok ini **di-append ke SETIAP system prompt NPC**. Ini pembeda utama produk. Salin apa adanya.

```
CARA BICARA YANG WAJIB — BACA BAIK-BAIK:
Kamu manusia yang lagi ngobrol lewat chat kantor, bukan chatbot. Tulis seperti orang Indonesia beneran ngetik di Slack/WhatsApp.

YANG WAJIB:
- Bahasa Indonesia natural, santai-profesional sesuai karakter. Boleh pakai "aku/kamu" atau "saya" sesuai persona.
- Pendek. Biasanya 1-3 kalimat. Kadang cukup satu baris. Jangan kirim paragraf panjang.
- Variasikan panjang kalimat. Boleh ada kalimat pendek banget. Lalu satu yang agak panjang. Biar terasa manusia.
- Sesekali pakai partikel khas chat orang Indonesia: "sih", "kok", "ya", "deh", "nih", "loh", "hmm", "oh", "eh" — secukupnya, jangan tiap kalimat.
- Reaksi dulu baru isi. Kalau user cerita sesuatu, tanggapi isinya ("oh menarik", "wah", "oke noted") sebelum lanjut.
- Kalau tidak tahu atau ragu, akui jujur sesuai karakter. Manusia nggak selalu tahu segalanya.

YANG DILARANG KERAS (INI BIKIN KETAHUAN ROBOT):
- JANGAN pakai markdown apa pun: tidak ada **tebal**, *miring*, #judul, bullet (- atau •), atau penomoran 1. 2. 3.
- JANGAN pernah pakai tanda hubung panjang (— atau –) atau tanda hubung yang dipakai sebagai jeda kalimat. Pakai koma atau titik biasa. Tanda hubung hanya boleh di kata majemuk seperti "sehari-hari".
- JANGAN buka dengan basa-basi robot: "Tentu!", "Baik,", "Sebagai HR...", "Dengan senang hati". Langsung ngomong.
- JANGAN tutup dengan kalimat asisten: "Ada lagi yang bisa saya bantu?", "Semoga membantu!", "Jangan ragu untuk bertanya".
- JANGAN mengulang atau memparafrase pertanyaan user sebelum menjawab.
- JANGAN menjelaskan struktur jawabanmu ("Pertama...", "Berikutnya...", "Kesimpulannya...").
- JANGAN merangkum ulang hal yang baru saja kamu katakan.
- JANGAN pernah menyebut dirimu AI, model, asisten, atau sistem. Kamu manusia dengan nama dan kursi di kantor ini.
- JANGAN sok antusias berlebihan atau memuji user secara berlebihan tiap balasan.

Kalau ragu antara terdengar sopan-formal atau terdengar manusia — pilih manusia.
```

---

## 9. Prompt tiap NPC (spesifikasi lengkap)

Semua di `lib/prompts.ts`, semua menerima `UserContext`:

```ts
interface UserContext {
  firstName: string; email: string
  background: string; bgRole: string; position: string
  level?: string; experience?: string; motivation?: string; step?: number
}
```

### 9.1 `getSintaPrompt(user, positionReqs?)` — HR, paling kompleks

Struktur prompt (urut):

1. **Identitas:** "Kamu Sinta Maharani, HR Business Partner PT Vantara Nusantara. Kamu manusia, bukan AI." Perempuan 34 tahun, Psikologi UI, 10 tahun di HR, menikah anak 1, hobi berkebun, suka kopi tubruk, tidak suka rapat molor.
2. **Pengalaman yang bisa diceritakan:** pernah reject kandidat yang dia sukai personal karena skill tidak match; pernah burnout karena terlalu empati; sekarang lebih bisa set boundaries.
3. **Standar gaji internal (RAHASIA):** range normal `min–max`, angka ideal, dan **batas stretch = max × 1.2** "hanya untuk kandidat dengan justifikasi kuat".
4. **Cara menegosiasikan gaji** (lihat 9.1.1).
5. **Urutan interview 11 tahap** (lihat 9.1.2).
6. **Penanda hasil interview** — token (lihat 9.1.3).
7. **Kompetensi yang harus dieksplorasi** — diisi dari `POSITIONS[x].reqs`.
8. **Aturan durasi:** minimal 8–10 tanya-jawab substantif sebelum bahas gaji. Satu pertanyaan per balasan.
9. **Aturan pindah tahap:** peta, bukan checklist. Sebelum pindah tahap, jawaban terakhir kandidat WAJIB ditanggapi/digali minimal sekali. Kalau ragu ada di tahap mana, lihat pesan terakhir sendiri.
10. **Kalau kandidat balik bertanya** (lihat 9.1.4).
11. **Yang tidak boleh:** kasih angka duluan, setuju tanpa evaluasi, bahas teknikal mendalam (itu urusan supervisor), mengaku AI, tanya gaji di exchange 1–2.
12. **Data kandidat** (nama, background, posisi, pengalaman, motivasi) + **ciri khas ngetik** + **profil perusahaan** + `STYLE_RULES`.

#### 9.1.1 Aturan nego gaji

```
Tanya ekspektasi kandidat dulu — JANGAN pernah kasih angka duluan.
Yang kamu nilai bukan angkanya saja, tapi ALASANNYA. Kalau kandidat menyebut angka tanpa alasan,
pancing dulu: "boleh tahu dasar angka itu dari mana?"

MASUK range        → sambut natural, SEBUT angka eksplisit ("oke, X juta ya, nanti tercantum di offering letter").
DI BAWAH range     → jangan diam-diam untung. Bilang jujur ekspektasinya di bawah yang disiapkan,
                     tawarkan angka dalam range. Ini momen kamu terlihat fair.
DI ATAS max s.d. stretch (max×1.2):
   alasan KUAT & SPESIFIK  → bilang perlu cek ke atasan, lalu DI BALASAN YANG SAMA kembali dengan
                             keputusan. Kalau setuju, SEBUT angka final eksplisit.
   alasan GENERIK          → tahan dengan empati di batas max, jelaskan kenapa justifikasi yang dihargai.
DI ATAS stretch    → jujur: di luar yang bisa diperjuangkan. Sebut batas realistis, tanya masih mau lanjut?

ATURAN EMAS: jangan pernah setuju tanpa evaluasi, jangan pernah menolak tanpa mendengar alasan.
Tunjangan (makan/transport) TIDAK bisa dinegosiasikan — paket tetap.
Setiap kesepakatan tercapai, angka final WAJIB disebut eksplisit.
```

> **Kenapa "sebut angka eksplisit" wajib:** offering letter mengekstraksi angka dari teks Sinta (Bagian 10, step 2). Kalau Sinta tidak pernah menyebut angka, offering letter jatuh ke default.

#### 9.1.2 Urutan interview (11 tahap)

1. Basa-basi ringan · 2. Perkenalan diri · 3. Gali pendidikan/pengalaman · 4. Pertanyaan pengalaman mendalam (min 2-3, minta contoh konkret) · 5. Pertanyaan perilaku/situasional (min 2) · 6. Screening kompetensi posisi (min 2, dari `reqs`) · 7. Kekuatan & kelemahan · 8. Motivasi spesifik (kenapa Vantara) · 9. Rencana/ekspektasi + kesempatan bertanya · 10. Ekspektasi gaji + evaluasi · 11. Langkah selanjutnya + tutup hangat.

#### 9.1.3 Token hasil interview (3 tingkat)

Di pesan penutup (tahap 11), Sinta menutup dengan **tepat satu token**. Token ini di-strip server sebelum sampai ke user.

| Token | Arti | Konsekuensi di produk |
|---|---|---|
| `[SELESAI]` | Layak, nego tuntas | Alur normal |
| `[SELESAI_CATATAN]` | Diterima **bersyarat** — jawaban dangkal / motivasi lemah | Offer default = batas bawah range; sambutan supervisor lebih dingin; baris surat referensi "dengan catatan"; ada **redemption arc** bila task pertama Exceeds |
| `[TOLAK]` | Hanya untuk kandidat jelas tidak serius | Bukan pintu keluar: muncul kartu Academy "Cara Menjawab Interview" + tombol "Ulangi Interview" |

Aturan keputusan yang harus ada di prompt: *ragu antara TOLAK dan SELESAI_CATATAN → pilih SELESAI_CATATAN; ragu antara SELESAI_CATATAN dan SELESAI → pilih SELESAI.* Saat menolak: sebut **dua alasan spesifik + satu saran konkret**, tutup dengan membuka pintu, jangan bahas gaji.

#### 9.1.4 Kalau kandidat balik bertanya (bikin terasa manusia)

```
Kamu yang memimpin interview. JANGAN langsung nurut menjawab tuntas seperti asisten.
- Pertanyaan wajar (tim, budaya, kantor): jawab SINGKAT 1-2 kalimat, boleh selipkan pengalaman pribadi,
  lalu kembalikan kendali: "Eh tapi balik ke kamu dulu ya, tadi kamu sempat cerita soal..."
- Pertanyaan yang belum waktunya (gaji sebelum tahapnya, teknis harian): tunda halus.
- Kalau terasa memancing kamu banyak bicara: sadari, kasih boundary ringan sambil santai.
```

### 9.2 `getSupPrompt(user, supName, supBio, taskFile?, taskTitle?)`

Isi: identitas + bio + siapa yang diajak bicara + cara bicara (singkat untuk non-teknikal, panjang & antusias untuk teknis, **tidak pernah bilang "semangat ya"**, feedback selalu spesifik) + standar sebagai supervisor (tidak micromanage, tapi tidak membiarkan kesalahan; kalau ditanya hal yang seharusnya dicari sendiri → arahkan cara berpikir, bukan jawaban).

**Bagian TOOLS yang kondisional pada `step` (KRITIS):**

```
step >= 5 : "Task sudah diberikan. Tools yang tersedia: File Manager (sidebar kiri, file <taskFile>),
             Workspace (upload hasil), chat ini. Task aktif: <taskTitle>.
             Kalau user tanya file/task, arahkan ke File Manager."
step <  5 : "<Nama> belum sampai tahap task. JANGAN sebut File Manager, task file, atau apa pun
             tentang file/dokumen kerja — belum waktunya. Fokus ke orientasi dan pengenalan tim."
```

**Larangan keras:** menyebut "email yang aku kirim kemarin", "link yang aku share", "file di Slack", "dashboard di sistem lain" — resource yang tidak ada dalam simulasi. Halusinasi lokasi = user tersesat.

### 9.3 `getMgrPrompt(user, mgrName, mgrBio, mgrRole)`

Profesional & berwibawa tapi tidak kaku, bicara gambaran besar dulu, jarang muncul karena sibuk, kasih guidance karir bila diminta, tidak micromanage task harian.

### 9.4 `getJnrPrompt(user, jnrName, jnrBio)`

Sangat casual ("sih", "dong", "deh", "btw", "wkwk", "bro"), jujur soal struggle, sering pakai disclaimer ("gatau bener apa nggak tapi menurutku..."), boleh gosip kantor ringan, kalau tidak yakin teknis → arahkan ke supervisor.

**Blok teach-back (protégé effect) — wajib ada:**

```
KALAU KAMU BARU MINTA DIAJARI SESUATU:
Kalau dia menjelaskan, dengarkan sungguhan: tanggapi ISI penjelasannya, tanya satu hal yang belum jelas
("terus kalau kasusnya gini gimana?"), dan kalau penjelasannya bagus bilang jujur kalau kebantu.
Kalau penjelasannya ngawur atau muter-muter, bilang jujur dengan santai kamu masih bingung.
Jangan pura-pura paham.
```

### 9.5 `getTaskReviewPromptJSON(...)` — lihat Bagian 14.

---

## 10. State machine simulator (step 0-10 + 97/98/99)

`components/SimulatorApp.tsx`. State disimpan di satu objek:

```ts
interface SimState {
  firstName, email, background, bgRole, level, position, experience, motivation: string
  step: number          // 0..10
  coins, tasksDone, streak, phaseUnlocked: number   // phaseUnlocked 1 = pasca kontrak
  salaryExpected, salaryOffered: number
  chatHistory: Record<string, Message[]>            // key = room id
  unreadCounts: Record<string, number>
  interviewDone: boolean
  simDay: number        // 1 = alur scripted; 2+ dari pipeline /api/tasks
}
```

### 10.1 Alur step

| Step | Peristiwa | Trigger maju |
|---|---|---|
| **0** | Auto-start dari job listing: email undangan masuk `inbox`, Sinta menyapa di `hr_office`. **Landing langsung di `hr_office`** (bukan inbox) — mengurangi friksi apply→interview. Notifikasi 800ms kemudian. | user membalas Sinta |
| **1** | Interview + nego gaji berjalan di `hr_office` | token `[SELESAI]`/`[SELESAI_CATATAN]` dari server, atau tombol "Interview selesai" di header |
| **2** | **Offering letter** dibuat: ekstraksi angka gaji (10.2), kartu email masuk `inbox` **langsung lewat `setState`** (bukan `addMsg`), pindah view ke `inbox` | user klik "Tanda tangan" |
| **3** | Kontrak. `phaseUnlocked = 1` (semua room tim terbuka). Slack: sistem "Kamu ditambahkan ke #<dept>" → Sinta memperkenalkan → **supervisor menyambut (dingin bila conditional)** → junior menyapa. 9 detik kemudian: notifikasi surat referensi mulai disusun. | user membuka `sup_chat` setelah supervisor DM |
| **4** | **Orientasi:** perusahaan → posisi & tanggung jawab → kartu SOP tim → "aku assign training module di Academy, **nggak wajib sekarang**" → kartu format standup → ajakan standup | user membalas ≥1 pesan di `sup_chat` (delay 6s), **atau** fallback diam 120 detik |
| **5** | **Task brief** turun di `sup_chat` (kartu `task`) + kartu file di `file_manager`. Khusus `data_analyst`: 5 detik kemudian supervisor memberi akses **Database Vantara** + latihan SQL | user klik "Buka File Manager" |
| **6** | Dilema gaya kerja: 3 detik junior memberi tips, 8 detik junior melempar **pilihan `choice`** (integritas vs aman) | user upload & submit |
| **7-8** | Workspace: upload `.xlsx` → parse client-side (exceljs, 50 baris/sheet) → submit ke `/api/review` | APPROVED |
| **9** | APPROVED: +30 coin, `tasksDone++`, `step = 10`, pengalaman simulasi ditulis ke profil (`id: 'kantoran-sim'`) | otomatis |
| **10** | Penutup hari: junior memberi selamat → 12 detik kemudian **teach-back** → supervisor "sudah jam 5" + **pertanyaan refleksi** → kartu `day_done` → manager DM (hari-1) | tombol di kartu `day_done` |

**Step khusus:**

- **97 — lanjut hari berikutnya.** Ambil `seasonTasks[tasksDone - 1]`; jika ada & tidak terkunci: naikkan `simDay`, bersihkan workspace, pindah ke `sup_chat`, supervisor menyapa pagi, `deliverTask(next, tasksDone+1)`.
- **98 — ulangi interview.** Reset **hanya** `chatHistory.hr_office` ke satu sapaan baru Sinta ("Aku menghargai kamu mau balik dan coba lagi, itu poin plus buatku..."), `interviewDone = false`. Progress lain tidak tersentuh.
- **99 — gate premium.** `saveProgress()` lalu `onWishlist(coins, tasksDone, buildRecap())`.

### 10.2 Ekstraksi gaji untuk offering letter (KRITIS)

Urutan prioritas — angka yang keluar dari **mulut Sinta** lebih sah daripada klaim user.

```ts
const extractJuta = (t: string) => {            // "4,5 juta" / "4.5 juta" / "5 juta"
  const m = t.match(/(\d+[.,]?\d*)\s*juta/)
  if (!m) return null
  const val = Math.round(parseFloat(m[1].replace(',', '.')) * 1_000_000)
  return (val >= 1_000_000 && val <= 15_000_000) ? val : null
}

// default: conditional ? range.min : range.offer
// P1 — pesan Sinta yang mengandung kata konfirmasi:
//      ['masuk','bisa diakomodir','sesuai budget','acceptable','oke','deal','bisa kami',
//       'akan kami cantumkan','offering letter','bisa diterima','kita setuju','sepakat','tercantum']
// P2 — pesan Sinta yang menyebut batas: ['maksimal','maksimum','paling tinggi','sampai','bisa kami berikan']
// P3 — pesan USER, HANYA bila angkanya di dalam [min, max] normal
// Iterasi dari pesan TERBARU ke terlama; berhenti di temuan pertama.

const finalSalary = clamp(agreed, range.min, Math.round(range.max * 1.2))  // stretch +20%
```

Offering letter juga memuat: tunjangan makan Rp 600.000, transport Rp 400.000, probation "3 bulan dengan evaluasi", sistem kerja "Hybrid, WFO 3x/minggu".

### 10.3 Deteksi interview selesai (guardrail berlapis)

```ts
const salaryDiscussed = hrMsgs.some(m => !m.isError && m.text && /gaji|juta|salary/i.test(m.text))
const userMsgCount    = hrMsgs.filter(m => m.role === 'user').length
const endsWithQuestion = reply.trim().endsWith('?')
const doneSignals = ['sampai jumpa di hari pertama','sampai ketemu di kantor','akan kami kirimkan offering',
  'offering letter akan','kami kirim offering','selamat bergabung','welcome to the team',
  'kami tutup interview','interview kita cukup sampai']

const isDone = salaryDiscussed && (
  serverSaysDone ||                                   // token [SELESAI] — jalur utama
  (userMsgCount >= 8 && !endsWithQuestion && doneSignals.some(s => reply.toLowerCase().includes(s)))
)
```

- `salaryDiscussed` adalah **gerbang mutlak**: interview tidak boleh selesai (bahkan dengan token) kalau gaji belum pernah dibahas. Kalau tidak, offering letter memakai angka default tanpa pernah dinegosiasikan.
- Tombol pintas "Interview selesai" di header **juga** melewati guard ini; kalau gaji belum dibahas, Sinta malah menyela: *"Eh sebentar, sebelum kita tutup ada satu hal penting yang belum dibahas: ekspektasi gaji kamu untuk posisi ini berapa?"*
- Fallback keyword sengaja sangat ketat karena frasa "kamu diterima" pernah **false-positive** pada pertanyaan pengandaian ("KALAU kamu diterima di sini, gimana...").
- `[TOLAK]` server-side hanya dihormati bila `userMsgCount >= 6`.

### 10.4 Persistensi

- **Auto-save tiap 30 detik** (interval dibuat sekali; state dibaca via `stateRef`), **plus** save langsung tiap `step` berubah.
- **Dirty check:** payload JSON dibandingkan dengan `lastSavedRef`; identik → tidak menulis sama sekali. `lastSavedRef` hanya diperbarui bila `res.ok` (save gagal harus dicoba lagi).
- **Server menolak progress mundur** → HTTP 409 `{ error: 'Stale progress', currentStep, currentDay }`. Ini melindungi dari tab lama yang menimpa run yang lebih maju.
- **`sessionStorage`** (per tab, bersih saat tab ditutup):
  - `kantoran_active_pos_<uid>` = `{position, level}` → refresh di tengah simulasi kembali ke simulasi, bukan ke hub.
  - `kantoran_last_view_<uid>_<position>` = room terakhir → refresh mendarat di room yang sama (divalidasi `isRoomAvailable`).
- **`localStorage`**: `kantoran_tour_v1_<uid>` → guided tour sekali seumur akun.
- **Kantor hidup:** saat load, jika `Date.now() - last_active > 8 jam` dan `3 <= step < 10` → 2,5 detik kemudian NPC mengirim pesan "selama kamu pergi" (supervisor bila `step >= 5`, junior bila belum).

---

## 11. Model pesan & tipe kartu chat

```ts
interface Message {
  id: string                    // `${Date.now()}-${Math.random()}`
  role: 'npc'|'user'|'system'|'email'|'task'|'feedback'|'action'|'learn'|'cliff'|'offering'|'choice'
  npcId?: 'sinta'|'sup'|'mgr'|'jnr'
  text?: string
  data?: Record<string, unknown>
  isError?: boolean             // banner gangguan koneksi — TIDAK PERNAH masuk history AI
}
```

| role | Render | `data` penting |
|---|---|---|
| `npc` / `user` | bubble chat (avatar + nama untuk NPC) | — |
| `system` | pill abu-abu di tengah | — |
| `email` | kartu email di Inbox | `from, subject, preview, body, isInvite/isOffering, salary, dept, ...` |
| `task` | kartu brief task | `num, title, deadline, dept, body, ctx` |
| `learn` | kartu hijau materi in-story | `icon, title, body` |
| `feedback` | kartu status review | `type: 'good'|'neutral'`, `label: 'TASK APPROVED'|'REVISION NEEDED'`, `text` |
| `action` | tombol CTA | `label, subLabel, nextStep, goTo, type` |
| `choice` | tombol pilihan dilema | `options: [{label, trait, reaction}]`, terisi `chosen`, `chosenTrait` |

**`action.type` yang bermakna:** `interview_done` (+`conditional: boolean`), `interview_rejected`, `day_done` (+`coins`, `tasksDone`).

**Aturan `addMsg(room, msg, silent?)`:** menambah pesan + menaikkan unread bila `silent !== true`.
**PENGECUALIAN KRITIS:** pesan kritis yang harus muncul bersamaan dengan perubahan state lain (email offering letter) **wajib** ditulis langsung lewat satu `setState`, bukan `addMsg` di dalam `setTimeout` — kalau tidak, race condition membuat email hilang.

**`buildHistory(room, npcId)`** untuk memori AI:
- lewati semua pesan dengan `isError`
- ambil `role === 'user'` sebagai `user`
- ambil `role === 'npc' && npcId === <npc>` sebagai `assistant`
- **potong 30 pesan terakhir**

---

## 12. Ruangan (rooms) & aturan kunci

| Room | Ikon | Label | Terkunci sampai |
|---|---|---|---|
| `inbox` | 📧 | Inbox | — |
| `hr_office` | 🤝 | HR Office | — |
| `slack` | 💬 | Slack | `phaseUnlocked < 1` (step 3) |
| `meeting` | 🪑 | Meeting | step 3 |
| `sup_chat` | 👤 | Supervisor | step 3 |
| `workspace` | 🖥️ | Workspace | step 3 |
| `academy` | 🎓 | Academy | step 4 **ATAU** ada kartu `interview_rejected` |
| `file_manager` | 📁 | File Manager | step 5 |
| `database` | 🗄️ | Database | step 5, **hanya `data_analyst`** |
| `reference` | 📜 | Surat Referensi | step 3 |
| `pantry` | ☕ | Pantry | step 3 |
| `mgr_chat`, `jnr` | — | (dari sidebar Tim) | step 3 |

Room yang menerima input chat: `hr_office`, `sup_chat`, `mgr_chat`, `pantry`, `slack`, `jnr`.

```ts
const ROOM_NPC = {
  hr_office: 'sinta', sup_chat: 'sup', mgr_chat: 'mgr',
  pantry: 'jnr', slack: 'jnr', jnr: 'jnr',
}
```

`isRoomAvailable(room, step)` dipakai saat memulihkan room terakhir setelah refresh — **jangan pernah mendaratkan user di room terkunci**.

---

## 13. Mekanik "career RPG" (turunan dari chat_history)

`lib/performance.ts`. **Semua diturunkan dari `chat_history` — sengaja tanpa kolom database baru.**

```ts
// Revisi = kartu feedback berlabel REVISION di sup_chat
countRevisions(history) = history['sup_chat'].filter(
  m => m.role === 'feedback' && String(m.data?.label).toUpperCase().includes('REVISION')
).length

computeGrade(rev) = rev === 0 ? 'exceeds' : rev === 1 ? 'meets' : 'needs_improvement'

GRADE_LABEL = { exceeds:'Exceeds Expectations', meets:'Meets Expectations',
                needs_improvement:'Needs Improvement' }

GRADE_REVIEW = {
  exceeds: 'Task pertama approved tanpa revisi. Itu jarang terjadi di hari pertama, dan supervisormu mencatatnya.',
  meets:   'Task selesai dengan satu revisi. Solid untuk hari pertama, ruang naiknya masih ada.',
  needs_improvement: 'Butuh beberapa revisi, tapi kamu menyelesaikannya. Yang dinilai bukan cuma hasil, tapi cara kamu bangkit setelah dikoreksi.',
}

WORK_STYLES = {
  integritas: { label:'Lurus dan berani',
    review:'Kamu memilih transparansi meski ada risikonya. Tim menilai kamu bisa dipercaya memegang data sensitif.',
    letterNote:'Menunjukkan integritas dalam menyampaikan temuan, termasuk temuan yang tidak populer.' },
  aman: { label:'Hati-hati dan diplomatis',
    review:'Kamu memilih jalan aman. Bagus untuk menjaga hubungan tim, tapi supervisor mencatat kamu perlu lebih berani menyuarakan temuan.',
    letterNote:'Bekerja dengan hati-hati dan menjaga keharmonisan tim.' },
}

getWorkStyle(history)      // cari message role 'choice' dengan data.chosenTrait di semua room
isConditionalOffer(history)// kartu 'interview_done' dengan data.conditional === true
```

**STAKES — supervisor makin dingin per revisi:**

```
revisi ke-1 & belum training  → tawarkan Academy (just-in-time, delay 3s):
   "Saranku: buka training module di Academy dulu, 10-15 menit aja. Materinya persis soal bagian
    yang tadi bolong. Abis itu baru revisi."  + kartu action "Buka Academy →"
revisi ke-2 (delay 2,5s) → "Ini revisi kedua, <nama>. Standar tim memang segini. Pelan sedikit
                            nggak apa-apa, yang penting teliti."
revisi ke-3+             → "Oke, gini aja. Fokus ke poin yang paling penting dulu, satu-satu.
                            Jangan submit sebelum kamu sendiri yakin."
```

### 13.1 Surat referensi live (`ReferenceLetter.tsx`)

Room `reference` terbuka begitu kontrak ditandatangani. Kertas surat berkop PT VANTARA NUSANTARA, nomor `VN/HR/<tahun>/…`.

Milestone (terisi progresif, yang belum tercapai ditampilkan pudar dengan teks *"Belum tercapai, lanjutkan simulasimu"*):

1. `step >= 2` — "Lulus proses seleksi dan interview HR" (bila conditional: *"…(dengan catatan evaluasi HR)"*)
2. `step >= 3` — "Menandatangani kontrak kerja sebagai `<bgRole>`"
3. `trainingDone` — "Menyelesaikan training onboarding tim `<dept>`"
4. `tasksDone > 0` — "Menyelesaikan task `<taskTitle>` dengan status APPROVED"

**Kutipan supervisor ikut grade** — dan ada redemption arc:

| Kondisi | Kutipan |
|---|---|
| conditional + exceeds | "`<nama>` masuk dengan catatan dari seleksi, dan menepisnya lewat hasil kerja di hari pertama. Saya yang tadinya ragu." |
| exceeds | "`<nama>` menyelesaikan task pertamanya tanpa revisi. Itu jarang terjadi di hari pertama." |
| meets | "`<nama>` menunjukkan hasil kerja yang solid dan responsif terhadap feedback." |
| needs_improvement | "`<nama>` membutuhkan beberapa revisi, tapi menunjukkan kemauan kuat untuk memperbaiki. Itu modal yang tidak semua orang punya." |

Di bawahnya: **"Baris berikutnya di suratmu"** — `upcomingTasks` day 2/3/5/7 dengan 🔒 (teaser premium), lalu blok tanda tangan pudar bertuliskan *"Ditandatangani resmi di akhir simulasi"*.

Penutup: *"Surat ini milikmu dan terus bertambah. Setiap task yang selesai menambah satu baris, dan kualitas kerjamu menentukan bunyinya."*

---

## 14. Sistem review task (skor internal)

`lib/reviewTask.ts` — dipakai `/api/review` **dan** `/api/lessons/submit` supaya suara feedback konsisten.

```ts
const PASS_SCORE = clamp(Number(process.env.KANTORAN_PASS_SCORE) || 70, 1, 100)

interface ReviewResult { review: string; isApproved: boolean; score: number /* INTERNAL */ }
```

**Jalur utama — JSON terstruktur** (`callAI(..., { maxTokens: 500, json: true, temperature: 0.4, deadlineMs: 15000 })`).

Prompt penilaian (bagian yang menentukan):

```
CARA KAMU MENILAI (skor internal, JANGAN pernah sebut angkanya):
Beri skor 0-100 berdasarkan berapa banyak poin standar wajib yang benar-benar dijawab dengan benar,
ditambah nilai plus kalau ada.
- 85-100: hampir semua poin wajib terpenuhi, sebagian ada nilai plus. Kerja bagus.
- 70-84 : sebagian besar poin wajib kena. Mungkin ada satu yang terlewat atau kurang dalam, tapi arah
          dan hasilnya sudah benar. CUKUP untuk karyawan baru di hari pertama.
- 50-69 : ada poin wajib PENTING yang terlewat atau salah. Belum bisa diterima.
- < 50  : banyak yang terlewat, atau arah kerjanya keliru.

BATAS LULUS ADA DI 70. Jangan menuntut kesempurnaan:
- Skor >= 70 → TERIMA, JANGAN minta revisi. Akui kerjanya diterima, lalu beri 1-2 catatan perbaikan
  sebagai bekal (bukan syarat): "oke, ini aku terima dulu ya. Bagus kamu udah nemu X. Buat next time,
  coba perhatikan Y juga."
- Skor < 70 → minta revisi, tapi tunjukkan HANYA 1-2 hal PALING penting. Jangan bikin dia kewalahan.
  Nada tegas tapi menyemangati, kasih arah cara memperbaikinya.

ATURAN OUTPUT: balas HANYA satu objek JSON valid:
{ "score": <0-100>, "feedback": "<pesan ke user>", "revisionNote": "<hal spesifik | null>" }

"feedback" harus terdengar seperti chat manusia di Slack: maksimal 6 kalimat, TANPA markdown, TANPA
bullet, TANPA tanda hubung panjang. Jangan sebut kata rubrik/kriteria/skor/angka. Jangan mulai dengan
salam. Jangan sebut kata APPROVED atau REVISION di dalam feedback.
```

**Pasca-proses server (sumber kebenaran ada di server, bukan model):**

```ts
extractJSON(text)                 // toleran terhadap pagar kode & teks nyasar: ambil {...} pertama..terakhir
score = clamp(round(parsed.score), 0, 100)
isApproved = score >= PASS_SCORE  // model TIDAK memutuskan lulus/tidak
review = cleanResponse(parsed.feedback)
if (!isApproved && revisionNote) review += ' ' + cleanResponse(revisionNote)   // hindari duplikasi
```

**Fallback** (kalau JSON gagal): prompt teks lama, model menutup dengan `Status: APPROVED` atau `Status: REVISION NEEDED: <hal>`; string di-strip sebelum ditampilkan.

**Skor tidak pernah dikirim ke client.** Ia dicatat ke `events` bertipe `task_scored` (`{position, slug, score, approved}`) untuk kalibrasi ambang di `/admin`.

---

## 15. Kontrak API (semua endpoint)

Semua endpoint (kecuali yang disebut lain) **wajib**: `Authorization: Bearer <supabase access_token>` → `getAuthUser(req)` → 401 bila gagal.

### `lib/serverAuth.ts` — verifikasi 3 lapis

1. **HS256 lokal** dengan `SUPABASE_JWT_SECRET` (tercepat, tanpa network)
2. **JWKS lokal** via `createRemoteJWKSet(<url>/auth/v1/.well-known/jwks.json)` (project dengan signing key asimetris)
3. **Fallback network** `getServiceClient().auth.getUser(token)`

Validasi payload: harus ada `sub`, dan `aud` mengandung `'authenticated'`. Service client di-init **lazy** (jangan dievaluasi saat build).

Client selalu memanggil lewat helper:

```ts
export async function authFetch(input, init = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}
```

---

### POST `/api/chat` — `maxDuration = 30`

```jsonc
// request
{ "npcId": "sinta|sup|jnr|mgr", "messages": [{"role":"user|assistant","content":"..."}],
  "userContext": {...}, "positionId": "data_analyst" }
// response
{ "reply": "...", "interviewDone": false, "interviewOutcome": "pass|conditional|rejected|undefined" }
// response saat semua provider gagal (tetap 200)
{ "reply": "Maaf, ada gangguan koneksi. Coba kirim pesan lagi ya!", "failed": true }
```

Hardening wajib:
- rate limit bucket `chat` — bila habis, balas **200** dengan `reply = LIMIT_MESSAGE.chat` (jangan 429; UI chat rusak)
- `npcId` divalidasi terhadap whitelist
- ambil **40 pesan terakhir**, paksa role ke `user|assistant`, potong tiap konten ke **2000 char**, buang yang kosong
- `userContext` **dibangun ulang field per field** dengan cap panjang (firstName 80, email 200, background 40, bgRole 120, position 60, level 40, experience 600, motivation 600) — jangan meneruskan objek client mentah
- parse token Sinta, lalu strip: `reply.replace(/\s*\[(SELESAI_CATATAN|SELESAI|TOLAK)\]\s*/g, ' ').trim()`
- `[TOLAK]` diabaikan bila jumlah pesan user < 6

### POST `/api/review` — `maxDuration = 30`

```jsonc
{ "positionId":"data_analyst", "userContext":{...}, "submission":"<teks Excel>", "taskSlug":"da-day2-dashboard" }
→ { "review":"...", "isApproved":true, "status":"APPROVED|REVISION NEEDED" }   // score TIDAK disertakan
```

- rate limit `review` → 429
- `submission` dipotong 15.000 char
- **tanpa `taskSlug`** → rubrik day-1 dari `POSITIONS[x].taskRubric`
- **dengan `taskSlug`** → ambil dari tabel `tasks` (`slug` + `position_id`), pilih `rubric[normalizeLevel(level)]` dengan fallback `rubric.junior`. Slug tidak dikenal / rubrik kosong → **404**, jangan diam-diam menilai pakai rubrik day-1 yang salah
- AI gagal → 503 "Layanan AI lagi sibuk. Coba submit lagi 1-2 menit ya."
- catat event `task_scored` (best-effort)

### GET/POST `/api/progress`

```
GET  ?list=1              → { progresses: [...] }  // semua run user, TANPA chat_history (hub karir)
GET  ?position=<id>       → { progress }           // run posisi itu
GET  ?light=1             → tanpa chat_history (routing stage awal)
GET  (tanpa param)        → run terakhir aktif
POST { progress: {...} }  → upsert onConflict 'user_id,position'
```

Guard POST:
- `position` wajib & harus ada di `POSITIONS` → 400
- `step` di-clamp 0..10; `coins` 0..100000; `tasksDone` 0..1000; `streak` 0..10000; `simDay` 1..400 (default ke nilai tersimpan)
- `chat_history` > **900.000 byte** → 413
- `step < existing.step` **atau** `simDay < existing.sim_day` → **409** `{ error:'Stale progress', currentStep, currentDay }`

### POST `/api/reset`

`{ position? }` — dengan `position` reset run itu saja; tanpa body reset semua. Setelahnya: bila **tidak ada** run lain dengan `tasks_done > 0`, hapus entri pengalaman `id === 'kantoran-sim'` dari `user_profiles.experience`.

### GET `/api/tasks?position=<id>`

```jsonc
{ "tasks": [
    { "slug":"...","day":1,"title":"...","brief":"...","file_name":"...","locked":false },
    { "slug":"...","day":2,"title":"...","teaser":"...","locked":true }   // HANYA 4 field ini saat terkunci
  ],
  "premium": false }
```

`locked = day >= 2 && !hasSeasonAccess()`. Tabel belum ada → `{ tasks: [], note: 'Jalankan migration 006.' }` (bukan error). `rubric` tidak pernah ikut.

### GET `/api/task-file?slug=<slug>` — `maxDuration = 15`

Cek task published & punya `file_name`; bila `day >= 2` cek entitlement → 403 *"Konten season. Terbuka setelah kamu punya akses Kantoran penuh."*; lalu `storage.from('task-files').download(file_name)` dan stream dengan `Content-Disposition: attachment` + `Cache-Control: private, no-store`.

### GET `/api/lessons?position=<id>` · POST `/api/lessons/progress` · POST `/api/lessons/submit`

Lihat Bagian 16.

### POST `/api/track`

Whitelist tipe: `profile_done, apply, interview_start, interview_done, interview_rejected, offer_signed, training_done, task_submitted, task_revision, task_approved, day1_done, waitlist_submitted, sql_challenge_done, client_error`. `meta` di-cap 2000 char. **Selalu balas 200** — tracking tidak boleh mengganggu app. Client membatasi `client_error` maksimal **5 per sesi**.

### GET/POST `/api/waitlist`

`GET → { submitted: boolean }` (form hanya sekali seumur akun). POST menyimpan `email, name, rating, feedback, wishlist[], position_tried`.

### GET `/api/stats`

`{ activeThisWeek: N }` — distinct `user_id` dari `user_progress` dengan `last_active` 7 hari terakhir (limit 1000). Ditampilkan di job listing **hanya bila N >= 3**.

### `/api/cv-extract` & `/api/cv-review` (satelit `/cv`)

- `cv-extract`: `runtime = 'nodejs'`, terima PDF/DOCX/TXT maks 4MB (pre-check di client), ekstraksi via `unpdf` / `mammoth`
- `cv-review`: `callAI(..., { json: true, maxTokens: 2500 })` dengan prompt `lib/cvPrompt.ts`, rate bucket `cv` (10/hari). Output JSON: `overallScore, atsScore, verdict, sections[4], strengths[], gaps[], missingKeywords[], rewrites[{before,after}], nextSteps[]`

### GET `/api/admin/stats`

Gated `ADMIN_EMAILS` (comma separated; kosong = tolak semua). Mengembalikan: users, funnel hari-1, aktif, churn proxy, waitlist, estimasi biaya dari `api_usage`, dan distribusi `task_scored` untuk kalibrasi `PASS_SCORE`.

---

## 16. Vantara Academy (LMS in-story)

Konsep: e-course **dengan cerita dan misi**, posisinya **just-in-time**, bukan gerbang. Supervisor yang "meng-assign training module".

- **Konten hidup di Supabase** supaya bisa diupdate tanpa deploy.
- Tiap posisi punya modul `track: 'tools'`, ditambah modul bisnis bersama (`position_id = 'all'`).
- Lesson bertipe `text` | `video` | `mission`.
- **Video:** kolom `youtube_video_id` nullable — diisi manual di Studio kapan saja; komponen menampilkan placeholder "Video menyusul" kalau kosong. Seed **tidak menimpa** nilai yang sudah diisi manual.
- **Misi** direview AI supervisor lewat `reviewSubmission` (engine yang sama dengan task) → suara feedback konsisten.
- **Gate premium di API:** `locked = day > 1`. Modul terkunci **tidak mengirim** `content_md`, `youtubeVideoId`, maupun `missionBrief` — hanya `title` + `teaser`.
- `mission.rubric` **tidak pernah** dikirim ke client.
- UI di-load dinamis (`next/dynamic`, `ssr: false`) supaya `react-markdown` tidak membebani bundle chat.

**Submit misi (`/api/lessons/submit`):** rate bucket `mission`; submission dipotong 6000 char dan **ditolak bila < 30 char** ("Jawaban terlalu pendek. Kerjakan dulu misinya dengan serius ya."); lesson harus `type = 'mission'`, published, modulnya published, dan `day <= 1` (403 bila tidak). `attempts` selalu naik; `status = 'completed'` hanya saat approved; **XP hanya diberikan saat pertama kali approved** (tidak bisa di-farm).

**Integrasi ke simulator:**
- `evalTraining(modules)` — training day-1 dianggap selesai bila **semua** lesson di modul `day 1 && track 'tools' && !locked` berstatus `completed`. Posisi tanpa konten training → set `trainingDone = true` tapi tandai `trainingVacuousRef` supaya **tidak ada apresiasi palsu**.
- Saat `trainingDone` dan `step >= 5` dan belum pernah diapresiasi: supervisor mengirim *"Btw aku lihat training module kamu kelar, termasuk misinya. Bagus, itu bakal kepake banget di task-mu."* + **10 coin** + event `training_done` + satu baris di surat referensi.

**Authoring:** `content/lessons/<position>/<slug>.md` (frontmatter) + `content/lessons/modules.json` → `npm run seed:lessons` (idempotent, upsert by slug).

Contoh entri `modules.json` — perhatikan `story_intro` ditulis **dengan suara supervisor**:

```json
{
  "slug": "da-excel-dasar",
  "position_id": "data_analyst",
  "title": "Excel untuk Analis Data",
  "track": "tools", "day": 1, "sort_order": 1,
  "story_intro": "Oke, ini fondasi kamu. Di tim ini 80 persen kerjaan harian masih lewat Excel, jadi jangan anggap remeh. Tiga materi ini urutannya sengaja: data kotor dulu, baru formula, baru pivot. Ada misi kecil di akhir, aku cek langsung hasilnya."
}
```

---

## 17. Sistem Task Season & pipeline authoring

### 17.1 Format file task

`content/tasks/<slug>.md` — frontmatter YAML + body (brief dengan suara supervisor).

```markdown
---
slug: da-day2-dashboard
position_id: data_analyst
day: 2
sort_order: 1
title: Dashboard Penjualan untuk Rapat Direksi
task_type: file            # file | text | sql | chat
file_name: task_da_day2.xlsx
teaser: Diana butuh dashboard dari data yang kamu bersihkan kemarin, dipresentasikan langsung ke jajaran direksi.
context: Rapat direksi besok jam 9. Diana presentasi pakai halamanmu, dan tim Finance ikut hadir membawa angka mereka sendiri.
cross_ref: Diana bilang tim Finance juga hadir, angkamu harus cocok sama angka mereka.
approved_reaction: Solid. Ringkas, insight-nya kena, dan kamu nggak buang waktu direksi. Aku forward ke Diana sekarang, jangan kaget kalau besok namamu disebut di rapat.
revision_reaction: Belum. Direksi nggak baca tabel mentah, dan mereka nggak peduli angka yang nggak ada artinya. Lihat lagi catatanku, perbaiki, kirim ulang sebelum jam 8.
rubric:
  intern:
    must_find:
      - Tren revenue per brand H1 2026 teridentifikasi dengan benar
      - Top 5 SKU berdasarkan revenue dengan angka yang akurat
      - Format ringkas satu halaman, bukan tabel mentah yang dicopy
    good_to_mention:
      - Menyebut cara angka dihitung (pivot per brand/bulan)
  junior:
    must_find:
      - Tren revenue per brand H1 2026 teridentifikasi dengan benar
      - "Insight margin: margin Lumière turun konsisten (sekitar 42% ke 33%) padahal revenue-nya tetap terbesar"
      - Format ringkas siap presentasi
    good_to_mention:
      - Rekomendasi tindak lanjut yang actionable
      - Menyebut perlunya cek silang angka dengan tim Finance
  mid:
    must_find:
      - "Insight margin Lumière ditemukan DAN dikuantifikasi dampaknya ke profit"
      - Struktur naratif eksekutif, kesimpulan dan rekomendasi di depan
      - Rekomendasi dengan trade-off yang jelas
    good_to_mention:
      - Skenario what-if sederhana
      - Mengaitkan temuan ke keputusan budget Q3
---
Data yang kemarin kamu bersihin dipakai Diana besok pagi di rapat direksi. Aku butuh satu halaman ringkas: tren penjualan per brand, top 5 SKU, dan satu insight yang menurutmu direksi HARUS tahu.

Di file-nya ada kolom baru, margin_pct. Kamu belum pernah pegang itu, tapi analis yang baik nggak nunggu disuruh melihat kolom baru.

Jangan kirim tabel mentah, direksi nggak baca tabel. Kumpulkan sebagai sheet Ringkasan di file yang sama, upload di Workspace sebelum jam 8 besok.
```

**Prinsip menulis rubrik:** rubrik naik bertingkat per level — intern dinilai dari *ketepatan mekanis*, junior dari *insight*, mid dari *struktur argumen + trade-off*. Insight kuncinya harus **benar-benar tertanam di file datanya** (lihat 18).

### 17.2 `npm run seed:tasks`

Validasi **gagal keras** supaya typo ketahuan saat seed, bukan saat user main:

- field wajib: `slug, position_id, day, title, task_type, rubric`
- `task_type` ∈ {file, text, sql, chat}
- `rubric` punya minimal satu level valid, dan tiap level punya `must_find` non-kosong
- `task_type: file` wajib punya `file_name`
- frontmatter YAML invalid → pesan error eksplisit + hint (*nilai yang memuat `": "` dibaca YAML sebagai mapping — kutip nilainya*)
- upsert `onConflict: 'slug'`
- untuk `day >= 2`: upload `content/task-files/<file_name>` ke bucket privat `task-files` (`upsert: true`). File tidak ada → error + saran `npm run generate:universe`

**Aturan file:** file day-1 boleh di `public/tasks/` (gratis). File day >= 2 **DILARANG** di `public/` — kalau ditaruh di sana, seluruh konten berbayar bisa diunduh tanpa bayar.

### 17.3 Pipeline task di runtime

- `seasonTasks` = hasil `/api/tasks?position=` (task ke-2 dan seterusnya; task day-1 pertama tetap hardcoded di `POSITIONS`)
- **Cursor task berikutnya = `seasonTasks[tasksDone - 1]`**
- `deliverTask(task, num)` → kartu `task` di `sup_chat` + kartu action "Buka File Manager →" + kartu download di `file_manager` dengan `href = day >= 2 ? '/api/task-file?slug=…' : '/tasks/<file>'`
- Setelah APPROVED:
  - `next` ada, tidak terkunci, **`next.day === simDay`** → handoff ringan di hari yang sama: *"Mantap `<nama>`, satu kelar. Mumpung masih on, ada satu lagi buat hari ini, nggak berat kok."* lalu `deliverTask`
  - selain itu → `finishDay(coins, tasksDone, next)`
- `finishDay` memasang kartu `day_done` dengan dua kemungkinan:
  - hari berikutnya tersedia → `{ label: 'Selesai hari ini, lanjut ke Hari ke-N', nextStep: 97 }`
  - konten habis / terkunci → `{ label: 'Selesai untuk hari ini, Lanjut ke Hari Kedua', nextStep: 99 }` (gate premium)

### 17.4 Desain Season 1 (arc naratif)

Season = 3 bulan cerita, hari 1–7 adalah minggu pertama. Arc pertama: **"Kasus Region Timur"**.

Satu anomali dilihat 6 divisi dari sudut berbeda dan saling merujuk lewat `cross_ref`:

| Posisi | Day 3 | Sudut pandang atas kasus yang sama |
|---|---|---|
| Data Analyst | Investigasi Anomali Region Timur | penjualan Jatim anjlok 38% |
| Finance | Selisih Rp 80 Juta, Temukan Sumbernya | pembayaran distributor Jatim tidak balance |
| Admin Ops | Kontrak UD Berkah Jaya Harus Ketemu Hari Ini | arsip kontrak distributor yang sama |
| BizDev | (day 5) Riset Ekspansi Indonesia Timur | go/no-go, terganggu laporan tim Data |
| Marketing | Krisis: Video Komplain Viral di TikTok | asal video = region yang sedang diselidiki |
| HR | Exit Interview Mendadak | performer terbaik resign di tengah tekanan |

Ini yang membuat "kantor" terasa satu perusahaan, bukan enam mini-game.

---

## 18. Vantara Data Universe + SQL editor

### 18.1 Generator (`scripts/generate-universe.ts`)

Satu **PRNG deterministik** (`mulberry32`, `SEED = 20260713`) menghasilkan seluruh data perusahaan: produk, 18 distributor, 18 bulan penjualan, pembayaran, campaign, budget, payroll.

Output:
- `public/data/vantara.db` (SQLite untuk SQL editor)
- `public/data/csv/*.csv` (bahan pack Excel posisi lain)
- `public/sql-wasm.wasm` (runtime sql.js)
- `content/task-files/*.xlsx` (file task premium)

**Anomali cerita DITANAM DI DATA** (bukan sekadar narasi) — inilah yang membuat interkoneksi nyata:

- Penjualan **Jawa Timur anjlok ±38%** mulai Mei 2026 → case DA day 3
- **UD Berkah Jaya** menunggak pembayaran **±Rp 77–80 juta** → case Finance day 3, BizDev, Admin Ops
- **TikTok conversion rendah** → case Marketing day 1
- **Marketing/Sales/IT overspend Q4 2025** → case Finance day 1
- **Margin Lumière turun 42% → 33%** padahal revenue tertinggi → case DA day 2
- (payroll) gender pay gap di Sales pada level yang sama → bahan case HR

Master data yang harus konsisten: brand `LUM/RTC/VGL`, 12 produk per brand, 9 region dengan bobot volume (Jabodetabek terbesar), 3 channel (Modern Trade / General Trade / E-commerce), multiplier musiman per bulan (Lebaran & Desember naik).

Generator **wajib punya sanity check di akhir** yang memastikan anomali benar-benar terbentuk — kalau tidak, seed berubah diam-diam dan semua rubrik jadi salah.

### 18.2 SQL editor (`components/SqlEditor.tsx`)

Room `database`, **khusus `data_analyst`**, terbuka step >= 5. sql.js WASM di-load dinamis (hanya saat room dibuka).

9 tantangan bertingkat, diperkenalkan in-story oleh supervisor ("aku kasih akses read-only ke database penjualan internal"):

1. Total revenue Januari 2026 — `SUM` + filter `LIKE '2026-01%'`
2. Jumlah order E-commerce 2026 — `COUNT` + dua filter `AND`
3. Channel penyumbang terbesar — `GROUP BY` + `ORDER BY DESC`
4. Revenue per brand — `JOIN products`
5. Top 5 SKU 2025 — `UPPER(sku)` untuk menyatukan `lum-001`/`LUM-001`, `LIMIT 5`
6. Revenue per region 2026 — "ada yang janggal": baris region NULL muncul sebagai kelompok
7. Kapan Jawa Timur mulai anjlok — `substr(order_date,1,7)`
8. Distributor mana yang menunggak — `JOIN` + `SUM(invoice - paid)` + `HAVING > 0`
9. Seberapa dalam Jatim turun YoY — `substr(order_date,1,4)`

Tiap tantangan punya **hint** yang mengajarkan konsep, bukan memberi jawaban.

**Grading deterministik tanpa AI** (`lib/sqlCompare.ts`) — yang dinilai ISI hasil, bukan teks query:

```ts
normalizeRows(result)   // NULL diseragamkan; angka dibulatkan 2 desimal; string di-trim;
                        // string numerik murni ('4500') disamakan dengan angka, tapi '2026-01' tetap string;
                        // baris di-join '|' lalu di-SORT (urutan baris tidak dinilai)
resultsMatch(a, b)      // jumlah kolom sama && jumlah baris sama && semua baris ternormalisasi cocok
```

Tantangan selesai → coin + event `sql_challenge_done`.

---

## 19. Observability, admin, rate limit, hardening

### 19.1 Rate limit harian (`lib/rateLimit.ts`)

```ts
DAILY_LIMITS = { chat: 300, review: 25, cv: 10, mission: 30 }
```

Counter atomic di Postgres lewat RPC `bump_usage` (bukan memori — serverless multi-instance). **Fail-open:** kalau RPC error (mis. migration belum jalan), request tetap diizinkan supaya fitur tidak mati total.

Pesan limit ditulis in-character:
- chat: *"Kamu sudah banyak banget ngobrol hari ini. Lanjut lagi besok ya!"*
- review: *"Batas review hari ini sudah tercapai. Coba lagi besok ya."*
- cv: *"Batas cek CV hari ini sudah tercapai (10x per hari). Coba lagi besok ya."*
- mission: *"Batas submit misi hari ini sudah tercapai. Lanjut lagi besok ya."*

### 19.2 Event funnel

`lib/track.ts` → `POST /api/track` → tabel `events`. Fire and forget, **tidak pernah** mengganggu UX.

Funnel yang harus terpasang: `profile_done → apply → interview_start → interview_done|interview_rejected → offer_signed → (training_done) → task_submitted|task_revision → day1_done → waitlist_submitted`.

Error client: `components/ClientMonitor.tsx` memasang `window.onerror` + `unhandledrejection` (maks 5/sesi) → event `client_error`; `app/error.tsx` sebagai error boundary.

### 19.3 Ringkasan hardening

| Vektor | Mitigasi |
|---|---|
| Prompt/context injection lewat client | `userContext` dibangun ulang field per field + cap panjang |
| Ledakan biaya token | cap 40 pesan × 2000 char, submission 15k, misi 6k, CV 2500 token |
| Database dibanjiri | `chat_history` maks 900KB → 413 |
| Progress dimanipulasi | semua angka di-clamp; step & sim_day tidak boleh mundur → 409 |
| Konten premium bocor | rubrik & brief tidak pernah ke client; file day>=2 di bucket privat + cek entitlement |
| XP farming | XP misi hanya saat pertama kali approved |
| Kunci API bocor | key Gemini di header, service role hanya server-side |
| Timeout serverless | deadline budget 25s < `maxDuration` 30s |
| Banjir error client | maks 5 event `client_error` per sesi |

---

## 20. Design system & komponen UI

### 20.1 Token

```css
--teal:#0F6E56;  --teal-mid:#1D9E75;  --teal-light:#E1F5EE;  --teal-dark:#085041;
--bg:#FAFAF7;    --border:#E5E3DC;    --muted:#888780;        /* teks utama #111111 */
```

Avatar: `.av-teal #E1F5EE/#0F6E56` · `.av-blue #E8F0FC/#1A4A8A` · `.av-purple #F0EAF9/#5B2D8E` · `.av-amber #FAEEDA/#854F0B` · `.av-green #DCFCE7/#166534`.

Animasi: `fadeUp` (0.3s), `messageIn` (0.3s), `dotBounce` (1.2s, delay bertahap 0.15s/0.3s untuk indikator mengetik). Kelas `.btn-teal`, `.btn-teal-outline`. Scrollbar 4px.

Font: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`).

**Konvensi wajib:** setiap `<button>` diberi `style={{ cursor: 'pointer' }}` (dan `'not-allowed'` saat disabled/locked).

### 20.2 Layout simulator

```
┌──────────────────────────────────────────────┐
│ notifikasi (banner teal, klik = pindah room) │
├──────────────────────────────────────────────┤
│ ☰  ● Kantoran   📍<room>   🪙coins 🏢 🔄 Keluar│  topbar 52px
├──────────────────────────────────────────────┤
│ ▓▓▓▓░░░░░░░░  progress 12 segmen              │
├────────────┬─────────────────────────────────┤
│ TIM KAMU   │  header room (avatar+status)     │
│  Sinta     │                                  │
│  Sup/Mgr/Jnr│  area pesan (scroll)             │
│ RUANGAN    │                                  │
│  📧 Inbox…  │                                  │
│ Profil saya │                                  │
│ STATISTIK  ├─────────────────────────────────┤
│ (4 kotak)  │  input textarea + tombol ➤       │
└────────────┴─────────────────────────────────┘
```

Sidebar = drawer di mobile (`translate-x`, backdrop), statis 210px di desktop. Panel profil = full-screen di mobile, 280px di desktop.

### 20.3 Mobile (traffic IG/TikTok — wajib mulus di 390px)

- `h-dvh` **tidak cukup** di iOS Safari. Ukur `window.visualViewport.height` dan set tinggi container secara eksplisit; `window.scrollTo(0,0)` tiap resize/scroll viewport.
- Kunci scroll body selama di simulator (`overflow:hidden; position:fixed; width:100%`), kembalikan saat unmount.
- `viewport: { maximumScale: 1, userScalable: false }` supaya browser tidak auto-zoom saat fokus input.
- Textarea auto-grow maks 120px; Enter kirim, Shift+Enter baris baru.
- Auto-focus input setelah balasan selesai: `useEffect` yang memantau `loading` + double `requestAnimationFrame`.

### 20.4 Guided tour (`GuidedTour.tsx`)

Spotlight overlay 6 langkah, sekali per akun (`localStorage kantoran_tour_v1_<uid>`), hanya muncul saat `step <= 1`. Langkah yang menyorot elemen di sidebar menyalakan drawer di mobile (`needsSidebar: true`). Target lewat atribut `data-tour="team|rooms|coins"`.

Isi 6 langkah: (1) selamat datang di kantor barumu, (2) Inbox, (3) Tim kamu, (4) Ruangan kantor, (5) Kantor Coin, (6) "Sinta sudah menunggu — balas saja pesannya untuk mulai interview".

### 20.5 Job listing = hub karir multi-role

Grid 6 posisi dengan status per posisi dari `GET /api/progress?list=1`:

```ts
step >= 10 → 'Hari-1 selesai'   |  step >= 5 → 'Mengerjakan task'
step >= 2  → 'Onboarding'       |  else       → 'Tahap interview'
```

Modal detail berisi: about, responsibilities, qualifications, tags, range gaji per level, dan **pemilih jenjang** (intern/junior/mid — bebas dipilih; background profil hanya pre-select). Bila `activeThisWeek >= 3`, tampilkan "N orang menjalani simulasi minggu ini".

**Setelah login user SELALU diarahkan ke hub ini**, bukan auto-resume (kecuali refresh di tengah simulasi lewat `sessionStorage`).

### 20.6 Wishlist / gate premium

3 langkah: rating bintang → feedback bebas → pilih wishlist (10 opsi checkbox) + email. Setelah submit muncul **share card** berisi rekap personal yang dibangun dari run:

```ts
buildRecap() =
  `Hari pertamaku sebagai ${bgRole} di simulasi Kantoran: lulus interview HR, nego gaji sampai
   Rp X juta, task pertama APPROVED dengan penilaian "${GRADE_LABEL[grade]}" dan gaya kerja
   "${workStyle.label}". ${coins} Kantor Coin terkumpul. Rasain juga jadi anak kantoran: <url>`
```

Rekap personal jauh lebih menular daripada template generik. Form ini **hanya muncul sekali seumur akun** (`GET /api/waitlist → {submitted}`); sesudahnya menyelesaikan posisi langsung kembali ke hub.

---

## 21. Jebakan yang SUDAH pernah terjadi (jangan diulang)

Daftar ini adalah bug produksi nyata. Implementasi yang mengabaikannya akan mengulanginya.

1. **Banner error masuk history AI.** Saat provider gagal, JANGAN menulis pesan error sebagai bubble NPC. Ia harus `role:'system', isError:true` (banner + tombol "↻ Kirim ulang") dan **dilewati** di `buildHistory`. Kalau tidak, AI membaca "Maaf ada gangguan koneksi" sebagai jawabannya sendiri dan **melompati tahap interview**.
2. **Retry menduplikasi pesan.** `handleRetry` membuang pesan `isError`, mengambil pesan user terakhir, dan mengirim ulang **tanpa** menambahkannya lagi ke history.
3. **`onClearUpload` tidak membersihkan `reviewResult`.** Tombol submit hanya muncul saat `!reviewResult`; tanpa reset, user yang upload ulang setelah revisi **tidak pernah bisa submit lagi**.
4. **Upload file baru tidak me-reset review lama.** `handleFileUpload` wajib `setReviewResult(null)`.
5. **Double-submit setelah APPROVED.** `handleSubmitTask` langsung `return` bila `reviewResult?.isApproved` — kalau tidak, coin dan `tasksDone` berlipat.
6. **False positive "kamu diterima".** Fallback keyword harus ketat: `salaryDiscussed && userMsgCount >= 8 && !endsWithQuestion && doneSignals`.
7. **Offering letter tanpa nego.** Semua jalur menuju step 2 (termasuk tombol pintas di header) wajib melewati guard `salaryDiscussed`.
8. **Race condition `addMsg`.** Untuk pesan kritis (email inbox), tulis langsung di `setState`, jangan `addMsg` di dalam `setTimeout`.
9. **Supervisor menyebut file sebelum waktunya.** Prompt supervisor harus kondisional pada `step` (Bagian 9.2), atau ia akan menyuruh user membuka file yang belum ada.
10. **NPC mengarang resource.** Larangan eksplisit "email yang aku kirim kemarin / link yang aku share / dashboard di sistem lain".
11. **`xlsx` di dependency produksi.** CVE tanpa patch. Pakai `exceljs` di client; `xlsx` hanya devDependency untuk generator.
12. **Progress mundur menimpa run maju.** Guard 409 di server + dirty check di client.
13. **Task pipeline dinilai dengan rubrik salah.** Slug tidak dikenal → 404, bukan diam-diam memakai rubrik day-1.
14. **File premium di `public/`.** Semua konten berbayar bisa diunduh tanpa bayar. Wajib bucket privat + `/api/task-file`.
15. **Review terlalu ketat.** Sebelum sistem skor, model menuntut kesempurnaan dan user terjebak revisi berulang. Ambang 70 + "hanya 1-2 hal terpenting" adalah perbaikannya.
16. **Gemini 2.5-flash membalas kosong.** Karena `thinking` menyerap token output → wajib `thinkingBudget: 0`.
17. **Nama posisi redundan.** `bgRole` sudah memuat nama posisi lengkap ("Junior Data Analyst") — jangan di-append `pos.title` lagi.
18. **Cursor tidak aktif setelah balasan.** `useEffect` memantau `loading` + `requestAnimationFrame` ganda.
19. **Auto-save membanjiri database saat idle.** Dirty check wajib; `lastSavedRef` hanya diupdate saat `res.ok`.
20. **Layar login Google menampilkan domain Supabase mentah.** Set custom domain / branding di Supabase Auth sebelum go-live.

---

## 22. Urutan build & acceptance criteria

### Fase 1 — Fondasi (bisa login, bisa simpan)

1. Scaffold Next.js 16 + TS + Tailwind v4 + struktur folder (Bagian 3)
2. Supabase: project, Google OAuth, jalankan SQL Bagian 5 secara berurutan
3. `lib/supabase.ts` (+`authFetch`), `lib/serverAuth.ts`, `lib/rateLimit.ts`
4. `LoginPage`, `ProfileSetup` (5 langkah: nama/gender/kota → pendidikan → pengalaman → skills → kategori), `/api/profile`
5. `lib/positions.ts` lengkap (6 posisi, roster NPC, rubrik day-1, upcomingTasks)
6. `JobListing` + `/api/progress` (GET list & POST dengan guard 409)

✅ **Lolos bila:** login Google → isi profil → hub karir menampilkan 6 posisi dengan status yang benar; refresh tidak kehilangan apa pun.

### Fase 2 — Jantung: interview & nego gaji

7. `lib/ai.ts` (multi-provider + rotasi + deadline + `cleanResponse`) + test `cleanResponse`
8. `lib/prompts.ts`: `STYLE_RULES` + `getSintaPrompt` lengkap dengan token 3 tingkat
9. `/api/chat` dengan seluruh hardening + parsing token
10. Kerangka `SimulatorApp`: state, rooms, sidebar, `MessageBubble`, input, notifikasi
11. Step 0→1→2: undangan, interview, ekstraksi gaji, offering letter

✅ **Lolos bila:** interview mengalir 8-10 tanya-jawab tanpa melompat; Sinta tidak pernah menyebut angka duluan; angka hasil nego (termasuk stretch +20% dengan justifikasi kuat) muncul persis di offering letter; interview mustahil selesai tanpa membahas gaji; balasan **tidak mengandung markdown, bullet, atau tanda hubung panjang**.

### Fase 3 — Hari pertama utuh

12. Step 3: kontrak, Slack, sambutan (varian dingin untuk conditional), room terbuka
13. Step 4: orientasi + SOP + standup (+ fallback 120 detik)
14. Step 5-6: task brief, File Manager, dilema `choice`
15. `lib/reviewTask.ts` + `/api/review` + Workspace (exceljs, 50 baris/sheet)
16. Step 9-10: APPROVED, teach-back, refleksi, kartu `day_done`
17. `lib/performance.ts` + `ReferenceLetter`
18. `WishlistForm` + `/api/waitlist` + `buildRecap`

✅ **Lolos bila:** satu run penuh dari apply sampai kartu `day_done` tanpa dead end; submit hasil asal-asalan → REVISION dengan 1-2 catatan (bukan banjir); submit layak → APPROVED walau tidak sempurna; revisi ke-2 membuat supervisor terasa berbeda; surat referensi berubah bunyinya mengikuti grade.

### Fase 4 — Kedalaman

19. Academy (migration 003, seed, API, panel, misi)
20. Guided tour, kantor hidup (gap 8 jam), `/api/stats`
21. Generator universe + SQL editor + `sqlCompare` (+ test)
22. Sistem task season (migration 006, `seed:tasks`, `/api/tasks`, `/api/task-file`, step 97)
23. Observability (`/api/track`, `ClientMonitor`, `/admin`)
24. `/cv` (satelit akuisisi), `/privacy`, `/terms`, OG tags, `robots.txt`, `sitemap`

✅ **Lolos bila:** modul day >= 2 tidak pernah mengirim konten ke client (cek Network tab); `/api/task-file` tanpa entitlement → 403; rubrik tidak pernah muncul di respons mana pun; funnel `/admin` menampilkan drop-off tiap tahap.

### Uji regresi wajib sebelum rilis

```bash
npm run test         # ai-clean, performance, positions, sqlCompare
npm run lint         # 0 error
npm run build
```

```bash
# API hardening (pakai token asli)
curl -X POST /api/chat                        # → 401 tanpa token
curl -X POST /api/progress -d '{"progress":{"step":1,...}}'   # → 409 bila run sudah step > 1
curl -X POST /api/chat -d '{"npcId":"hacker",...}'            # → 400
curl /api/tasks?position=bukan_posisi                          # → 400
curl /api/task-file?slug=<task day 2>                          # → 403 tanpa entitlement
```

**Manual, di lebar 390px:** landing → login → profil → hub → tour → interview → nego → offering → kontrak → standup → task → upload → revisi → approved → teach-back → kartu akhir hari → wishlist → kembali ke hub → coba posisi kedua (progress posisi pertama harus utuh) → restart posisi kedua (posisi pertama tidak tersentuh).

---

## Lampiran A — Checklist "apakah ini terasa seperti Kantoran?"

Kalau semua ini terpenuhi, hasil build-nya benar:

- [ ] Membaca balasan NPC tidak terasa seperti membaca chatbot. Tidak ada bullet, tidak ada "Tentu!", tidak ada em dash.
- [ ] Sinta menolak memberi angka gaji duluan, dan menggali alasan sebelum menilai angka.
- [ ] Angka yang disepakati di chat muncul persis di offering letter.
- [ ] Gagal task tidak menghentikan permainan; ia mengubah nada supervisor dan bunyi surat referensi.
- [ ] Academy terasa seperti bantuan yang datang saat dibutuhkan, bukan gerbang.
- [ ] Surat referensi terlihat sejak hari pertama dan terisi di depan mata user.
- [ ] Konten terkunci terbaca sebagai cliffhanger cerita, bukan iklan upgrade.
- [ ] Anomali yang sama (UD Berkah Jaya, Jawa Timur) bisa ditemukan dari tiga divisi berbeda.
- [ ] Rubrik, brief premium, dan skor tidak pernah terlihat di Network tab.
- [ ] Semuanya mulus di layar 390px dengan keyboard terbuka.
