const API_URL = import.meta.env.VITE_API_URL || ''

interface CreateBriefRequest {
  name: string
  description?: string
}

interface SubmitWorkRequest {
  briefId: string
  userId: string
  userName: string
  role: 'pm' | 'dev' | 'designer'
  summary: string[]
  duration: number
  activities?: Array<{
    timestamp: string
    action: string
    context?: string
  }>
}

interface ViewContent {
  // PM
  user_stories?: Array<{ title: string; acceptance_criteria: string[] }>
  timeline?: Array<{ label: string; progress: number }>
  tasks?: { todo: string[]; in_progress: string[]; done: string[] }
  // Dev
  architecture?: Array<{ label: string }>
  api_endpoints?: Array<{ method: string; path: string; request: string; response: string }>
  code_snippets?: string[]
  tech_stack?: string[]
  // Designer
  user_flow?: string[]
  components?: Array<{ name: string; height: string; radius: string; color: string }>
  states?: string[]
}

class DriftAPI {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail?.message || `API Error: ${response.status}`)
    }

    return response.json()
  }

  // Create a new brief with AI-generated tasks
  async createBrief(request: CreateBriefRequest) {
    return this.fetch<{
      id: string
      name: string
      description: string
      status: string
      tasks: Array<{
        id: string
        role: string
        title: string
        description: string
        status: string
      }>
    }>('/api/briefs', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // Get brief details
  async getBrief(briefId: string) {
    return this.fetch<{
      id: string
      name: string
      description: string
      status: string
      tasks: Array<{
        id: string
        role: string
        title: string
        description: string
        status: string
      }>
    }>(`/api/briefs/${briefId}`)
  }

  // Get role-specific view content (Generative UI)
  async getBriefView(briefId: string, role: 'pm' | 'dev' | 'designer') {
    const response = await this.fetch<{
      role: string
      components: Array<{
        type: string
        data: unknown
      }>
    }>(`/api/briefs/${briefId}/view?role=${role}`)
    
    // Transform components array to flat content object for frontend compatibility
    const content: ViewContent = {}
    for (const comp of response.components) {
      if (comp.type === 'kanban') content.tasks = comp.data as ViewContent['tasks']
      else if (comp.type === 'user_stories') content.user_stories = comp.data as ViewContent['user_stories']
      else if (comp.type === 'timeline') content.timeline = comp.data as ViewContent['timeline']
      else if (comp.type === 'architecture') content.architecture = comp.data as ViewContent['architecture']
      else if (comp.type === 'api_specs') content.api_endpoints = comp.data as ViewContent['api_endpoints']
      else if (comp.type === 'code_examples') content.code_snippets = comp.data as ViewContent['code_snippets']
      else if (comp.type === 'user_flow') content.user_flow = comp.data as ViewContent['user_flow']
      else if (comp.type === 'components') content.components = comp.data as ViewContent['components']
      else if (comp.type === 'states') content.states = comp.data as ViewContent['states']
    }
    
    return { role: response.role, content }
  }

  // Get tasks for a brief
  async getTasks(briefId: string, role?: 'pm' | 'dev' | 'designer', status?: 'todo' | 'in_progress' | 'done') {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    const query = params.toString() ? `?${params.toString()}` : ''
    
    return this.fetch<{
      tasks: Array<{
        id: string
        role: string
        title: string
        description: string
        status: string
      }>
      total: number
    }>(`/api/briefs/${briefId}/tasks${query}`)
  }

  // Submit work session
  async submitWork(request: SubmitWorkRequest) {
    return this.fetch<{
      id: string
      brief_id: string
      user_id: string
      summary: string
      matched_tasks: Array<{
        task_id: string
        confidence: number
      }>
      status: string
    }>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({
        brief_id: request.briefId,
        user_id: request.userId,
        user_name: request.userName,
        role: request.role,
        summary: request.summary,
        duration: request.duration,
        activities: request.activities || [],
      }),
    })
  }

  // Get submission details
  async getSubmission(submissionId: string) {
    return this.fetch<{
      id: string
      brief_id: string
      user_id: string
      summary: string
      matched_tasks: Array<{ task_id: string; confidence: number }>
      status: string
    }>(`/api/submissions/${submissionId}`)
  }

  // Update submission status (approve/reject)
  async updateSubmission(submissionId: string, status: 'approved' | 'rejected') {
    return this.fetch<{
      id: string
      status: string
    }>(`/api/submissions/${submissionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // Health check
  async healthCheck() {
    return this.fetch<{ 
      status: string
      service: string
      version: string
      agents: Record<string, string>
    }>('/health')
  }

  // Legacy: Generate brief content (for backwards compatibility)
  // Maps to the new getBriefView endpoint
  async generateBriefContent(request: { name: string; description: string; role: 'pm' | 'dev' | 'designer'; briefId?: string }) {
    // If we have a briefId, use the new endpoint
    if (request.briefId) {
      return this.getBriefView(request.briefId, request.role)
    }
    
    // Otherwise, create brief first then get view
    const brief = await this.createBrief({
      name: request.name,
      description: request.description,
    })
    
    return this.getBriefView(brief.id, request.role)
  }
}

export const api = new DriftAPI()
