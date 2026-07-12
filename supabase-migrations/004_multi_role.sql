-- 004: Multi-role — satu baris progress per (user, posisi) + kolom level jenjang
-- Jalankan manual di Supabase Studio SQL Editor.

-- 1. Kolom level (jenjang yang dipilih user saat apply: intern_magang | intern | junior | mid)
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS level TEXT;

-- 2. Baris lama tanpa posisi tidak bisa ikut constraint komposit — normalisasi dulu
UPDATE user_progress SET position = '' WHERE position IS NULL;
ALTER TABLE user_progress ALTER COLUMN position SET DEFAULT '';
ALTER TABLE user_progress ALTER COLUMN position SET NOT NULL;

-- 3. Ganti unique per-user menjadi unique per (user, posisi)
ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_user_id_key;
ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_user_position_key UNIQUE (user_id, position);

-- 4. Index bantu untuk listing hub karir (ambil semua run milik satu user)
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
