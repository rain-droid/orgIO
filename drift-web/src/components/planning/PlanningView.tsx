import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { 
  Loader2, 
  Sparkles, 
  Check, 
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  Rocket,
  Brain,
  Code,
  Palette,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
type Role = 'pm' | 'dev' | 'designer'

interface Task {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedHours?: number
  checked: boolean
}

interface RolePlan {
  role: Role
  tasks: Task[]
  expanded: boolean
}

interface PlanningViewProps {
  projectName: string
  onComplete: (projectId: string) => void
  onCancel: () => void
}

const roleConfig = {
  pm: { icon: LayoutGrid, label: 'Product Manager' },
  dev: { icon: Code, label: 'Developer' },
  designer: { icon: Palette, label: 'Designer' },
}

export function PlanningView({ projectName, onComplete, onCancel }: PlanningViewProps) {
  const { orgId } = useAuth()
  const [phase, setPhase] = useState<'thinking' | 'planning' | 'ready'>('thinking')
  const [overview, setOverview] = useState('')
  const [plans, setPlans] = useState<RolePlan[]>([
    { role: 'pm', tasks: [], expanded: true },
    { role: 'dev', tasks: [], expanded: true },
    { role: 'designer', tasks: [], expanded: true },
  ])
  const [streamingContent, setStreamingContent] = useState('')
  const [currentStreamRole, setCurrentStreamRole] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    startPlanning()
    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const startPlanning = async () => {
    setPhase('thinking')
    await new Promise(r => setTimeout(r, 1500))
    setPhase('planning')

    const token = api.getStoredToken()
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/planning/stream`
    
    let wsConnected = false
    const wsTimeout = setTimeout(() => {
      if (!wsConnected && wsRef.current) {
        console.log('WebSocket timeout, falling back to REST')
        wsRef.current.close()
        fallbackToRest()
      }
    }, 10000)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        wsConnected = true
        clearTimeout(wsTimeout)
        ws.send(JSON.stringify({ type: 'plan', projectName, token }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'overview') {
            setOverview(data.content)
          } else if (data.type === 'role_start') {
            setCurrentStreamRole(data.role)
            setStreamingContent('')
          } else if (data.type === 'chunk') {
            setStreamingContent(prev => prev + data.content)
          } else if (data.type === 'role_tasks') {
            const tasks: Task[] = data.tasks.map((t: any, i: number) => ({
              id: `${data.role}-${i}`,
              title: t.title,
              description: t.description || '',
              priority: t.priority || 'medium',
              estimatedHours: t.estimatedHours || t.estimated_hours,
              checked: true,
            }))
            
            setPlans(prev => prev.map(p => 
              p.role === data.role ? { ...p, tasks } : p
            ))
            setStreamingContent('')
          } else if (data.type === 'complete') {
            setCurrentStreamRole(null)
            setPhase('ready')
          } else if (data.type === 'error') {
            console.error('Planning error:', data.message)
            fallbackToRest()
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        clearTimeout(wsTimeout)
        if (!wsConnected) fallbackToRest()
      }

      ws.onclose = () => {
        clearTimeout(wsTimeout)
        if (!wsConnected) fallbackToRest()
      }
    } catch (err) {
      clearTimeout(wsTimeout)
      fallbackToRest()
    }
  }

  const fallbackToRest = async () => {
    console.log('Using REST API fallback for planning')
    setPhase('planning')
    setOverview(`Planning: ${projectName}`)
    
    const roles: Role[] = ['pm', 'dev', 'designer']
    for (const role of roles) {
      setCurrentStreamRole(role)
      setStreamingContent('Generating tasks...')
      
      try {
        const response = await api.generateTasks(projectName, role)
        const tasks: Task[] = response.tasks.map((t, i) => ({
          id: `${role}-${i}`,
          title: t.title,
          description: t.description || '',
          priority: t.priority || 'medium',
          estimatedHours: t.estimated_hours,
          checked: true,
        }))
        
        setPlans(prev => prev.map(p => 
          p.role === role ? { ...p, tasks } : p
        ))
        setStreamingContent('')
      } catch (err) {
        console.error(`Failed to generate ${role} tasks:`, err)
      }
    }
    
    setCurrentStreamRole(null)
    setPhase('ready')
  }

  const toggleTask = (roleIdx: number, taskId: string) => {
    setPlans(prev => prev.map((p, i) => 
      i === roleIdx 
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, checked: !t.checked } : t) }
        : p
    ))
  }

  const deleteTask = (roleIdx: number, taskId: string) => {
    setPlans(prev => prev.map((p, i) => 
      i === roleIdx 
        ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
        : p
    ))
  }

  const addTask = (roleIdx: number) => {
    const role = plans[roleIdx].role
    const newTask: Task = {
      id: `${role}-new-${Date.now()}`,
      title: 'New Task',
      description: '',
      priority: 'medium',
      checked: true,
    }
    setPlans(prev => prev.map((p, i) => 
      i === roleIdx 
        ? { ...p, tasks: [...p.tasks, newTask] }
        : p
    ))
    setEditingTask(newTask.id)
  }

  const updateTaskTitle = (roleIdx: number, taskId: string, title: string) => {
    setPlans(prev => prev.map((p, i) => 
      i === roleIdx 
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, title } : t) }
        : p
    ))
  }

  const toggleRoleExpanded = (roleIdx: number) => {
    setPlans(prev => prev.map((p, i) => 
      i === roleIdx ? { ...p, expanded: !p.expanded } : p
    ))
  }

  const handleCreateProject = async () => {
    setCreating(true)
    try {
      const newBrief = await api.createBrief({
        name: projectName,
        description: overview,
        orgId: orgId || undefined,
      })
      onComplete(newBrief.id)
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setCreating(false)
    }
  }

  const totalTasks = plans.reduce((acc, p) => acc + p.tasks.length, 0)
  const selectedTasks = plans.reduce((acc, p) => acc + p.tasks.filter(t => t.checked).length, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm">Cancel</span>
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded">
            <Brain className={`size-4 ${phase === 'thinking' ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-medium uppercase tracking-wide">
              {phase === 'thinking' && 'Analyzing...'}
              {phase === 'planning' && 'Generating...'}
              {phase === 'ready' && 'Ready'}
            </span>
          </div>

          <button
            onClick={handleCreateProject}
            disabled={phase !== 'ready' || creating || selectedTasks === 0}
            className="btn-primary px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            Create
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Project Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 border rounded text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
            <Sparkles className="size-3" />
            AI-Generated Plan
          </div>
          <h1 className="text-2xl font-semibold mb-2">{projectName}</h1>
          
          {overview && (
            <p className="text-muted-foreground">{overview}</p>
          )}
          
          {phase === 'thinking' && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span className="text-sm text-muted-foreground">Understanding requirements...</span>
            </div>
          )}
        </div>

        {/* Task Summary */}
        {phase !== 'thinking' && (
          <div className="relative mb-6">
            <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
            <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
            <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
            <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

            <div className="border bg-background p-6 flex items-center justify-between">
              <div>
                <span className="text-3xl font-medium">{selectedTasks}</span>
                <span className="text-muted-foreground ml-2">/ {totalTasks} tasks selected</span>
              </div>
              <div className="flex gap-4">
                {plans.map(p => {
                  const config = roleConfig[p.role]
                  const count = p.tasks.filter(t => t.checked).length
                  return (
                    <div key={p.role} className="flex items-center gap-2 text-sm">
                      <config.icon className="size-4 text-muted-foreground" />
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Role Plans */}
        <div className="space-y-4">
          {plans.map((plan, roleIdx) => {
            const config = roleConfig[plan.role]
            const isStreaming = currentStreamRole === plan.role
            
            return (
              <div key={plan.role} className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className={`border bg-background ${isStreaming ? 'border-foreground' : ''}`}>
                  {/* Role Header */}
                  <button
                    onClick={() => toggleRoleExpanded(roleIdx)}
                    className="w-full flex items-center gap-3 px-6 py-4 border-b card-hover"
                  >
                    {plan.expanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <config.icon className="size-5" />
                    <span className="font-medium">{config.label}</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {plan.tasks.filter(t => t.checked).length} / {plan.tasks.length} tasks
                    </span>
                    {isStreaming && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                  </button>

                  {/* Tasks */}
                  {plan.expanded && (
                    <div className="p-4 space-y-2">
                      {isStreaming && streamingContent && (
                        <div className="p-3 bg-muted/50 rounded text-sm text-muted-foreground italic">
                          {streamingContent}
                          <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-1" />
                        </div>
                      )}

                      {plan.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`group flex items-start gap-3 p-3 border rounded transition-all ${
                            task.checked ? 'bg-background' : 'bg-muted/30 opacity-60'
                          }`}
                        >
                          <button
                            onClick={() => toggleTask(roleIdx, task.id)}
                            className={`mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              task.checked ? 'border-foreground bg-foreground' : 'border-muted-foreground/30'
                            }`}
                          >
                            {task.checked && <Check className="size-3 text-background" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            {editingTask === task.id ? (
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => updateTaskTitle(roleIdx, task.id, e.target.value)}
                                onBlur={() => setEditingTask(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingTask(null)}
                                autoFocus
                                className="w-full bg-transparent border-b border-foreground focus:outline-none font-medium"
                              />
                            ) : (
                              <div 
                                className={`font-medium ${!task.checked && 'line-through'}`}
                                onDoubleClick={() => setEditingTask(task.id)}
                              >
                                {task.title}
                              </div>
                            )}
                            {task.description && (
                              <div className="text-sm text-muted-foreground mt-0.5">{task.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${
                                task.priority === 'high' ? 'bg-foreground text-background' :
                                task.priority === 'medium' ? 'bg-muted text-foreground' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {task.priority}
                              </span>
                              {task.estimatedHours && (
                                <span className="text-xs text-muted-foreground">
                                  ~{task.estimatedHours}h
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingTask(task.id)}
                              className="p-1.5 hover:bg-muted rounded transition-colors"
                            >
                              <Edit3 className="size-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => deleteTask(roleIdx, task.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {phase === 'ready' && (
                        <button
                          onClick={() => addTask(roleIdx)}
                          className="w-full flex items-center justify-center gap-2 p-3 border border-dashed rounded text-muted-foreground hover:text-foreground hover:border-foreground transition-all"
                        >
                          <Plus className="size-4" />
                          <span className="text-sm">Add Task</span>
                        </button>
                      )}

                      {plan.tasks.length === 0 && !isStreaming && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          {phase === 'planning' ? 'Generating tasks...' : 'No tasks yet'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom Actions */}
        {phase === 'ready' && (
          <div className="mt-8 relative">
            <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
            <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
            <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
            <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

            <div className="border bg-background p-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Ready to create?</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTasks} tasks across {plans.filter(p => p.tasks.some(t => t.checked)).length} roles
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={onCancel} className="btn-secondary px-4 py-2 rounded text-sm">
                  Cancel
                </button>
                <button 
                  onClick={handleCreateProject} 
                  disabled={creating || selectedTasks === 0} 
                  className="btn-primary px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
