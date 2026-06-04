-- Run this in Supabase SQL Editor
-- Create user_profiles table (separate from user_progress)

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  full_name TEXT,
  gender TEXT,
  city TEXT,
  education JSONB DEFAULT '[]',
  experience JSONB DEFAULT '[]',
  skills TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for service role" ON user_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

-- Waitlist table
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
CREATE POLICY "Enable insert for all" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable service role" ON waitlist FOR ALL TO service_role USING (true);
