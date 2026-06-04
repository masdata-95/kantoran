-- Hanya buat table waitlist (yang belum ada)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  name TEXT,
  rating INTEGER,
  feedback TEXT,
  wishlist TEXT[],
  position_tried TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all" ON waitlist 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable service role waitlist" ON waitlist 
  FOR ALL TO service_role USING (true);

-- Tambahkan kolom category ke user_profiles kalau belum ada
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS category TEXT;