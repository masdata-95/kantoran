-- ============================================================
--  Kantoran - skema D1 (SQLite), pengganti Supabase Postgres
--  Rencana lengkap: RENCANA-PINDAH-D1.md
--
--  Prinsip penerjemahan dari supabase-migrations/*.sql:
--    - user_id tetap UUID lama dari Supabase Auth (TEXT), jadi data lama
--      dipindah apa adanya dan tidak ada id yang dipetakan ulang
--    - JSONB dan TEXT[] -> TEXT berisi JSON (dibaca dengan JSON.parse / json_extract)
--    - TIMESTAMPTZ -> TEXT ISO-8601 UTC (format yang sudah dipakai kode sekarang;
--      urutan teksnya sama dengan urutan waktu)
--    - BOOLEAN -> INTEGER 0/1
--    - RLS tidak ada di D1: semua akses lewat API server, yang memang sudah
--      memakai service role sejak awal
--
--  Pasang:  npx wrangler d1 migrations apply kantoran --remote
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
--  Akun (pengganti Supabase Auth)
-- ------------------------------------------------------------

-- id = UUID auth.users lama untuk user yang dipindah; user baru dapat crypto.randomUUID().
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT,
  avatar_url   TEXT,
  google_sub   TEXT UNIQUE,                 -- "sub" dari Google; NULL sampai login pertama setelah pindah
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login   TEXT
);

-- id = SHA-256 dari token cookie. Token asli tidak pernah disimpan.
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at   TEXT NOT NULL,
  user_agent   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_exp  ON sessions(expires_at);

-- ------------------------------------------------------------
--  Simulasi
-- ------------------------------------------------------------

-- 001 + 004 + 006: satu baris per (user, posisi)
CREATE TABLE user_progress (
  id               TEXT PRIMARY KEY,         -- UUID lama dipertahankan
  user_id          TEXT NOT NULL,
  first_name       TEXT,
  email            TEXT,
  background       TEXT,
  bg_role          TEXT,
  position         TEXT NOT NULL DEFAULT '',
  level            TEXT,
  step             INTEGER NOT NULL DEFAULT 0,
  coins            INTEGER NOT NULL DEFAULT 0,
  tasks_done       INTEGER NOT NULL DEFAULT 0,
  streak           INTEGER NOT NULL DEFAULT 0,
  sim_day          INTEGER NOT NULL DEFAULT 1,
  last_active      TEXT,
  chat_history     TEXT NOT NULL DEFAULT '{}',  -- JSON, bisa ratusan KB (batas baris D1: 2 MB)
  task_submissions TEXT NOT NULL DEFAULT '{}',  -- JSON
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, position)
);
CREATE INDEX idx_user_progress_user ON user_progress(user_id, last_active);

-- Pengganti trigger update_updated_at() di Postgres.
CREATE TRIGGER user_progress_updated_at AFTER UPDATE ON user_progress
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE user_progress SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

-- Dibuat lewat Studio dulu (tidak ada di supabase-migrations); kolom dari lib/profile.ts.
CREATE TABLE user_profiles (
  user_id      TEXT PRIMARY KEY,
  full_name    TEXT,
  gender       TEXT,
  city         TEXT,
  education    TEXT NOT NULL DEFAULT '[]',   -- JSON Education[]
  experience   TEXT NOT NULL DEFAULT '[]',   -- JSON Experience[]
  skills       TEXT NOT NULL DEFAULT '[]',   -- JSON string[] (dulu TEXT[])
  category     TEXT,
  avatar_url   TEXT,
  linkedin_url TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE waitlist (
  id             TEXT PRIMARY KEY,
  user_id        TEXT,
  email          TEXT NOT NULL,
  name           TEXT,
  rating         INTEGER,
  feedback       TEXT,
  wishlist       TEXT NOT NULL DEFAULT '[]', -- JSON string[] (dulu TEXT[])
  position_tried TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_waitlist_user ON waitlist(user_id);

-- 002: pengganti RPC bump_usage -> satu UPSERT ... RETURNING count (lib/rateLimit.ts)
CREATE TABLE api_usage (
  user_id TEXT NOT NULL,
  bucket  TEXT NOT NULL,
  day     TEXT NOT NULL,                     -- 'YYYY-MM-DD' (UTC+7 dihitung di kode)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, day)
);

-- ------------------------------------------------------------
--  Vantara Academy (003)
-- ------------------------------------------------------------

CREATE TABLE lesson_modules (
  id           TEXT PRIMARY KEY,
  position_id  TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  track        TEXT NOT NULL CHECK (track IN ('tools','business')),
  day          INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  npc_id       TEXT NOT NULL DEFAULT 'sup',
  story_intro  TEXT,
  teaser       TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_modules_pos ON lesson_modules(position_id, day, sort_order);

-- video_code menggantikan youtube_video_id: kode video dari pustaka Mas Data
-- (mis. 'excel-t11-2'), diputar lewat Worker video dengan link bertanda.
-- youtube_video_id dipertahankan untuk video yang memang ada di YouTube.
CREATE TABLE lessons (
  id               TEXT PRIMARY KEY,
  module_id        TEXT NOT NULL REFERENCES lesson_modules(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('text','video','mission')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  content_md       TEXT,
  youtube_video_id TEXT,
  video_code       TEXT,
  mission          TEXT,                     -- JSON, rubric tidak pernah ke client
  xp               INTEGER NOT NULL DEFAULT 10,
  is_published     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_lessons_module ON lessons(module_id, sort_order);

CREATE TABLE lesson_progress (
  user_id      TEXT NOT NULL,
  lesson_id    TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  score        INTEGER,
  attempts     INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX idx_lp_lesson ON lesson_progress(lesson_id);

-- ------------------------------------------------------------
--  Observability (005)
-- ------------------------------------------------------------

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT,
  type       TEXT NOT NULL,
  meta       TEXT NOT NULL DEFAULT '{}',     -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_type_time ON events(type, created_at);
CREATE INDEX idx_events_time      ON events(created_at);

-- ------------------------------------------------------------
--  Task season + entitlement (006). File task ada di R2 kantoran-task-files.
-- ------------------------------------------------------------

CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  position_id       TEXT NOT NULL,
  day               INTEGER NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 1,
  title             TEXT NOT NULL,
  teaser            TEXT,
  brief             TEXT NOT NULL,
  context           TEXT,
  task_type         TEXT NOT NULL DEFAULT 'file',
  file_name         TEXT,                    -- kunci objek di R2
  cross_ref         TEXT,
  rubric            TEXT NOT NULL DEFAULT '{}',  -- JSON per level, tidak pernah ke client
  approved_reaction TEXT,
  revision_reaction TEXT,
  is_published      INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tasks_pos_day ON tasks(position_id, day, sort_order);

CREATE TABLE entitlements (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  product    TEXT NOT NULL DEFAULT 'season_1',
  starts_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT,                           -- NULL = seumur hidup
  source     TEXT,                           -- 'midtrans:<order_id>' | 'presale-manual'
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_entitlements_user ON entitlements(user_id, expires_at);

-- Disiapkan untuk Midtrans (GO-LIVE.md bagian B, dulu direncanakan sebagai 007).
CREATE TABLE orders (
  id           TEXT PRIMARY KEY,             -- order_id Midtrans, mis. KT-2026-000123
  user_id      TEXT NOT NULL,
  product      TEXT NOT NULL,
  amount       INTEGER NOT NULL,             -- rupiah
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid','failed','expired','refunded')),
  snap_token   TEXT,
  payment_type TEXT,
  raw          TEXT,                         -- JSON notifikasi terakhir
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at      TEXT
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at);
