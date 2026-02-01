-- ============================================
-- DRIFT Database Schema (Complete)
-- Run this in Supabase SQL Editor
-- Safe to re-run - uses IF NOT EXISTS everywhere
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (synced from Clerk)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- Clerk user_id (e.g. "user_xxxxx")
  org_id TEXT,                            -- Clerk org_id
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'dev' CHECK (role IN ('pm', 'dev', 'designer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_org_id_idx ON users(org_id);

-- ============================================
-- BRIEFS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
  created_by TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS briefs_org_id_idx ON briefs(org_id);
CREATE INDEX IF NOT EXISTS briefs_created_by_idx ON briefs(created_by);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('pm', 'dev', 'designer')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  estimated_hours INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_brief_id_idx ON tasks(brief_id);
CREATE INDEX IF NOT EXISTS tasks_role_idx ON tasks(role);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

-- Add priority column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Add estimated_hours column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE tasks ADD COLUMN estimated_hours INTEGER DEFAULT 2;
  END IF;
END $$;

-- ============================================
-- WORK SESSIONS TABLE (Desktop App Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS work_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'dev',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_sessions_user_idx ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS work_sessions_brief_idx ON work_sessions(brief_id);
CREATE INDEX IF NOT EXISTS work_sessions_status_idx ON work_sessions(status);
CREATE INDEX IF NOT EXISTS work_sessions_org_idx ON work_sessions(org_id);

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('pm', 'dev', 'designer')),
  summary_lines TEXT[] NOT NULL DEFAULT '{}',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  matched_tasks UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed')),
  session_id UUID REFERENCES work_sessions(id),
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submissions_brief_id_idx ON submissions(brief_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);
CREATE INDEX IF NOT EXISTS submissions_user_idx ON submissions(user_id);

-- Add session_id column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE submissions ADD COLUMN session_id UUID REFERENCES work_sessions(id);
  END IF;
END $$;

-- Add ai_analysis column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE submissions ADD COLUMN ai_analysis TEXT;
  END IF;
END $$;

-- Update status check to include 'reviewed'
DO $$
BEGIN
  -- Drop old constraint if exists and create new one
  ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
  ALTER TABLE submissions ADD CONSTRAINT submissions_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'reviewed'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe re-run)
DROP POLICY IF EXISTS "Allow all users access" ON users;
DROP POLICY IF EXISTS "Allow all briefs access" ON briefs;
DROP POLICY IF EXISTS "Allow all tasks access" ON tasks;
DROP POLICY IF EXISTS "Allow all submissions access" ON submissions;
DROP POLICY IF EXISTS "Allow all work_sessions" ON work_sessions;

-- For MVP: allow all authenticated access (refine later with org_id checks)
CREATE POLICY "Allow all users access" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all briefs access" ON briefs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all tasks access" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all submissions access" ON submissions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all work_sessions" ON work_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to upsert user (called from frontend on login)
CREATE OR REPLACE FUNCTION upsert_user(
  p_id TEXT,
  p_org_id TEXT,
  p_email TEXT,
  p_name TEXT,
  p_avatar_url TEXT
)
RETURNS users AS $$
DECLARE
  v_user users;
BEGIN
  INSERT INTO users (id, org_id, email, name, avatar_url, updated_at)
  VALUES (p_id, p_org_id, p_email, p_name, p_avatar_url, NOW())
  ON CONFLICT (id) DO UPDATE SET
    org_id = EXCLUDED.org_id,
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING * INTO v_user;
  
  RETURN v_user;
END;
$$ LANGUAGE plpgsql;

-- Function to update user role
CREATE OR REPLACE FUNCTION update_user_role(p_user_id TEXT, p_role TEXT)
RETURNS users AS $$
DECLARE
  v_user users;
BEGIN
  UPDATE users
  SET role = p_role, updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_user;
  
  RETURN v_user;
END;
$$ LANGUAGE plpgsql;

-- Function to get brief progress
CREATE OR REPLACE FUNCTION get_brief_progress(p_brief_id UUID)
RETURNS TABLE (
  role TEXT,
  total BIGINT,
  done BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.role,
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE t.status = 'done')::BIGINT AS done
  FROM tasks t
  WHERE t.brief_id = p_brief_id
  GROUP BY t.role;
END;
$$ LANGUAGE plpgsql;

-- Function to get project status summary
CREATE OR REPLACE FUNCTION get_project_status(p_brief_id UUID)
RETURNS TABLE (
  total_tasks BIGINT,
  done_tasks BIGINT,
  in_progress_tasks BIGINT,
  todo_tasks BIGINT,
  completion_percent INTEGER,
  total_hours INTEGER,
  completed_hours INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'done')::BIGINT AS done_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT AS in_progress_tasks,
    COUNT(*) FILTER (WHERE status = 'todo')::BIGINT AS todo_tasks,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'done') * 100 / COUNT(*))::INTEGER
      ELSE 0
    END AS completion_percent,
    COALESCE(SUM(estimated_hours), 0)::INTEGER AS total_hours,
    COALESCE(SUM(estimated_hours) FILTER (WHERE status = 'done'), 0)::INTEGER AS completed_hours
  FROM tasks
  WHERE brief_id = p_brief_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERY (check everything exists)
-- ============================================
SELECT 
  'Schema verification' AS check_type,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users') AS users_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'briefs') AS briefs_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'tasks') AS tasks_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'submissions') AS submissions_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'work_sessions') AS work_sessions_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'priority') AS tasks_priority_col,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_hours') AS tasks_hours_col,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'session_id') AS submissions_session_col,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'ai_analysis') AS submissions_analysis_col;
