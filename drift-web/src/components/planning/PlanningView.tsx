import { useState, useEffect, useRef } from 'react'
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
import { Button } from '@/components/ui/button'
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
  pm: { 
    icon: LayoutGrid, 
    label: 'Product Manager', 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  dev: { 
    icon: Code, 
    label: 'Developer', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  designer: { 
    icon: Palette, 
    label: 'Designer', 
    color: 'text-violet-400', 
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
}

export function PlanningView({ projectName, onComplete, onCancel }: PlanningViewProps) {
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
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const startPlanning = async () => {
    setPhase('thinking')
    
    // Simulate thinking phase
    await new Promise(r => setTimeout(r, 1500))
    setPhase('planning')

    // Get token for WebSocket auth
    const token = api.getStoredToken()
    
    // Connect to WebSocket for streaming
    const wsUrl = `${import.meta.env.VITE_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://')}/api/planning/stream`
    
    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'plan',
          projectName,
          token: `Bearer ${token}`,
        }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'overview') {
          setOverview(data.content)
        } else if (data.type === 'role_start') {
          setCurrentStreamRole(data.role)
          setStreamingContent('')
        } else if (data.type === 'chunk') {
          setStreamingContent(prev => prev + data.content)
        } else if (data.type === 'role_tasks') {
          // Parse and add tasks for this role
          const tasks: Task[] = (data.tasks || []).map((t: any, i: number) => ({
            id: `${data.role}-${i}-${Date.now()}`,
            title: t.title,
            description: t.description || '',
            priority: t.priority || 'medium',
            estimatedHours: t.estimated_hours || t.estimatedHours,
            checked: true,
          }))
          
          setPlans(prev => prev.map(p => 
            p.role === data.role ? { ...p, tasks } : p
          ))
          setCurrentStreamRole(null)
          setStreamingContent('')
        } else if (data.type === 'complete') {
          setPhase('ready')
        } else if (data.type === 'error') {
          console.error('Planning error:', data.message)
          // Fallback to REST API
          generatePlanFallback()
        }
      }

      ws.onerror = () => {
        // Fallback to REST API
        generatePlanFallback()
      }
    } catch {
      generatePlanFallback()
    }
  }

  const generatePlanFallback = async () => {
    // Fallback: Use REST API to generate plan
    setOverview(`Planning "${projectName}" - generating tasks for all roles...`)
    
    for (const role of ['pm', 'dev', 'designer'] as Role[]) {
      setCurrentStreamRole(role)
      try {
        const response = await api.generateTasks(projectName, role)
        const tasks: Task[] = (response.tasks || []).map((t: any, i: number) => ({
          id: `${role}-${i}-${Date.now()}`,
          title: t.title,
          description: t.description || '',
          priority: t.priority || 'medium',
          estimatedHours: t.estimated_hours || t.estimatedHours,
          checked: true,
        }))
        
        setPlans(prev => prev.map(p => 
          p.role === role ? { ...p, tasks } : p
        ))
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
      // Create the project - tasks will be generated by backend
      const newBrief = await api.createBrief({
        name: projectName,
        description: overview,
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
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm">Cancel</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Brain className={`size-5 ${phase === 'thinking' ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">
              {phase === 'thinking' && 'Analyzing project...'}
              {phase === 'planning' && 'Generating plan...'}
              {phase === 'ready' && 'Plan ready'}
            </span>
          </div>

          <Button
            onClick={handleCreateProject}
            disabled={phase !== 'ready' || creating || selectedTasks === 0}
            className="gap-2"
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            Create Project
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Project Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs text-primary font-medium mb-3">
            <Sparkles className="size-3" />
            AI-Generated Plan
          </div>
          <h1 className="text-3xl font-bold mb-2">{projectName}</h1>
          
          {/* Overview */}
          {overview && (
            <p className="text-muted-foreground leading-relaxed">{overview}</p>
          )}
          
          {phase === 'thinking' && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex gap-1">
                <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-muted-foreground">Understanding your project requirements...</span>
            </div>
          )}
        </div>

        {/* Task Summary */}
        {phase !== 'thinking' && (
          <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-lg">
            <div className="flex-1">
              <span className="text-2xl font-bold">{selectedTasks}</span>
              <span className="text-muted-foreground ml-1">/ {totalTasks} tasks selected</span>
            </div>
            <div className="flex gap-2">
              {plans.map(p => {
                const config = roleConfig[p.role]
                const count = p.tasks.filter(t => t.checked).length
                return (
                  <div key={p.role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg}`}>
                    <config.icon className={`size-3.5 ${config.color}`} />
                    <span className={`text-sm font-medium ${config.color}`}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Role Plans */}
        <div className="space-y-4">
          {plans.map((plan, roleIdx) => {
            const config = roleConfig[plan.role]
            const isStreaming = currentStreamRole === plan.role
            
            return (
              <div 
                key={plan.role} 
                className={`border rounded-lg overflow-hidden transition-all ${
                  isStreaming ? `${config.border} border-2` : 'border-border'
                }`}
              >
                {/* Role Header */}
                <button
                  onClick={() => toggleRoleExpanded(roleIdx)}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${config.bg} hover:opacity-90 transition-opacity`}
                >
                  {plan.expanded ? (
                    <ChevronDown className={`size-4 ${config.color}`} />
                  ) : (
                    <ChevronRight className={`size-4 ${config.color}`} />
                  )}
                  <config.icon className={`size-5 ${config.color}`} />
                  <span className={`font-semibold ${config.color}`}>{config.label}</span>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {plan.tasks.filter(t => t.checked).length} / {plan.tasks.length} tasks
                  </span>
                  {isStreaming && (
                    <Loader2 className={`size-4 animate-spin ${config.color}`} />
                  )}
                </button>

                {/* Tasks */}
                {plan.expanded && (
                  <div className="p-4 space-y-2 bg-card">
                    {/* Streaming indicator */}
                    {isStreaming && streamingContent && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground italic">
                        {streamingContent}
                        <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-1" />
                      </div>
                    )}

                    {/* Task list */}
                    {plan.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
                          task.checked 
                            ? 'bg-card border-border hover:border-primary/30' 
                            : 'bg-muted/30 border-transparent opacity-60'
                        }`}
                      >
                        <button
                          onClick={() => toggleTask(roleIdx, task.id)}
                          className={`mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            task.checked 
                              ? `${config.border} ${config.bg}` 
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {task.checked && <Check className={`size-3 ${config.color}`} />}
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
                              className="w-full bg-transparent border-b border-primary focus:outline-none font-medium"
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
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              task.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                              task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
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

                    {/* Add task button */}
                    {phase === 'ready' && (
                      <button
                        onClick={() => addTask(roleIdx)}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                      >
                        <Plus className="size-4" />
                        <span className="text-sm">Add Task</span>
                      </button>
                    )}

                    {/* Empty state */}
                    {plan.tasks.length === 0 && !isStreaming && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        {phase === 'planning' ? 'Generating tasks...' : 'No tasks yet'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom Actions */}
        {phase === 'ready' && (
          <div className="mt-8 flex items-center justify-between p-6 bg-card border border-border rounded-lg">
            <div>
              <h3 className="font-semibold">Ready to create?</h3>
              <p className="text-sm text-muted-foreground">
                {selectedTasks} tasks will be created across {plans.filter(p => p.tasks.some(t => t.checked)).length} roles
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject} disabled={creating || selectedTasks === 0} className="gap-2">
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Create Project
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
