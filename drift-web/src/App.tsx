import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/clerk-react'
import { AppSidebar } from '@/components/app-sidebar'
import { Onboarding } from '@/components/onboarding'
import { ProjectWorkspace } from '@/components/workspace/ProjectWorkspace'
import { PlanningView } from '@/components/planning/PlanningView'
import { ChatView } from '@/components/chat/ChatView'
import { DesktopAuth } from '@/pages/DesktopAuth'
import { MCPHub } from '@/pages/MCPHub'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import type { Brief, Submission, User, Role } from './types'
import { api } from './lib/api'
import { 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  Clock,
  Code,
  Palette,
  LayoutGrid,
  FolderOpen,
  TrendingUp,
} from 'lucide-react'

type View = 'home' | 'brief' | 'briefs' | 'reviews' | 'planning' | 'chat' | 'mcp-hub'

export default function App() {
  // Handle /auth/desktop route for desktop app authentication
  if (window.location.pathname === '/auth/desktop') {
    return <DesktopAuth />
  }

  const { isSignedIn, user: clerkUser } = useUser()
  const { orgId, getToken } = useAuth()

  const [briefs, setBriefs] = useState<Brief[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [driftUser, setDriftUser] = useState<User | null>(null)
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [loading] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [planningProjectName, setPlanningProjectName] = useState('')

  const currentRole: Role = driftUser?.role || 'dev'

  useEffect(() => {
    if (needsOnboarding === false && driftUser?.role) return
    if (!isSignedIn || !clerkUser) {
      setCheckingUser(false)
      return
    }
    if (!orgId) {
      setCheckingUser(false)
      setNeedsOnboarding(true)
      return
    }
    
    const checkUser = async () => {
      setCheckingUser(true)
      try {
        const token = await getToken()
        if (!token) {
          setNeedsOnboarding(true)
          setCheckingUser(false)
          return
        }
        api.setToken(token)
        const session = await api.getSession()
        setDriftUser({
          id: session.userId,
          orgId: session.orgId || orgId,
          email: session.email || '',
          name: session.name || 'User',
          avatarUrl: session.avatarUrl,
          role: session.role,
        })
        if (session.needsOnboarding || session.isNew || !session.role) {
          setNeedsOnboarding(true)
          setCheckingUser(false)
          return
        }
        setNeedsOnboarding(false)
        const briefsResponse = await api.listBriefs()
        const briefsData = briefsResponse.briefs.map((brief) => ({
          id: brief.id,
          orgId: brief.orgId,
          name: brief.name,
          description: brief.description,
          status: brief.status as Brief['status'],
          createdBy: brief.createdBy,
          content: null,
        }))
        setBriefs(briefsData)
        if (briefsData.length > 0) {
          const subsResponse = await api.listSubmissions()
          const subsData = subsResponse.submissions.map((submission) => ({
            id: submission.id,
            briefId: submission.briefId,
            userId: submission.userId,
            userName: submission.userName,
            role: submission.role as Role,
            summaryLines: submission.summaryLines,
            durationMinutes: submission.durationMinutes,
            matchedTasks: submission.matchedTasks,
            status: submission.status as Submission['status'],
          }))
          setSubmissions(subsData)
        }
      } catch (err) {
        console.error('checkUser error:', err)
        if (!driftUser) setNeedsOnboarding(true)
      } finally {
        setCheckingUser(false)
      }
    }
    checkUser()
  }, [isSignedIn, clerkUser, orgId, getToken])

  const handleOnboardingComplete = async () => {
    if (!clerkUser) return
    setNeedsOnboarding(false)
    setCheckingUser(true)
    try {
      const token = await getToken({ skipCache: true })
      if (!token) throw new Error('Unable to get authentication token')
      api.setToken(token)
      const session = await api.getSession()
      setDriftUser({
        id: session.userId,
        orgId: session.orgId,
        email: session.email || '',
        name: session.name || 'User',
        avatarUrl: session.avatarUrl,
        role: session.role,
      })
      const briefsResponse = await api.listBriefs()
      const briefsData = briefsResponse.briefs.map((brief) => ({
        id: brief.id,
        orgId: brief.orgId,
        name: brief.name,
        description: brief.description,
        status: brief.status as Brief['status'],
        createdBy: brief.createdBy,
        content: null,
      }))
      setBriefs(briefsData)
    } finally {
      setCheckingUser(false)
    }
  }

  const handleStartPlanning = () => {
    if (!inputValue.trim() || !orgId || !clerkUser) return
    setPlanningProjectName(inputValue.trim())
    setInputValue('')
    setCurrentView('planning')
  }

  const handlePlanningComplete = async (projectId: string) => {
    try {
      const briefsResponse = await api.listBriefs()
      const briefsData = briefsResponse.briefs.map((brief) => ({
        id: brief.id,
        orgId: brief.orgId,
        name: brief.name,
        description: brief.description,
        status: brief.status as Brief['status'],
        createdBy: brief.createdBy,
        content: null,
      }))
      setBriefs(briefsData)
      const newBrief = briefsData.find(b => b.id === projectId)
      if (newBrief) {
        setSelectedBrief(newBrief)
        setCurrentView('brief')
      } else {
        setCurrentView('home')
      }
    } catch (err) {
      console.error('Failed to refresh briefs:', err)
      setCurrentView('home')
    }
    setPlanningProjectName('')
  }

  const handlePlanningCancel = () => {
    setPlanningProjectName('')
    setCurrentView('home')
  }

  const handleDeleteBrief = async (briefId: string) => {
    try {
      await api.deleteBrief(briefId)
      setBriefs(briefs.filter(b => b.id !== briefId))
      if (selectedBrief?.id === briefId) {
        setSelectedBrief(null)
        setCurrentView('home')
      }
      setDeleteConfirm(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleBriefSelect = (brief: Brief) => {
    setSelectedBrief(brief)
    setCurrentView('brief')
  }

  const handleReview = async (subId: string, status: 'approved' | 'rejected') => {
    await api.updateSubmission(subId, status)
    setSubmissions(submissions.map(s => s.id === subId ? { ...s, status } : s))
  }

  const userData = clerkUser ? {
    name: clerkUser.fullName || clerkUser.username || 'User',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    avatar: clerkUser.imageUrl,
  } : undefined

  const RoleIcon = ({ className = "size-4" }: { className?: string }) => {
    if (currentRole === 'pm') return <LayoutGrid className={className} />
    if (currentRole === 'dev') return <Code className={className} />
    return <Palette className={className} />
  }

  // Not signed in - Landing
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 bg-foreground rounded flex items-center justify-center">
                <Sparkles className="size-4 text-background" />
              </div>
              <span className="font-semibold">Orgio</span>
            </div>
            <SignInButton mode="modal">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </button>
            </SignInButton>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI-Powered Sprint Planning
              </p>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
                One project.<br />Three views.<br />Zero meetings.
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Describe what you're building. Get instant specs for PM, Dev, and Design.
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="btn-primary px-8 py-3 rounded text-sm font-medium inline-flex items-center gap-2">
                Start Building <ArrowRight className="size-4" />
              </button>
            </SignInButton>
            <p className="text-xs text-muted-foreground">
              Free for teams up to 5
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Loading
  if (checkingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Onboarding
  if (needsOnboarding || (driftUser && !driftUser.role) || !orgId) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // Planning View
  if (currentView === 'planning' && planningProjectName) {
    return (
      <PlanningView
        projectName={planningProjectName}
        onComplete={handlePlanningComplete}
        onCancel={handlePlanningCancel}
      />
    )
  }

  // Brief/Project View
  if (currentView === 'brief' && selectedBrief) {
    return (
      <ProjectWorkspace 
        brief={selectedBrief}
        userRole={currentRole}
        onBack={() => { setCurrentView('home'); setSelectedBrief(null); }}
      />
    )
  }

  const activeBriefs = briefs.filter(b => b.status === 'active')
  const pendingSubmissions = submissions.filter(s => s.status === 'pending')
  const approvedSubmissions = submissions.filter(s => s.status === 'approved')

  return (
    <SidebarProvider>
      <AppSidebar 
        user={userData}
        briefs={briefs}
        onBriefSelect={handleBriefSelect}
        onViewChange={(v) => { setCurrentView(v as View); setSelectedBrief(null); }}
        currentView={currentView}
        userRole={currentRole}
      />
      <SidebarInset className="flex flex-col">
        {/* Header */}
        <header className="h-14 flex items-center px-4 border-b">
          <SidebarTrigger className="size-8" />
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium uppercase tracking-wide">
            <RoleIcon className="size-3.5" />
            {currentRole}
          </div>
          <div className="ml-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {/* HOME */}
          {currentView === 'home' && (
            <div className="space-y-6 px-4 pb-6 pt-14">
              {/* Header */}
              <div>
                <h2 className="text-xl font-semibold">Overview</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your sprint planning at a glance
                </p>
              </div>

              {/* Stats Grid - L-bracket style */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x border bg-background">
                  <div className="p-6 space-y-1 card-hover">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <FolderOpen className="size-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Projects</span>
                    </div>
                    <div className="text-3xl font-medium">{briefs.length}</div>
                    <p className="text-muted-foreground text-xs">{activeBriefs.length} active</p>
                  </div>
                  <div className="p-6 space-y-1 card-hover">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Clock className="size-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Pending</span>
                    </div>
                    <div className="text-3xl font-medium">{pendingSubmissions.length}</div>
                    <p className="text-muted-foreground text-xs">awaiting review</p>
                  </div>
                  <div className="p-6 space-y-1 card-hover max-lg:border-t max-lg:border-l-0">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <CheckCircle className="size-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Completed</span>
                    </div>
                    <div className="text-3xl font-medium">{approvedSubmissions.length}</div>
                    <p className="text-muted-foreground text-xs">submissions approved</p>
                  </div>
                  <div className="p-6 space-y-1 card-hover max-lg:border-t">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <RoleIcon className="size-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Your Role</span>
                    </div>
                    <div className="text-3xl font-medium uppercase">{currentRole}</div>
                    <p className="text-muted-foreground text-xs">current perspective</p>
                  </div>
                </div>
              </div>

              {/* New Project Input */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">New Project</h3>
                    <p className="text-xs text-muted-foreground mt-1">Describe what you want to build</p>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="e.g. Build a customer feedback portal..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartPlanning()}
                      className="flex-1 bg-transparent border rounded px-4 py-3 text-sm placeholder:text-muted-foreground/50 input-focus"
                    />
                    <button
                      onClick={handleStartPlanning}
                      disabled={!inputValue.trim() || loading}
                      className="btn-primary px-6 py-3 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : 'Plan'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Projects */}
              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background">
                  <div className="p-6 border-b flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Recent Projects</h3>
                      <p className="text-xs text-muted-foreground mt-1">Your active work</p>
                    </div>
                    <button 
                      onClick={() => setCurrentView('briefs')}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      View all <ArrowRight className="size-3" />
                    </button>
                  </div>

                  {briefs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-14 w-14 rounded bg-muted flex items-center justify-center mb-4">
                        <TrendingUp className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium mb-1">No projects yet</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Create your first project to get started
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {briefs.slice(0, 5).map((brief) => (
                        <div 
                          key={brief.id} 
                          className="flex items-center justify-between p-4 card-hover cursor-pointer"
                          onClick={() => handleBriefSelect(brief)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${
                              brief.status === 'active' ? 'bg-foreground' : 
                              brief.status === 'completed' ? 'bg-muted-foreground' : 'bg-muted'
                            }`} />
                            <div>
                              <p className="text-sm font-medium">{brief.name}</p>
                              <p className="text-xs text-muted-foreground">{brief.status}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(brief.id); }}
                            className="p-2 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PROJECTS VIEW */}
          {currentView === 'briefs' && (
            <div className="space-y-6 px-4 pb-6 pt-14 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">All Projects</h2>
                  <p className="text-sm text-muted-foreground mt-1">{briefs.length} projects total</p>
                </div>
                <Button onClick={() => setCurrentView('home')} variant="outline" size="sm">
                  <Sparkles className="size-4 mr-2" /> New
                </Button>
              </div>

              <div className="relative">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background divide-y">
                  {briefs.map(brief => (
                    <div
                      key={brief.id}
                      className="flex items-center justify-between p-4 card-hover cursor-pointer"
                      onClick={() => handleBriefSelect(brief)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          brief.status === 'active' ? 'bg-foreground' : 
                          brief.status === 'completed' ? 'bg-muted-foreground' : 'bg-muted'
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{brief.name}</p>
                          <p className="text-xs text-muted-foreground">{brief.description || 'No description'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground uppercase">{brief.status}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(brief.id); }}
                          className="p-2 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {briefs.length === 0 && (
                    <div className="p-12 text-center">
                      <p className="text-muted-foreground text-sm">No projects yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REVIEWS VIEW */}
          {currentView === 'reviews' && (
            <div className="space-y-6 px-4 pb-6 pt-14 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold">Submissions</h2>
                <p className="text-sm text-muted-foreground mt-1">Review team work</p>
              </div>

              <div className="relative max-w-2xl">
                <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50" />
                <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50" />

                <div className="border bg-background divide-y">
                  {submissions.map(sub => (
                    <div key={sub.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium">{sub.userName}</p>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            {sub.role} • {sub.durationMinutes}m
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded text-xs uppercase tracking-wide ${
                          sub.status === 'approved' ? 'bg-foreground text-background' :
                          sub.status === 'rejected' ? 'bg-muted text-muted-foreground' :
                          'bg-muted text-foreground'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      <ul className="text-sm text-muted-foreground mb-4 space-y-1">
                        {sub.summaryLines.map((line, i) => <li key={i}>• {line}</li>)}
                      </ul>
                      {sub.status === 'pending' && currentRole === 'pm' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleReview(sub.id, 'approved')}
                            className="btn-primary px-4 py-2 rounded text-sm"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleReview(sub.id, 'rejected')}
                            className="btn-secondary px-4 py-2 rounded text-sm"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {submissions.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                      No submissions yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHAT VIEW */}
          {currentView === 'chat' && (
            <div className="h-[calc(100vh-3.5rem)]">
              <ChatView userRole={currentRole} />
            </div>
          )}

          {/* MCP HUB VIEW */}
          {currentView === 'mcp-hub' && (
            <MCPHub />
          )}
        </main>

        {/* Delete Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="border bg-background p-6 max-w-sm w-full mx-4 animate-slideIn">
              <h3 className="font-semibold mb-2">Delete Project?</h3>
              <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="btn-secondary px-4 py-2 rounded text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteBrief(deleteConfirm)}
                  className="bg-destructive text-destructive-foreground px-4 py-2 rounded text-sm hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
