-- Run this in Supabase SQL Editor
-- Go to: supabase.com/dashboard/project/owgxrhtmljwjxzvjcdlt/sql

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  first_name TEXT,
  email TEXT,
  background TEXT,
  bg_role TEXT,
  position TEXT,
  step INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  tasks_done INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  chat_history JSONB DEFAULT '{}',
  task_submissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own data
CREATE POLICY "Users can manage own progress" ON user_progress
  FOR ALL USING (auth.uid()::text = user_id);

-- Allow service role full access
CREATE POLICY "Service role full access" ON user_progress
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
