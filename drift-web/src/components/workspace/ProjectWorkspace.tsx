import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'
import type { Brief, Role } from '@/types'
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw,
  Code,
  Palette,
  Clock,
  Users,
  CheckCircle2,
  Circle,
  Play,
  MessageSquare,
  Send,
  AlertTriangle,
  Sparkles,
  Bell,
  X
} from 'lucide-react'

interface ProjectWorkspaceProps {
  brief: Brief
  userRole: Role
  onBack: () => void
}

interface Task {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  status: 'todo' | 'in_progress' | 'done'
  wasRecentlyUpdated?: boolean
}

interface SessionUpdate {
  sessionId: string
  briefId: string
  updatedTaskIds: string[]
  newTaskIds: string[]
  issues: string[]
  aiSummary: string
  timestamp: Date
}

const roleConfig = {
  pm: { icon: Users, label: 'Product Manager', color: 'text-blue-500' },
  dev: { icon: Code, label: 'Developer', color: 'text-green-500' },
  designer: { icon: Palette, label: 'Designer', color: 'text-purple-500' },
}

export function ProjectWorkspace({ brief, userRole, onBack }: ProjectWorkspaceProps) {
  const { getToken } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])
  const [chatLoading, setChatLoading] = useState(false)

  const config = roleConfig[userRole]
  const RoleIcon = config.icon

  // Auto-generate tasks on mount if none exist
  useEffect(() => {
    if (tasks.length === 0) {
      generateTasks()
    }
  }, [])

  const generateTasks = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (token) api.setToken(token)
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate/tasks`, {
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
      const generatedTasks = (data.tasks || []).map((t: any, i: number) => ({
        id: `task-${i}`,
        title: t.title,
        description: t.description,
        priority: t.priority,
        estimated_hours: t.estimated_hours || 2,
        status: 'todo' as const
      }))
      setTasks(generatedTasks)
    } catch (error) {
      console.error('Failed to generate tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const nextStatus = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo'
      return { ...t, status: nextStatus }
    }))
  }

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return
    
    const userMsg = chatMessage
    setChatMessage('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)
    
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg,
          context: {
            projectName: brief.name,
            projectDescription: brief.description,
            role: userRole,
            tasks: tasks.map(t => t.title)
          }
        })
      })
      
      const data = await response.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || data.message || 'No response' }])
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const todoTasks = tasks.filter(t => t.status === 'todo')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const totalHours = tasks.reduce((sum, t) => sum + t.estimated_hours, 0)
  const doneHours = doneTasks.reduce((sum, t) => sum + t.estimated_hours, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-muted rounded transition-colors">
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">{brief.name}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <RoleIcon className={`size-4 ${config.color}`} />
                    {config.label}
                  </span>
                  <span>•</span>
                  <span>{tasks.length} tasks</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {totalHours}h total
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                  chatOpen ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <MessageSquare className="size-4" />
                AI Help
              </button>
              <button
                onClick={generateTasks}
                disabled={loading}
                className="btn-primary px-4 py-2 rounded text-sm flex items-center gap-2"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {doneTasks.length}/{tasks.length} tasks • {doneHours}/{totalHours}h
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-foreground transition-all duration-500"
                style={{ width: tasks.length ? `${(doneTasks.length / tasks.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Generating tasks for {config.label}...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* In Progress */}
              {inProgressTasks.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                    <Play className="size-4" />
                    In Progress ({inProgressTasks.length})
                  </h2>
                  <div className="space-y-3">
                    {inProgressTasks.map(task => (
                      <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
                    ))}
                  </div>
                </div>
              )}

              {/* To Do */}
              {todoTasks.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                    <Circle className="size-4" />
                    To Do ({todoTasks.length})
                  </h2>
                  <div className="space-y-3">
                    {todoTasks.map(task => (
                      <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              {doneTasks.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    Done ({doneTasks.length})
                  </h2>
                  <div className="space-y-3 opacity-60">
                    {doneTasks.map(task => (
                      <TaskCard key={task.id} task={task} onToggle={toggleTaskStatus} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {chatOpen && (
          <div className="w-80 shrink-0">
            <div className="sticky top-24 border rounded-lg bg-background overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="size-4" />
                  AI Assistant
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Ask questions about this project</p>
              </div>
              
              <div className="h-80 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ask me anything about "{brief.name}"
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block px-3 py-2 rounded-lg max-w-[90%] ${
                      msg.role === 'user' 
                        ? 'bg-foreground text-background' 
                        : 'bg-muted'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask a question..."
                    className="flex-1 bg-muted rounded px-3 py-2 text-sm"
                  />
                  <button 
                    onClick={sendChatMessage}
                    disabled={chatLoading || !chatMessage.trim()}
                    className="p-2 bg-foreground text-background rounded disabled:opacity-50"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, onToggle }: { task: Task, onToggle: (id: string) => void }) {
  return (
    <div 
      onClick={() => onToggle(task.id)}
      className="relative cursor-pointer group"
    >
      <div aria-hidden className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-foreground/30 group-hover:border-foreground/60 transition-colors" />
      <div aria-hidden className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-foreground/30 group-hover:border-foreground/60 transition-colors" />
      <div aria-hidden className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-foreground/30 group-hover:border-foreground/60 transition-colors" />
      <div aria-hidden className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-foreground/30 group-hover:border-foreground/60 transition-colors" />

      <div className="border bg-background p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${
            task.status === 'done' ? 'text-foreground' : 
            task.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            {task.status === 'done' ? (
              <CheckCircle2 className="size-5" />
            ) : task.status === 'in_progress' ? (
              <Play className="size-5" />
            ) : (
              <Circle className="size-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wide ${
                  task.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                  task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
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
            <p className={`text-sm mt-1 ${task.status === 'done' ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
              {task.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
