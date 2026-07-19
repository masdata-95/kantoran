-- Task per hari pindah ke database (konten season rilis tanpa deploy) + fondasi
-- monetisasi (entitlements, siap dipakai webhook Xendit ATAU pre-sale manual).
-- Jalankan di Supabase Studio → SQL Editor.

-- 1) Tabel tasks — satu baris per (posisi, hari). Rubric JSONB per LEVEL
--    ({intern:{...}, junior:{...}, mid:{...}}) dan TIDAK PERNAH dikirim ke client.
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  position_id TEXT NOT NULL,
  day INT NOT NULL,
  sort_order INT DEFAULT 1,
  title TEXT NOT NULL,
  teaser TEXT,                     -- tampil saat terkunci (umpan premium)
  brief TEXT NOT NULL,             -- suara supervisor, dikirim saat terbuka
  context TEXT,                    -- konteks bisnis singkat
  task_type TEXT NOT NULL DEFAULT 'file',  -- file | text | sql | chat
  file_name TEXT,                  -- nama objek di bucket task-files (task_type=file)
  cross_ref TEXT,                  -- rujukan divisi lain (interkoneksi cerita)
  rubric JSONB NOT NULL DEFAULT '{}',
  approved_reaction TEXT,
  revision_reaction TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_pos_day ON tasks (position_id, day, sort_order);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service tasks" ON tasks;
CREATE POLICY "service tasks" ON tasks FOR ALL TO service_role USING (true);

-- 2) Tabel entitlements — siapa boleh akses konten premium (day >= 2).
--    Diisi oleh: webhook Xendit (nanti) ATAU insert manual di Studio (pre-sale
--    early-bird sekarang): INSERT INTO entitlements (user_id, product, expires_at, source)
--    VALUES ('<uid>', 'season_1', NOW() + INTERVAL '90 days', 'presale-manual');
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'season_1',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,          -- NULL = seumur hidup
  source TEXT,                     -- 'xendit:<invoice_id>' | 'presale-manual' | dst
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements (user_id, expires_at);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service entitlements" ON entitlements;
CREATE POLICY "service entitlements" ON entitlements FOR ALL TO service_role USING (true);

-- 3) sim_day di user_progress — hari simulasi yang sedang dijalani per run.
--    Hari-1 selesai (step 10) + punya entitlement → sim_day naik (mekanik season).
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS sim_day INT DEFAULT 1;

-- 4) Bucket privat untuk file task premium — file day >= 2 TIDAK boleh di public/
--    (bisa diunduh siapa pun tanpa bayar). Disajikan via /api/task-file yang
--    mengecek entitlement. Tanpa policy tambahan = hanya service role yang akses.
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', false)
ON CONFLICT (id) DO NOTHING;
