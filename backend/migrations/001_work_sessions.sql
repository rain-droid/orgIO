-- ============================================
-- DRIFT: Work Sessions Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create work_sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT,
    brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'dev',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_brief ON work_sessions(brief_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_work_sessions_org ON work_sessions(org_id);

-- 3. Enable RLS
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (allow all for now, backend handles auth)
DROP POLICY IF EXISTS "Allow all work_sessions" ON work_sessions;
CREATE POLICY "Allow all work_sessions" ON work_sessions
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Add session_id to submissions table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE submissions ADD COLUMN session_id UUID REFERENCES work_sessions(id);
    END IF;
END $$;

-- 6. Verify tables exist
SELECT 'work_sessions created' AS status, COUNT(*) AS rows FROM work_sessions
UNION ALL
SELECT 'submissions has session_id' AS status, 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'submissions' AND column_name = 'session_id'
       ) THEN 1 ELSE 0 END AS rows;
