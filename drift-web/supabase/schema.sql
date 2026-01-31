-- DRIFT Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS TABLE (synced from Clerk)
-- ============================================
create table if not exists users (
  id text primary key,                    -- Clerk user_id (e.g. "user_xxxxx")
  org_id text,                            -- Clerk org_id
  email text,
  name text,
  avatar_url text,
  role text not null default 'dev' check (role in ('pm', 'dev', 'designer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for org queries
create index if not exists users_org_id_idx on users(org_id);

-- ============================================
-- BRIEFS TABLE
-- ============================================
create table if not exists briefs (
  id uuid primary key default uuid_generate_v4(),
  org_id text not null,
  name text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed')),
  created_by text not null,
  content jsonb,
  created_at timestamptz default now()
);

-- Index for org queries
create index if not exists briefs_org_id_idx on briefs(org_id);

-- ============================================
-- TASKS TABLE
-- ============================================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references briefs(id) on delete cascade,
  role text not null check (role in ('pm', 'dev', 'designer')),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz default now()
);

-- Index for brief queries
create index if not exists tasks_brief_id_idx on tasks(brief_id);
create index if not exists tasks_role_idx on tasks(role);

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references briefs(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  role text not null check (role in ('pm', 'dev', 'designer')),
  summary_lines text[] not null default '{}',
  duration_minutes int not null default 0,
  matched_tasks uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Index for brief and status queries
create index if not exists submissions_brief_id_idx on submissions(brief_id);
create index if not exists submissions_status_idx on submissions(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table users enable row level security;
alter table briefs enable row level security;
alter table tasks enable row level security;
alter table submissions enable row level security;

-- Drop existing policies (safe re-run)
drop policy if exists "Allow all users access" on users;
drop policy if exists "Allow all briefs access" on briefs;
drop policy if exists "Allow all tasks access" on tasks;
drop policy if exists "Allow all submissions access" on submissions;

-- For MVP: allow all authenticated access (refine later with org_id checks)
-- Users policies
create policy "Allow all users access" on users
  for all using (true) with check (true);

-- Briefs policies
create policy "Allow all briefs access" on briefs
  for all using (true) with check (true);

-- Tasks policies
create policy "Allow all tasks access" on tasks
  for all using (true) with check (true);

-- Submissions policies
create policy "Allow all submissions access" on submissions
  for all using (true) with check (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to upsert user (called from frontend on login)
create or replace function upsert_user(
  p_id text,
  p_org_id text,
  p_email text,
  p_name text,
  p_avatar_url text
)
returns users as $$
declare
  v_user users;
begin
  insert into users (id, org_id, email, name, avatar_url, updated_at)
  values (p_id, p_org_id, p_email, p_name, p_avatar_url, now())
  on conflict (id) do update set
    org_id = excluded.org_id,
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    updated_at = now()
  returning * into v_user;
  
  return v_user;
end;
$$ language plpgsql;

-- Function to update user role
create or replace function update_user_role(p_user_id text, p_role text)
returns users as $$
declare
  v_user users;
begin
  update users
  set role = p_role, updated_at = now()
  where id = p_user_id
  returning * into v_user;
  
  return v_user;
end;
$$ language plpgsql;

-- Function to get brief progress
create or replace function get_brief_progress(p_brief_id uuid)
returns table (
  role text,
  total bigint,
  done bigint
) as $$
begin
  return query
  select 
    t.role,
    count(*)::bigint as total,
    count(*) filter (where t.status = 'done')::bigint as done
  from tasks t
  where t.brief_id = p_brief_id
  group by t.role;
end;
$$ language plpgsql;

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert sample data:
/*
insert into briefs (org_id, name, description, status, created_by) values
('org_demo', 'Apple Pay Checkout', 'Implement Apple Pay as a checkout option for faster mobile payments.', 'active', 'user_sarah');

-- Get the brief id for tasks
do $$
declare
  v_brief_id uuid;
begin
  select id into v_brief_id from briefs where name = 'Apple Pay Checkout' limit 1;
  
  -- PM Tasks
  insert into tasks (brief_id, role, title, description, status) values
  (v_brief_id, 'pm', 'Define acceptance criteria', 'Document all acceptance criteria for Apple Pay feature', 'done'),
  (v_brief_id, 'pm', 'Stakeholder alignment', 'Get sign-off from finance and legal teams', 'in_progress'),
  (v_brief_id, 'pm', 'Launch checklist', 'Prepare go-live checklist and rollback plan', 'todo');
  
  -- Dev Tasks
  insert into tasks (brief_id, role, title, description, status) values
  (v_brief_id, 'dev', 'Stripe webhook setup', 'Implement webhook handler for Apple Pay events', 'done'),
  (v_brief_id, 'dev', 'Payment API endpoint', 'Create POST /api/payments/apple-pay endpoint', 'in_progress'),
  (v_brief_id, 'dev', 'Error handling', 'Add error handling for failed payments', 'todo'),
  (v_brief_id, 'dev', 'Unit tests', 'Write tests for payment flow', 'todo');
  
  -- Designer Tasks
  insert into tasks (brief_id, role, title, description, status) values
  (v_brief_id, 'designer', 'Button component', 'Design Apple Pay button following Apple guidelines', 'done'),
  (v_brief_id, 'designer', 'Error states', 'Design error and loading states', 'in_progress'),
  (v_brief_id, 'designer', 'Success animation', 'Create success confirmation animation', 'todo');
end $$;
*/
