import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Brief, Role } from '../types'
import { 
  ArrowLeft, 
  Play, 
  Square, 
  Radio, 
  Send,
  Sparkles,
  Loader2,
  Code,
  Palette,
  LayoutGrid,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { UserButton } from '@clerk/clerk-react'

interface BriefPageProps {
  brief: Brief
  userRole: Role
  onBack: () => void
}

interface GeneratedContent {
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

export function BriefPage({ brief, userRole, onBack }: BriefPageProps) {
  const { getToken } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(true)
  const [content, setContent] = useState<GeneratedContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch generated content from API
  useEffect(() => {
    const generateContent = async () => {
      setIsGenerating(true)
      setError(null)
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsGenerating(false)
        setError('Generation timed out. Please refresh the page to try again.')
      }, 60000) // 60 seconds
      
      try {
        const token = await getToken()
        if (token) {
          api.setToken(token)
        }
        
        const response = await api.generateBriefContent({
          briefId: brief.id,
          name: brief.name,
          description: brief.description || '',
          role: userRole,
        })
        
        clearTimeout(timeoutId)
        setContent(response.content as GeneratedContent)
      } catch (err) {
        clearTimeout(timeoutId)
        console.error('Failed to generate content:', err)
        setError('Failed to generate content. Please try again.')
      } finally {
        setIsGenerating(false)
      }
    }

    generateContent()
  }, [brief.id, brief.name, brief.description, userRole, getToken])

  // Session timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    if (isRecording) {
      interval = setInterval(() => {
        setSessionTime(t => t + 1)
      }, 1000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartSession = () => {
    setIsRecording(true)
    setSessionTime(0)
  }

  const handleStopSession = () => {
    setIsRecording(false)
    // TODO: Submit session to API
  }

  const handleRetry = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const token = await getToken()
      if (token) {
        api.setToken(token)
      }
      
      const response = await api.generateBriefContent({
        name: brief.name,
        description: brief.description || '',
        role: userRole,
      })
      
      setContent(response.content as GeneratedContent)
    } catch (err) {
      console.error('Failed to generate content:', err)
      setError('Failed to generate content. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const roleColor = userRole === 'pm' ? 'text-blue-500' : userRole === 'dev' ? 'text-emerald-500' : 'text-violet-500'
  const roleBg = userRole === 'pm' ? 'bg-blue-500/10' : userRole === 'dev' ? 'bg-emerald-500/10' : 'bg-violet-500/10'
  
  const RoleIcon = () => {
    const iconClass = `size-4 ${roleColor}`
    if (userRole === 'pm') return <LayoutGrid className={iconClass} />
    if (userRole === 'dev') return <Code className={iconClass} />
    return <Palette className={iconClass} />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-base font-semibold">{brief.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Role Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${roleBg}`}>
            <RoleIcon />
            <span className={`text-xs font-medium ${roleColor}`}>{userRole.toUpperCase()}</span>
          </div>

          {/* Session Controls */}
          {isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                <Radio className="size-3 text-red-500 animate-pulse" />
                <span className="text-sm font-mono text-red-500">{formatTime(sessionTime)}</span>
              </div>
              <Button onClick={handleStopSession} variant="destructive" size="sm">
                <Square className="size-3 mr-1.5" /> End Session
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleStartSession} 
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="size-3 mr-1.5" /> Start Session
            </Button>
          )}

          <div className="h-6 w-px bg-border" />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Chat Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {/* User Message */}
          <div className="flex gap-4 mb-8">
            <div className="size-9 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-foreground">You</span>
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-muted-foreground mb-2">Created new project</p>
              <div className="p-4 bg-card border border-border rounded-xl">
                <p className="font-medium">{brief.name}</p>
                {brief.description && (
                  <p className="text-sm text-muted-foreground mt-1">{brief.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex gap-4">
            <div className={`size-9 rounded-full ${roleBg} flex items-center justify-center shrink-0`}>
              <Sparkles className={`size-4 ${roleColor}`} />
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-muted-foreground mb-4">
                Generated {userRole === 'pm' ? 'sprint plan' : userRole === 'dev' ? 'technical spec' : 'design spec'}
              </p>

              {isGenerating && (
                <div className="flex items-center gap-3 p-6 bg-card border border-border rounded-xl">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <div>
                    <p className="font-medium">Generating with AI...</p>
                    <p className="text-sm text-muted-foreground">Analyzing project and creating {userRole} specs</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 p-6 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="size-5 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Generation Failed</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    <RefreshCw className="size-3 mr-1.5" /> Retry
                  </Button>
                </div>
              )}

              {!isGenerating && !error && content && (
                <div className="space-y-4">
                  {/* PM View */}
                  {userRole === 'pm' && (
                    <>
                      {/* Tasks / Kanban */}
                      {content.tasks && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">📊</span> Sprint Board
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To Do ({content.tasks.todo?.length || 0})</div>
                              {content.tasks.todo?.map((task, i) => (
                                <div key={i} className="p-3 bg-background border border-border rounded-lg text-sm">{task}</div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In Progress ({content.tasks.in_progress?.length || 0})</div>
                              {content.tasks.in_progress?.map((task, i) => (
                                <div key={i} className="p-3 bg-background border border-blue-500/30 rounded-lg text-sm">{task}</div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Done ({content.tasks.done?.length || 0})</div>
                              {content.tasks.done?.map((task, i) => (
                                <div key={i} className="p-3 bg-background border border-emerald-500/30 rounded-lg text-sm text-muted-foreground">{task}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* User Stories */}
                      {content.user_stories && content.user_stories.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">📝</span> User Stories
                          </h3>
                          <div className="space-y-3">
                            {content.user_stories.map((story, i) => (
                              <div key={i} className="p-4 bg-background border border-border rounded-lg">
                                <p className="font-medium mb-2">{story.title}</p>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {story.acceptance_criteria?.map((criteria, j) => (
                                    <p key={j}>✓ {criteria}</p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      {content.timeline && content.timeline.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">⏱️</span> Timeline
                          </h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            {content.timeline.map((phase, i) => (
                              <div key={i} className="flex items-center">
                                <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                  phase.progress > 0 ? 'bg-blue-500/20 text-blue-600' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {phase.label}
                                  {phase.progress > 0 && <span className="ml-2 text-xs">({phase.progress}%)</span>}
                                </div>
                                {i < content.timeline!.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Dev View */}
                  {userRole === 'dev' && (
                    <>
                      {/* Architecture */}
                      {content.architecture && content.architecture.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">🔧</span> Architecture
                          </h3>
                          <div className="flex items-center justify-center gap-4 py-6 flex-wrap">
                            {content.architecture.map((node, i) => (
                              <div key={i} className="flex items-center">
                                <div className="px-5 py-3 bg-background border border-border rounded-lg font-medium">
                                  {node.label}
                                </div>
                                {i < content.architecture!.length - 1 && (
                                  <span className="text-muted-foreground text-xl mx-2">→</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tech Stack */}
                      {content.tech_stack && content.tech_stack.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">🛠️</span> Tech Stack
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {content.tech_stack.map((tech, i) => (
                              <span key={i} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-sm font-medium">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* API Endpoints */}
                      {content.api_endpoints && content.api_endpoints.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">📦</span> API Endpoints
                          </h3>
                          <div className="space-y-3">
                            {content.api_endpoints.map((endpoint, i) => (
                              <div key={i} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-sm">
                                <p className="text-emerald-400">{endpoint.method} {endpoint.path}</p>
                                <p className="text-zinc-500 mt-2">Request: {endpoint.request}</p>
                                <p className="text-zinc-500">Response: {endpoint.response}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Code Snippets */}
                      {content.code_snippets && content.code_snippets.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">💻</span> Implementation
                          </h3>
                          {content.code_snippets.map((snippet, i) => (
                            <pre key={i} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-sm overflow-x-auto text-zinc-300 mb-3">
                              {snippet}
                            </pre>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Designer View */}
                  {userRole === 'designer' && (
                    <>
                      {/* User Flow */}
                      {content.user_flow && content.user_flow.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">📱</span> User Flow
                          </h3>
                          <div className="flex items-center justify-center gap-3 py-6 flex-wrap">
                            {content.user_flow.map((step, i) => (
                              <div key={i} className="flex items-center">
                                <div className="flex flex-col items-center">
                                  <div className="size-10 rounded-full flex items-center justify-center font-medium bg-violet-500/20 text-violet-600">
                                    {i + 1}
                                  </div>
                                  <span className="text-xs mt-2 text-muted-foreground max-w-20 text-center">{step}</span>
                                </div>
                                {i < content.user_flow!.length - 1 && <div className="w-8 h-px bg-border mx-2" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Components */}
                      {content.components && content.components.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">🎨</span> Component Specs
                          </h3>
                          <div className="space-y-4">
                            {content.components.map((comp, i) => (
                              <div key={i} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">
                                <div>
                                  <p className="font-medium">{comp.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Height: {comp.height} • Radius: {comp.radius} • Color: {comp.color}
                                  </p>
                                </div>
                                <div 
                                  className="w-24 h-10 rounded-lg" 
                                  style={{ backgroundColor: comp.color || '#000' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* States */}
                      {content.states && content.states.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl">
                          <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <span className="text-lg">🖼️</span> States to Design
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {content.states.map((state, i) => (
                              <span key={i} className="px-3 py-1.5 bg-violet-500/10 text-violet-600 rounded-lg text-sm font-medium">
                                {state}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Chat Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about implementation details, timelines, or refine the spec..."
              className="w-full h-12 pl-4 pr-14 bg-background border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Button size="icon" className="absolute right-1.5 top-1.5 size-9 rounded-lg">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
