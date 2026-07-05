-- Rate limiting per user per hari — atomic counter di Postgres.
-- Dipilih karena bekerja identik di Vercel maupun Cloudflare Workers Free
-- (state in-memory tidak bisa diandalkan di runtime serverless).
-- Jalankan di Supabase Studio → SQL Editor.

CREATE TABLE IF NOT EXISTS api_usage (
  user_id TEXT NOT NULL,
  bucket  TEXT NOT NULL,
  day     DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, day)
);

-- Service role saja yang menyentuh tabel ini (via RPC di bawah)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Naikkan counter secara atomic; TRUE = masih di bawah limit, FALSE = limit tercapai
CREATE OR REPLACE FUNCTION bump_usage(uid TEXT, b TEXT, max_count INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE c INT;
BEGIN
  INSERT INTO api_usage (user_id, bucket, day, count)
  VALUES (uid, b, CURRENT_DATE, 1)
  ON CONFLICT (user_id, bucket, day)
  DO UPDATE SET count = api_usage.count + 1
  RETURNING count INTO c;
  RETURN c <= max_count;
END $$;

-- Bersihkan data lama sesekali (jalankan manual atau via pg_cron kalau diaktifkan):
-- DELETE FROM api_usage WHERE day < CURRENT_DATE - INTERVAL '7 days';
