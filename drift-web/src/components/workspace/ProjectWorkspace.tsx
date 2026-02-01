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
  const [recentUpdate, setRecentUpdate] = useState<SessionUpdate | null>(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [projectIssues, setProjectIssues] = useState<string[]>([])

  const config = roleConfig[userRole]
  const RoleIcon = config.icon

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/briefs/${brief.id}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }
  }, [brief.id, getToken])

  // Listen for WebSocket updates from desktop sessions
  useEffect(() => {
    const wsUrl = `${(import.meta.env.VITE_API_URL || '').replace('http', 'ws')}/ws/workspace`
    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = async () => {
      const token = await getToken()
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'authenticate', token }))
        ws?.send(JSON.stringify({ type: 'subscribe', briefId: brief.id }))
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'workspace:updated' && data.briefId === brief.id) {
            // Session was analyzed and tasks were updated
            const update: SessionUpdate = {
              sessionId: data.sessionId,
              briefId: data.briefId,
              updatedTaskIds: data.updatedTaskIds || [],
              newTaskIds: data.newTaskIds || [],
              issues: data.issues || [],
              aiSummary: data.aiSummary || '',
              timestamp: new Date()
            }
            
            setRecentUpdate(update)
            setShowUpdateBanner(true)
            
            // Add issues to project issues
            if (update.issues.length > 0) {
              setProjectIssues(prev => [...update.issues, ...prev].slice(0, 5))
            }
            
            // Refresh tasks
            fetchTasks()
            
            // Mark updated tasks as recently updated
            setTasks(prev => prev.map(t => ({
              ...t,
              wasRecentlyUpdated: update.updatedTaskIds.includes(t.id) || update.newTaskIds.includes(t.id)
            })))
            
            // Clear the highlight after 5 seconds
            setTimeout(() => {
              setTasks(prev => prev.map(t => ({ ...t, wasRecentlyUpdated: false })))
            }, 5000)
          }
        } catch (e) {
          console.error('WebSocket message error:', e)
        }
      }
      
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }
    
    connect()
    
    return () => {
      ws?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [brief.id, getToken, fetchTasks])

  // Load tasks from DB on mount, only generate if none exist
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false)
  
  useEffect(() => {
    if (hasLoadedTasks) return // Don't load again
    
    const loadTasks = async () => {
      setLoading(true)
      try {
        const token = await getToken()
        console.log('[Workspace] Loading tasks for brief:', brief.id)
        
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/briefs/${brief.id}/tasks`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        console.log('[Workspace] Tasks API response:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          const existingTasks = data.tasks || []
          
          console.log('[Workspace] Found tasks:', existingTasks.length)
          
          if (existingTasks.length > 0) {
            // Use existing tasks from DB
            setTasks(existingTasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              priority: t.priority || 'medium',
              estimated_hours: t.estimated_hours || t.estimatedHours || 2,
              status: t.status || 'todo'
            })))
            setLoading(false)
          } else {
            // No tasks in DB, generate new ones
            console.log('[Workspace] No tasks found, generating...')
            await doGenerateTasks(token)
          }
        } else {
          console.error('[Workspace] Tasks API error:', response.status)
          const token2 = await getToken()
          await doGenerateTasks(token2)
        }
      } catch (error) {
        console.error('[Workspace] Failed to load tasks:', error)
        setLoading(false)
      }
      setHasLoadedTasks(true)
    }
    
    loadTasks()
  }, [brief.id, hasLoadedTasks])
  
  // Separate generate function that doesn't depend on state
  const doGenerateTasks = async (token: string | null) => {
    try {
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
        priority: t.priority || 'medium',
        estimated_hours: t.estimated_hours || 2,
        status: 'todo' as const
      }))
      setTasks(generatedTasks)
    } catch (error) {
      console.error('[Workspace] Failed to generate tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTasks = async () => {
    setLoading(true)
    const token = await getToken()
    await doGenerateTasks(token)
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
      {/* Session Update Banner */}
      {showUpdateBanner && recentUpdate && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Sparkles className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-emerald-900 text-sm">Workspace Updated</h4>
                  <p className="text-xs text-emerald-700 mt-1">{recentUpdate.aiSummary}</p>
                  {recentUpdate.updatedTaskIds.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      {recentUpdate.updatedTaskIds.length} task(s) updated
                    </p>
                  )}
                  {recentUpdate.newTaskIds.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      {recentUpdate.newTaskIds.length} new task(s) added
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowUpdateBanner(false)}
                className="text-emerald-600 hover:text-emerald-800"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
              {projectIssues.length > 0 && (
                <div className="relative">
                  <Bell className="size-4 text-orange-500" />
                  <span className="absolute -top-1 -right-1 size-3 bg-orange-500 rounded-full text-[8px] text-white flex items-center justify-center">
                    {projectIssues.length}
                  </span>
                </div>
              )}
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

      {/* Issues Banner */}
      {projectIssues.length > 0 && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 text-sm">Attention Required</h4>
                <ul className="mt-1 space-y-1">
                  {projectIssues.map((issue, i) => (
                    <li key={i} className="text-xs text-orange-700">• {issue}</li>
                  ))}
                </ul>
              </div>
              <button 
                onClick={() => setProjectIssues([])}
                className="text-orange-600 hover:text-orange-800 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

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
  const isRecentlyUpdated = task.wasRecentlyUpdated
  
  return (
    <div 
      onClick={() => onToggle(task.id)}
      className={`relative cursor-pointer group ${isRecentlyUpdated ? 'animate-pulse' : ''}`}
    >
      {/* Recently updated indicator */}
      {isRecentlyUpdated && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-full" />
      )}
      
      <div aria-hidden className={`absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 transition-colors ${
        isRecentlyUpdated ? 'border-emerald-500' : 'border-foreground/30 group-hover:border-foreground/60'
      }`} />
      <div aria-hidden className={`absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 transition-colors ${
        isRecentlyUpdated ? 'border-emerald-500' : 'border-foreground/30 group-hover:border-foreground/60'
      }`} />
      <div aria-hidden className={`absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 transition-colors ${
        isRecentlyUpdated ? 'border-emerald-500' : 'border-foreground/30 group-hover:border-foreground/60'
      }`} />
      <div aria-hidden className={`absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 transition-colors ${
        isRecentlyUpdated ? 'border-emerald-500' : 'border-foreground/30 group-hover:border-foreground/60'
      }`} />

      <div className={`border bg-background p-4 hover:bg-muted/30 transition-colors ${
        isRecentlyUpdated ? 'bg-emerald-50/50 border-emerald-200' : ''
      }`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${
            task.status === 'done' ? 'text-foreground' : 
            task.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            {task.status === 'done' ? (
              <CheckCircle2 className={`size-5 ${isRecentlyUpdated ? 'text-emerald-600' : ''}`} />
            ) : task.status === 'in_progress' ? (
              <Play className={`size-5 ${isRecentlyUpdated ? 'text-emerald-600' : ''}`} />
            ) : (
              <Circle className="size-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h3>
                {isRecentlyUpdated && (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded uppercase tracking-wide">
                    Updated
                  </span>
                )}
              </div>
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
