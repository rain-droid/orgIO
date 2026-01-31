const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface GenerateBriefRequest {
  name: string
  description?: string
  role: 'pm' | 'dev' | 'designer'
}

interface AnalyzeSubmissionRequest {
  brief_id: string
  summary: string
  duration_minutes: number
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
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  async generateBriefContent(request: GenerateBriefRequest) {
    return this.fetch<{
      role: string
      content: {
        user_stories?: Array<{ title: string; acceptance_criteria: string[] }>
        timeline?: Array<{ label: string; progress: number }>
        tasks?: { todo: string[]; in_progress: string[]; done: string[] }
        architecture?: Array<{ label: string }>
        api_endpoints?: Array<{ method: string; path: string; request: string; response: string }>
        code_snippets?: string[]
        tech_stack?: string[]
        user_flow?: string[]
        components?: Array<{ name: string; height: string; radius: string; color: string }>
        states?: string[]
      }
    }>('/api/brief/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async analyzeSubmission(request: AnalyzeSubmissionRequest) {
    return this.fetch<{
      matched_tasks: string[]
      suggestions: string[]
      confidence: number
    }>('/api/submission/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async healthCheck() {
    return this.fetch<{ status: string }>('/health')
  }
}

export const api = new DriftAPI()
