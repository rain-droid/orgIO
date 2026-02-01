export type Role = 'pm' | 'dev' | 'designer'

export interface User {
  id: string
  orgId: string | null
  email: string
  name: string
  avatarUrl: string | null
  role: Role | null  // null until user completes onboarding
}

export interface Brief {
  id: string
  orgId: string
  name: string
  description: string
  status: 'planning' | 'active' | 'completed'
  createdBy: string
  content?: BriefContent | null
}

export interface Task {
  id: string
  briefId: string
  role: Role
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
}

export interface Submission {
  id: string
  briefId: string
  userId: string
  userName: string
  role: Role
  summaryLines: string[]
  durationMinutes: number
  matchedTasks: string[]
  status: 'pending' | 'approved' | 'rejected'
}

export interface BriefContent {
  userStories: { title: string; acceptance: string[] }[]
  timeline: { label: string; progress: number }[]
  architecture: { label: string }[]
  apiEndpoints: { title: string; request: string; response: string }[]
  codeSnippets: string[]
  userFlow: string[]
  componentSpec: { name: string; height: string; radius: string; color: string }[]
  states: string[]
}
