import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'
import { AICopilot } from '@/components/ai/AICopilot'
import type { Brief, Role } from '@/types'
import { 
  ArrowLeft, 
  Sparkles, 
  Loader2, 
  RefreshCw,
  FileText,
  Code,
  Palette,
  ListTodo,
  GitBranch,
  Layout,
  Clock,
  Users,
  Zap,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react'

interface ProjectWorkspaceProps {
  brief: Brief
  userRole: Role
  onBack: () => void
}

interface GeneratedSpec {
  spec: string
  role: string
  project_name: string
}

interface GeneratedTasks {
  tasks: Array<{
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimated_hours: number
    role: string
  }>
  milestones: Array<{
    name: string
    tasks: string[]
    estimated_days: number
  }>
  summary: string
}

const roleConfig = {
  pm: { icon: Users, label: 'Product Manager' },
  dev: { icon: Code, label: 'Developer' },
  designer: { icon: Palette, label: 'Designer' },
}

export function ProjectWorkspace({ brief, userRole, onBack }: ProjectWorkspaceProps) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'spec' | 'tasks'>('overview')
  const [spec, setSpec] = useState<GeneratedSpec | null>(null)
  const [tasks, setTasks] = useState<GeneratedTasks | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedSpec, setCopiedSpec] = useState(false)

  const config = roleConfig[userRole]
  const RoleIcon = config.icon

  const generateSpec = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (token) api.setToken(token)
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate/spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: brief.name,
          description: brief.description || '',
          role: userRole
        })
      })
      
      const data = await response.json()
      setSpec(data)
      setActiveTab('spec')
    } catch (error) {
      console.error('Failed to generate spec:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTasks = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (token) api.setToken(token)
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: brief.name,
          description: brief.description || '',
          role: userRole
        })
      })
      
      const data = await response.json()
      setTasks(data)
      setActiveTab('tasks')
    } catch (error) {
      console.error('Failed to generate tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const copySpec = async () => {
    if (spec?.spec) {
      await navigator.clipboard.writeText(spec.spec)
      setCopiedSpec(true)
      setTimeout(() => setCopiedSpec(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-muted rounded transition-colors">
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">{brief.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="px-2 py-0.5 border rounded text-xs font-medium uppercase tracking-wide">
                    {config.label}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <div className={`size-2 rounded-full ${brief.status === 'active' ? 'bg-foreground' : 'bg-muted'}`} />
                    {brief.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generateTasks}
                disabled={loading}
                className="btn-secondary px-4 py-2 rounded text-sm flex items-center gap-2"
              >
                {loading && activeTab === 'tasks' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ListTodo className="size-4" />
                )}
                Tasks
              </button>
              <button
                onClick={generateSpec}
                disabled={loading}
                className="btn-primary px-4 py-2 rounded text-sm flex items-center gap-2"
              >
                {loading && activeTab === 'spec' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Spec
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Layout },
            { id: 'spec', label: 'Specification', icon: FileText },
            { id: 'tasks', label: 'Tasks', icon: ListTodo }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[2px] transition-all ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3 animate-fadeIn">
            <div className="lg:col-span-2 space-y-6">
              {/* Project Info */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-6">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="size-5" />
                    Project Details
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
                      <p className="font-medium mt-1">{brief.name}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
                      <p className="text-muted-foreground mt-1">{brief.description || 'No description provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={generateSpec}
                  disabled={loading}
                  className="relative group text-left"
                >
                  <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                  <div className="border bg-background p-6 card-hover">
                    <div className="size-12 rounded bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-colors">
                      <Sparkles className="size-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Generate Full Spec</h3>
                    <p className="text-sm text-muted-foreground">
                      AI-powered {userRole.toUpperCase()} specification
                    </p>
                  </div>
                </button>

                <button
                  onClick={generateTasks}
                  disabled={loading}
                  className="relative group text-left"
                >
                  <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                  <div className="border bg-background p-6 card-hover">
                    <div className="size-12 rounded bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-colors">
                      <ListTodo className="size-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Generate Tasks</h3>
                    <p className="text-sm text-muted-foreground">
                      Break down into actionable items
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Role Info */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded bg-foreground text-background flex items-center justify-center">
                      <RoleIcon className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{config.label}</p>
                      <p className="text-xs text-muted-foreground">Current View</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {userRole === 'pm' && 'User stories, timelines, and product metrics'}
                    {userRole === 'dev' && 'Architecture, APIs, and code examples'}
                    {userRole === 'designer' && 'User flows, components, and design systems'}
                  </p>
                </div>
              </div>

              {/* Tips */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="size-4" />
                    Quick Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="size-4 mt-0.5 shrink-0" />
                      Use the AI Copilot for questions
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="size-4 mt-0.5 shrink-0" />
                      Specs can be copied to clipboard
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="size-4 mt-0.5 shrink-0" />
                      Tasks include time estimates
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spec Tab */}
        {activeTab === 'spec' && (
          <div className="max-w-3xl mx-auto animate-fadeIn">
            {!spec ? (
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-12 text-center">
                  <Sparkles className="size-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">No Specification Generated</h3>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Generate an AI-powered {userRole.toUpperCase()} specification
                  </p>
                  <button onClick={generateSpec} disabled={loading} className="btn-primary px-6 py-3 rounded text-sm">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Generate Specification'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{spec.role.toUpperCase()} Specification</h2>
                  <div className="flex gap-2">
                    <button onClick={copySpec} className="btn-secondary px-3 py-2 rounded text-sm flex items-center gap-2">
                      {copiedSpec ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
                    </button>
                    <button onClick={generateSpec} disabled={loading} className="btn-secondary px-3 py-2 rounded text-sm flex items-center gap-2">
                      <RefreshCw className={`size-4 ${loading && 'animate-spin'}`} />
                      Regenerate
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                  <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                  <div className="border bg-background p-6">
                    <div className="whitespace-pre-wrap text-sm">{spec.spec}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="max-w-3xl mx-auto animate-fadeIn">
            {!tasks ? (
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-12 text-center">
                  <ListTodo className="size-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">No Tasks Generated</h3>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Break down this project into actionable items
                  </p>
                  <button onClick={generateTasks} disabled={loading} className="btn-primary px-6 py-3 rounded text-sm">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : 'Generate Tasks'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                {tasks.summary && (
                  <div className="p-4 border rounded bg-muted/30 text-sm">{tasks.summary}</div>
                )}

                {/* Milestones */}
                {tasks.milestones?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <GitBranch className="size-5" />
                      Milestones
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {tasks.milestones.map((milestone, i) => (
                        <div key={i} className="relative">
                          <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                          <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                          <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                          <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                          <div className="border bg-background p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium">{milestone.name}</h4>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                {milestone.estimated_days}d
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {milestone.tasks?.length || 0} tasks
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ListTodo className="size-5" />
                      Tasks ({tasks.tasks?.length || 0})
                    </h3>
                    <button onClick={generateTasks} disabled={loading} className="btn-secondary px-3 py-2 rounded text-sm flex items-center gap-2">
                      <RefreshCw className={`size-4 ${loading && 'animate-spin'}`} />
                      Regenerate
                    </button>
                  </div>
                  <div className="space-y-3">
                    {tasks.tasks?.map((task, i) => (
                      <div key={i} className="relative">
                        <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                        <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                        <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                        <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                        <div className="border bg-background p-4 card-hover">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="size-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                                {i + 1}
                              </div>
                              <h4 className="font-medium">{task.title}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wide ${
                                task.priority === 'high' ? 'bg-foreground text-background' :
                                task.priority === 'medium' ? 'bg-muted text-foreground' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {task.priority}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                {task.estimated_hours}h
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground ml-9">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AICopilot
        projectName={brief.name}
        projectDescription={brief.description || ''}
        userRole={userRole}
      />
    </div>
  )
}
