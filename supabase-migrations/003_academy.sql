-- Vantara Academy — modul belajar per posisi (story + misi).
-- Konten di database supaya bisa diupdate tanpa deploy (mis. isi youtube_video_id nanti).
-- Jalankan di Supabase Studio → SQL Editor, SETELAH 002_rate_limits.sql.

CREATE TABLE IF NOT EXISTS lesson_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id TEXT NOT NULL,                 -- 'data_analyst' dst, atau 'all' (modul bisnis bersama)
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('tools','business')),
  day INT NOT NULL DEFAULT 1,                -- day 1 = gratis, >= 2 = teaser premium
  sort_order INT NOT NULL DEFAULT 0,
  npc_id TEXT NOT NULL DEFAULT 'sup',        -- NPC yang meng-assign modul
  story_intro TEXT,                          -- intro suara supervisor, tampil sebagai bubble chat
  teaser TEXT,                               -- teks untuk kartu terkunci (premium)
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES lesson_modules(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','video','mission')),
  sort_order INT NOT NULL DEFAULT 0,
  content_md TEXT,                           -- materi markdown
  youtube_video_id TEXT,                     -- nullable — isi kapan saja di Studio, tanpa deploy
  mission JSONB,                             -- { "brief": "...", "rubric": { "mustFind": [], "goodToMention": [] } }
  xp INT NOT NULL DEFAULT 10,                -- coin yang didapat saat selesai
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_pos ON lesson_modules(position_id, day, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id, sort_order);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL,                     -- TEXT, konsisten dengan user_progress
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  score INT,
  attempts INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);
-- Analitik funnel per lesson: % user yang menyelesaikan tiap lesson
CREATE INDEX IF NOT EXISTS idx_lp_lesson ON lesson_progress(lesson_id);

ALTER TABLE lesson_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Konten published boleh dibaca publik (gate premium ada di API: body lesson day >= 2 tidak dikirim)
DROP POLICY IF EXISTS "public read published modules" ON lesson_modules;
CREATE POLICY "public read published modules" ON lesson_modules FOR SELECT USING (is_published);
DROP POLICY IF EXISTS "public read published lessons" ON lessons;
CREATE POLICY "public read published lessons" ON lessons FOR SELECT USING (is_published);
DROP POLICY IF EXISTS "own lesson progress" ON lesson_progress;
CREATE POLICY "own lesson progress" ON lesson_progress FOR ALL USING (auth.uid()::text = user_id);

-- Query analitik yang berguna (jalankan manual di Studio):
-- Penyelesaian per lesson:
--   SELECT l.slug, COUNT(*) FILTER (WHERE lp.status = 'completed') AS done, COUNT(*) AS started
--   FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
--   GROUP BY l.slug ORDER BY started DESC;
