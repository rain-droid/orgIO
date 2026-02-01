import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'
import { AICopilot } from '@/components/ai/AICopilot'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

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

export function ProjectWorkspace({ brief, userRole, onBack }: ProjectWorkspaceProps) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'spec' | 'tasks'>('overview')
  const [spec, setSpec] = useState<GeneratedSpec | null>(null)
  const [tasks, setTasks] = useState<GeneratedTasks | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedSpec, setCopiedSpec] = useState(false)

  const roleConfig = {
    pm: {
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/30',
      icon: Users,
      label: 'Product Manager'
    },
    dev: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: Code,
      label: 'Developer'
    },
    designer: {
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30',
      icon: Palette,
      label: 'Designer'
    }
  }

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

  const priorityColors = {
    high: 'bg-red-500/10 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="size-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{brief.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", config.bg, config.color)}>
                    {config.label}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <div className={cn("size-2 rounded-full", 
                      brief.status === 'active' ? 'bg-emerald-500' : 'bg-muted'
                    )} />
                    {brief.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateTasks}
                disabled={loading}
              >
                {loading && activeTab === 'tasks' ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <ListTodo className="size-4 mr-2" />
                )}
                Generate Tasks
              </Button>
              <Button
                size="sm"
                onClick={generateSpec}
                disabled={loading}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                {loading && activeTab === 'spec' ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="size-4 mr-2" />
                )}
                Generate Spec
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: Layout },
            { id: 'spec', label: 'Specification', icon: FileText },
            { id: 'tasks', label: 'Tasks', icon: ListTodo }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Project Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="size-5" />
                  Project Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <p className="font-medium">{brief.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Description</label>
                    <p className="text-muted-foreground">
                      {brief.description || 'No description provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={generateSpec}
                  disabled={loading}
                  className={cn(
                    "p-6 rounded-xl border-2 border-dashed text-left transition-all",
                    "hover:border-violet-500/50 hover:bg-violet-500/5",
                    "group"
                  )}
                >
                  <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Sparkles className="size-6 text-violet-500" />
                  </div>
                  <h3 className="font-semibold mb-1">Generate Full Spec</h3>
                  <p className="text-sm text-muted-foreground">
                    AI-powered {userRole.toUpperCase()} specification with all details
                  </p>
                </button>

                <button
                  onClick={generateTasks}
                  disabled={loading}
                  className={cn(
                    "p-6 rounded-xl border-2 border-dashed text-left transition-all",
                    "hover:border-emerald-500/50 hover:bg-emerald-500/5",
                    "group"
                  )}
                >
                  <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ListTodo className="size-6 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold mb-1">Generate Tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Break down project into actionable tasks
                  </p>
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Role Info */}
              <div className={cn("p-6 rounded-xl border", config.border, config.bg)}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("size-10 rounded-lg flex items-center justify-center", config.bg)}>
                    <RoleIcon className={cn("size-5", config.color)} />
                  </div>
                  <div>
                    <p className={cn("font-semibold", config.color)}>{config.label}</p>
                    <p className="text-xs text-muted-foreground">Current View</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {userRole === 'pm' && 'User stories, timelines, and product metrics'}
                  {userRole === 'dev' && 'Architecture, APIs, and code examples'}
                  {userRole === 'designer' && 'User flows, components, and design systems'}
                </p>
              </div>

              {/* Tips */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="size-4 text-yellow-500" />
                  Quick Tips
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    Use the AI Copilot (bottom right) for questions
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    Generated specs can be copied to clipboard
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    Tasks include time estimates and priorities
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Spec Tab */}
        {activeTab === 'spec' && (
          <div className="max-w-4xl mx-auto">
            {!spec ? (
              <div className="p-12 rounded-xl border-2 border-dashed border-border text-center">
                <Sparkles className="size-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Specification Generated</h3>
                <p className="text-muted-foreground mb-6">
                  Click "Generate Spec" to create an AI-powered {userRole.toUpperCase()} specification
                </p>
                <Button onClick={generateSpec} disabled={loading}>
                  {loading ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="size-4 mr-2" />
                  )}
                  Generate Specification
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">
                    {spec.role.toUpperCase()} Specification
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copySpec}>
                      {copiedSpec ? (
                        <>
                          <Check className="size-4 mr-2 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={generateSpec} disabled={loading}>
                      <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="p-6 rounded-xl border border-border bg-card">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {spec.spec}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="max-w-4xl mx-auto">
            {!tasks ? (
              <div className="p-12 rounded-xl border-2 border-dashed border-border text-center">
                <ListTodo className="size-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Tasks Generated</h3>
                <p className="text-muted-foreground mb-6">
                  Click "Generate Tasks" to break down this project into actionable items
                </p>
                <Button onClick={generateTasks} disabled={loading}>
                  {loading ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <ListTodo className="size-4 mr-2" />
                  )}
                  Generate Tasks
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                {tasks.summary && (
                  <div className="p-4 rounded-xl border border-border bg-muted/50">
                    <p className="text-sm">{tasks.summary}</p>
                  </div>
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
                        <div key={i} className="p-4 rounded-xl border border-border bg-card">
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
                    <Button variant="outline" size="sm" onClick={generateTasks} disabled={loading}>
                      <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                      Regenerate
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {tasks.tasks?.map((task, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {i + 1}
                            </div>
                            <h4 className="font-medium">{task.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium border",
                              priorityColors[task.priority]
                            )}>
                              {task.priority}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" />
                              {task.estimated_hours}h
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground ml-9">
                          {task.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* AI Copilot */}
      <AICopilot
        projectName={brief.name}
        projectDescription={brief.description || ''}
        userRole={userRole}
      />
    </div>
  )
}
