-- Observability first-party: event funnel + error client dalam satu tabel.
-- Menjawab "di mana user berhenti" (analytics) dan "error apa yang terjadi di
-- browser user" (error tracking) tanpa layanan eksternal.
-- Jalankan di Supabase Studio → SQL Editor.
-- Kode aman di-deploy SEBELUM migration ini (insert gagal = diabaikan diam-diam).

CREATE TABLE IF NOT EXISTS events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type_time ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_time ON events (created_at DESC);

-- Hanya service role (via API) yang menyentuh tabel ini
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service events" ON events;
CREATE POLICY "service events" ON events FOR ALL TO service_role USING (true);

-- Housekeeping opsional (jalankan berkala / jadwalkan nanti):
-- DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';
