import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/clerk-react'
import { AppSidebar } from '@/components/app-sidebar'
import { Onboarding } from '@/components/onboarding'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Brief, Submission, User, Role } from './types'
import {
  fetchBriefs,
  createBrief,
  fetchSubmissions,
  createSubmission,
  updateSubmissionStatus,
  fetchUser,
  updateUserRole,
} from './lib/data'
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react'

type View = 'dashboard' | 'briefs' | 'reviews' | 'brief-detail'

export default function App() {
  const { isSignedIn, user: clerkUser } = useUser()
  const { orgId } = useAuth()

  const [briefs, setBriefs] = useState<Brief[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [driftUser, setDriftUser] = useState<User | null>(null)
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [newBriefName, setNewBriefName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)

  const currentRole: Role = driftUser?.role || 'dev'

  // Check if user exists and needs onboarding
  useEffect(() => {
    if (!isSignedIn || !clerkUser || !orgId) {
      setCheckingUser(false)
      return
    }

    const checkUser = async () => {
      try {
        const userData = await fetchUser(clerkUser.id)
        if (!userData) {
          setNeedsOnboarding(true)
        } else {
          setDriftUser(userData)
          // Load data
          const briefsData = await fetchBriefs(orgId)
          setBriefs(briefsData)
          if (briefsData.length > 0) {
            const briefIds = briefsData.map(b => b.id)
            const subsData = await fetchSubmissions(briefIds)
            setSubmissions(subsData)
          }
        }
      } catch {
        // User doesn't exist, needs onboarding
        setNeedsOnboarding(true)
      } finally {
        setCheckingUser(false)
      }
    }
    checkUser()
  }, [isSignedIn, clerkUser, orgId])

  const handleOnboardingComplete = async () => {
    if (!clerkUser || !orgId) return
    setNeedsOnboarding(false)
    setCheckingUser(true)
    try {
      const userData = await fetchUser(clerkUser.id)
      setDriftUser(userData)
      const briefsData = await fetchBriefs(orgId)
      setBriefs(briefsData)
      if (briefsData.length > 0) {
        const briefIds = briefsData.map(b => b.id)
        const subsData = await fetchSubmissions(briefIds)
        setSubmissions(subsData)
      }
    } finally {
      setCheckingUser(false)
    }
  }

  const handleCreateBrief = async () => {
    if (!newBriefName.trim() || !orgId || !clerkUser) return
    setLoading(true)
    try {
      const newBrief = await createBrief({
        orgId: orgId,
        name: newBriefName,
        description: '',
        createdBy: clerkUser.id,
      })
      setBriefs([newBrief, ...briefs])
      setNewBriefName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brief')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (role: Role) => {
    if (!clerkUser) return
    try {
      await updateUserRole(clerkUser.id, role)
      setDriftUser(prev => prev ? { ...prev, role } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleSubmit = async (briefId: string) => {
    if (!clerkUser || !driftUser) return
    setLoading(true)
    try {
      const brief = briefs.find(b => b.id === briefId)
      const newSub = await createSubmission({
        briefId: briefId,
        userId: clerkUser.id,
        userName: driftUser.name,
        role: currentRole,
        summaryLines: [`Work completed for ${brief?.name || 'brief'}`],
        durationMinutes: 60,
        matchedTasks: [],
      })
      setSubmissions([newSub, ...submissions])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (submissionId: string, status: 'approved' | 'rejected') => {
    setLoading(true)
    try {
      await updateSubmissionStatus(submissionId, status)
      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, status } : s
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review')
    } finally {
      setLoading(false)
    }
  }

  const handleBriefSelect = (brief: Brief) => {
    setSelectedBrief(brief)
    setCurrentView('brief-detail')
  }

  const handleViewChange = (view: 'dashboard' | 'briefs' | 'reviews') => {
    setCurrentView(view)
    setSelectedBrief(null)
  }

  const userData = clerkUser ? {
    name: clerkUser.fullName || clerkUser.username || 'User',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    avatar: clerkUser.imageUrl,
  } : undefined

  // Stats
  const stats = {
    total: briefs.length,
    active: briefs.filter(b => b.status === 'active').length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="bg-primary text-primary-foreground flex aspect-square size-12 items-center justify-center rounded-xl">
              <FileText className="size-6" />
            </div>
            <h1 className="text-3xl font-bold">Drift</h1>
          </div>
          <p className="text-muted-foreground">AI-powered sprint planning</p>
          <SignInButton mode="modal">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Sign In to Continue
            </Button>
          </SignInButton>
        </div>
      </div>
    )
  }

  // Loading
  if (checkingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Needs onboarding (no org or no user record)
  if (!orgId || needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div>
      <SidebarProvider>
        <AppSidebar 
          user={userData}
          briefs={briefs}
          onBriefSelect={handleBriefSelect}
          onViewChange={handleViewChange}
          currentView={currentView}
        />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Drift</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {currentView === 'dashboard' && 'Dashboard'}
                      {currentView === 'briefs' && 'Briefs'}
                      {currentView === 'reviews' && 'Reviews'}
                      {currentView === 'brief-detail' && selectedBrief?.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-4 px-4">
              {/* Role Switcher */}
              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                {(['pm', 'dev', 'designer'] as Role[]).map(role => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      currentRole === role
                        ? role === 'pm' 
                          ? 'bg-pink-500/20 text-pink-400'
                          : role === 'dev'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-violet-500/20 text-violet-400'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {role.toUpperCase()}
                  </button>
                ))}
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {/* Toast */}
          {error && (
            <div className="fixed top-4 right-4 z-50 bg-destructive/15 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">×</button>
            </div>
          )}

          {/* Content */}
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Dashboard View */}
            {currentView === 'dashboard' && (
              <>
                {/* Stats */}
                <div className="grid auto-rows-min gap-4 md:grid-cols-4">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Briefs</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-2xl font-bold text-chart-1">{stats.active}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Active</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Pending Review</div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-2xl font-bold text-cyan-400">{stats.approved}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Approved</div>
                  </div>
                </div>

                {/* Create Brief */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New brief name..."
                      value={newBriefName}
                      onChange={(e) => setNewBriefName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBrief()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleCreateBrief} 
                      disabled={!newBriefName.trim() || loading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Plus className="size-4 mr-2" />
                      Create Brief
                    </Button>
                  </div>
                </div>

                {/* Recent Briefs */}
                <div className="rounded-xl border bg-card">
                  <div className="p-4 border-b">
                    <h2 className="font-semibold">Recent Briefs</h2>
                  </div>
                  <div className="divide-y">
                    {briefs.slice(0, 5).map(brief => (
                      <div 
                        key={brief.id}
                        onClick={() => handleBriefSelect(brief)}
                        className="p-4 flex items-center gap-4 hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className={`size-2 rounded-full ${brief.status === 'active' ? 'bg-chart-1' : 'bg-yellow-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{brief.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {brief.description || 'No description'}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          brief.status === 'active' 
                            ? 'bg-chart-1/20 text-chart-1' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {brief.status}
                        </span>
                      </div>
                    ))}
                    {briefs.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No briefs yet. Create your first one above!
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Briefs View */}
            {currentView === 'briefs' && (
              <div className="rounded-xl border bg-card">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold">All Briefs</h2>
                  <span className="text-xs text-muted-foreground">{briefs.length} briefs</span>
                </div>
                <div className="divide-y">
                  {briefs.map(brief => (
                    <div 
                      key={brief.id}
                      onClick={() => handleBriefSelect(brief)}
                      className="p-4 flex items-center gap-4 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <FileText className="size-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{brief.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {brief.description || 'No description'}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        brief.status === 'active' 
                          ? 'bg-chart-1/20 text-chart-1' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {brief.status}
                      </span>
                    </div>
                  ))}
                  {briefs.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No briefs yet
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviews View */}
            {currentView === 'reviews' && (
              <div className="rounded-xl border bg-card">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold">Submissions for Review</h2>
                  <span className="text-xs text-muted-foreground">{submissions.filter(s => s.status === 'pending').length} pending</span>
                </div>
                <div className="divide-y">
                  {submissions.map(sub => (
                    <div key={sub.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium">{sub.userName} - {sub.role.toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground">
                            {sub.durationMinutes} minutes worked
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                          sub.status === 'approved' 
                            ? 'bg-chart-1/20 text-chart-1' 
                            : sub.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {sub.status === 'approved' && <CheckCircle className="size-3" />}
                          {sub.status === 'pending' && <Clock className="size-3" />}
                          {sub.status}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        <ul className="list-disc list-inside">
                          {sub.summaryLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      {sub.status === 'pending' && currentRole === 'pm' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReview(sub.id, 'approved')}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReview(sub.id, 'rejected')}
                            className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {submissions.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No submissions yet
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Brief Detail View */}
            {currentView === 'brief-detail' && selectedBrief && (
              <>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => handleViewChange('briefs')}>
                    ← Back to Briefs
                  </Button>
                  {currentRole !== 'pm' && (
                    <Button 
                      onClick={() => handleSubmit(selectedBrief.id)}
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Submit Work
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">{selectedBrief.name}</h1>
                    <span className={`text-xs px-3 py-1 rounded ${
                      selectedBrief.status === 'active' 
                        ? 'bg-chart-1/20 text-chart-1' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {selectedBrief.status}
                    </span>
                  </div>

                  {selectedBrief.description && (
                    <p className="text-muted-foreground mb-6">{selectedBrief.description}</p>
                  )}

                  {/* Role-specific content */}
                  {selectedBrief.content && (
                    <div className="space-y-6">
                      {currentRole === 'pm' && selectedBrief.content.userStories && (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">User Stories</h3>
                            <div className="space-y-2">
                              {selectedBrief.content.userStories.map((story, i) => (
                                <div key={i} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="font-medium">{story.title}</div>
                                  {story.acceptance.length > 0 && (
                                    <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                                      {story.acceptance.map((criteria, j) => (
                                        <li key={j}>{criteria}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {currentRole === 'dev' && (
                        <div className="space-y-4">
                          {selectedBrief.content.architecture && selectedBrief.content.architecture.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Architecture</h3>
                              <div className="flex flex-wrap gap-2">
                                {selectedBrief.content.architecture.map((item, i) => (
                                  <span key={i} className="px-3 py-2 bg-cyan-500/20 text-cyan-400 text-sm rounded">
                                    {item.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedBrief.content.apiEndpoints && selectedBrief.content.apiEndpoints.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">API Endpoints</h3>
                              <div className="space-y-2">
                                {selectedBrief.content.apiEndpoints.map((endpoint, i) => (
                                  <div key={i} className="p-3 bg-muted/50 rounded-lg font-mono text-sm">
                                    <div className="font-medium">{endpoint.title}</div>
                                    <div className="text-muted-foreground mt-1">Request: {endpoint.request}</div>
                                    <div className="text-muted-foreground">Response: {endpoint.response}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {currentRole === 'designer' && (
                        <div className="space-y-4">
                          {selectedBrief.content.userFlow && selectedBrief.content.userFlow.length > 0 && (
                            <div>
                              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">User Flow</h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                {selectedBrief.content.userFlow.map((step, i) => (
                                  <span key={i} className="flex items-center gap-2">
                                    <span className="px-3 py-2 bg-violet-500/20 text-violet-400 text-sm rounded">
                                      {step}
                                    </span>
                                    {i < selectedBrief.content!.userFlow.length - 1 && (
                                      <span className="text-muted-foreground">→</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedBrief.content.componentSpec && selectedBrief.content.componentSpec.length > 0 && (
      <div>
                              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Components</h3>
                              <div className="grid gap-2 md:grid-cols-2">
                                {selectedBrief.content.componentSpec.map((comp, i) => (
                                  <div key={i} className="p-3 bg-muted/50 rounded-lg">
                                    <div className="font-medium">{comp.name}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {comp.height} · {comp.radius} · {comp.color}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedBrief.content && (
                    <div className="text-center text-muted-foreground py-8">
                      No content available for this brief yet.
      </div>
                  )}
      </div>
    </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
