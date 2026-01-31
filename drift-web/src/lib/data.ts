import { supabase } from './supabaseClient'
import type { Brief, BriefContent, Role, Submission, Task, User } from '../types'

// ============================================
// USER FUNCTIONS
// ============================================

export async function syncUser(input: {
  id: string
  orgId: string | null
  email: string
  name: string
  avatarUrl: string | null
}): Promise<User> {
  const { data, error } = await supabase.rpc('upsert_user', {
    p_id: input.id,
    p_org_id: input.orgId,
    p_email: input.email,
    p_name: input.name,
    p_avatar_url: input.avatarUrl,
  })

  if (error) throw error
  return {
    id: data.id,
    orgId: data.org_id,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatar_url,
    role: data.role as Role,
  }
}

export async function fetchUser(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, org_id, email, name, avatar_url, role')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return {
    id: data.id,
    orgId: data.org_id,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatar_url,
    role: data.role as Role,
  }
}

export async function updateUserRole(userId: string, role: Role): Promise<User> {
  const { data, error } = await supabase.rpc('update_user_role', {
    p_user_id: userId,
    p_role: role,
  })

  if (error) throw error
  return {
    id: data.id,
    orgId: data.org_id,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatar_url,
    role: data.role as Role,
  }
}

export async function fetchOrgUsers(orgId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, org_id, email, name, avatar_url, role')
    .eq('org_id', orgId)

  if (error) throw error
  return (data ?? []).map((item) => ({
    id: item.id,
    orgId: item.org_id,
    email: item.email,
    name: item.name,
    avatarUrl: item.avatar_url,
    role: item.role as Role,
  }))
}

// ============================================
// BRIEF FUNCTIONS
// ============================================

export async function fetchBriefs(orgId: string) {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, org_id, name, description, status, created_by, content')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((item) => ({
    id: item.id,
    orgId: item.org_id,
    name: item.name,
    description: item.description ?? '',
    status: item.status,
    createdBy: item.created_by ?? 'Unknown',
    content: (item.content as BriefContent | null) ?? null,
  })) as Brief[]
}

export async function createBrief(input: {
  orgId: string
  name: string
  description: string
  createdBy: string
}) {
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      org_id: input.orgId,
      name: input.name,
      description: input.description,
      status: 'active',
      created_by: input.createdBy,
    })
    .select('id, org_id, name, description, status, created_by, content')
    .single()

  if (error) throw error
  return {
    id: data.id,
    orgId: data.org_id,
    name: data.name,
    description: data.description ?? '',
    status: data.status,
    createdBy: data.created_by ?? input.createdBy,
    content: (data.content as BriefContent | null) ?? null,
  } as Brief
}

export async function deleteBrief(briefId: string) {
  const { error } = await supabase
    .from('briefs')
    .delete()
    .eq('id', briefId)

  if (error) throw error
}

export async function fetchTasks(briefIds: string[]) {
  if (briefIds.length === 0) return [] as Task[]
  const { data, error } = await supabase
    .from('tasks')
    .select('id, brief_id, role, title, description, status')
    .in('brief_id', briefIds)

  if (error) throw error
  return (data ?? []).map((item) => ({
    id: item.id,
    briefId: item.brief_id,
    role: item.role as Role,
    title: item.title,
    description: item.description ?? '',
    status: item.status,
  })) as Task[]
}

export async function fetchSubmissions(briefIds: string[]) {
  if (briefIds.length === 0) return [] as Submission[]
  const { data, error } = await supabase
    .from('submissions')
    .select('id, brief_id, user_id, user_name, role, summary_lines, duration_minutes, matched_tasks, status')
    .in('brief_id', briefIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((item) => ({
    id: item.id,
    briefId: item.brief_id,
    userId: item.user_id,
    userName: item.user_name,
    role: item.role as Role,
    summaryLines: (item.summary_lines as string[]) ?? [],
    durationMinutes: item.duration_minutes ?? 0,
    matchedTasks: (item.matched_tasks as string[]) ?? [],
    status: item.status,
  })) as Submission[]
}

export async function createSubmission(input: {
  briefId: string
  userId: string
  userName: string
  role: Role
  summaryLines: string[]
  durationMinutes: number
  matchedTasks: string[]
}) {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      brief_id: input.briefId,
      user_id: input.userId,
      user_name: input.userName,
      role: input.role,
      summary_lines: input.summaryLines,
      duration_minutes: input.durationMinutes,
      matched_tasks: input.matchedTasks,
      status: 'pending',
    })
    .select('id, brief_id, user_id, user_name, role, summary_lines, duration_minutes, matched_tasks, status')
    .single()

  if (error) throw error
  return {
    id: data.id,
    briefId: data.brief_id,
    userId: data.user_id,
    userName: data.user_name,
    role: data.role as Role,
    summaryLines: (data.summary_lines as string[]) ?? [],
    durationMinutes: data.duration_minutes ?? 0,
    matchedTasks: (data.matched_tasks as string[]) ?? [],
    status: data.status,
  } as Submission
}

export async function updateSubmissionStatus(submissionId: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.from('submissions').update({ status }).eq('id', submissionId)
  if (error) throw error
}

export async function markTasksDone(taskIds: string[]) {
  if (taskIds.length === 0) return
  const { error } = await supabase.from('tasks').update({ status: 'done' }).in('id', taskIds)
  if (error) throw error
}
