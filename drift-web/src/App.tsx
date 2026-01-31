import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/clerk-react'
import { AppSidebar } from '@/components/app-sidebar'
import { Onboarding } from '@/components/onboarding'
import { BriefPage } from '@/pages/BriefPage'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import type { Brief, Submission, User, Role } from './types'
import {
  fetchBriefs,
  createBrief,
  deleteBrief,
  fetchSubmissions,
  updateSubmissionStatus,
  fetchUser,
} from './lib/data'
import { 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  Clock,
  MoreHorizontal,
  Code,
  Palette,
  LayoutGrid,
} from 'lucide-react'

type View = 'home' | 'brief' | 'reviews'

export default function App() {
  const { isSignedIn, user: clerkUser } = useUser()
  const { orgId } = useAuth()

  const [briefs, setBriefs] = useState<Brief[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [driftUser, setDriftUser] = useState<User | null>(null)
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const currentRole: Role = driftUser?.role || 'dev'

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
          const briefsData = await fetchBriefs(orgId)
          setBriefs(briefsData)
          if (briefsData.length > 0) {
            const briefIds = briefsData.map(b => b.id)
            const subsData = await fetchSubmissions(briefIds)
            setSubmissions(subsData)
          }
        }
      } catch {
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
    } finally {
      setCheckingUser(false)
    }
  }

  const handleCreateBrief = async () => {
    if (!inputValue.trim() || !orgId || !clerkUser) return
    setLoading(true)
    try {
      const newBrief = await createBrief({
        orgId,
        name: inputValue,
        description: '',
        createdBy: clerkUser.id,
      })
      setBriefs([newBrief, ...briefs])
      setSelectedBrief(newBrief)
      setInputValue('')
      setCurrentView('brief')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBrief = async (briefId: string) => {
    try {
      await deleteBrief(briefId)
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
    await updateSubmissionStatus(subId, status)
    setSubmissions(submissions.map(s => s.id === subId ? { ...s, status } : s))
  }

  const userData = clerkUser ? {
    name: clerkUser.fullName || clerkUser.username || 'User',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    avatar: clerkUser.imageUrl,
  } : undefined

  const roleColor = currentRole === 'pm' ? 'text-blue-400' : currentRole === 'dev' ? 'text-emerald-400' : 'text-violet-400'
  const roleBg = currentRole === 'pm' ? 'bg-blue-500/10' : currentRole === 'dev' ? 'bg-emerald-500/10' : 'bg-violet-500/10'
  
  const RoleIcon = () => {
    const iconClass = `size-3.5 ${roleColor}`
    if (currentRole === 'pm') return <LayoutGrid className={iconClass} />
    if (currentRole === 'dev') return <Code className={iconClass} />
    return <Palette className={iconClass} />
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center hero-bg relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        
        <div className="relative text-center space-y-10 animate-slideUp px-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm text-primary font-medium mb-4">
              <Sparkles className="size-4" />
              AI-Powered Product Specs
            </div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
              Drift
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              One brief. Three views. Zero meetings.
            </p>
          </div>
          <div className="space-y-4">
            <SignInButton mode="modal">
              <Button size="lg" className="h-14 px-10 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
                Start Building <ArrowRight className="ml-2 size-5" />
              </Button>
            </SignInButton>
            <p className="text-sm text-muted-foreground">
              Free for teams up to 5 members
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (checkingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!orgId || needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // Brief Page - Full screen without sidebar
  if (currentView === 'brief' && selectedBrief) {
    return (
      <BriefPage 
        brief={selectedBrief}
        userRole={currentRole}
        onBack={() => { setCurrentView('home'); setSelectedBrief(null); }}
      />
    )
  }

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
        {/* Minimal Header */}
        <header className="h-12 flex items-center px-4 border-b border-border/50">
          <SidebarTrigger className="size-8" />
          <div className="flex-1" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${roleBg}`}>
            <RoleIcon />
            <span className={`text-xs font-medium ${roleColor}`}>{currentRole.toUpperCase()}</span>
          </div>
          <div className="ml-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* HOME VIEW */}
          {currentView === 'home' && (
            <div className="p-6 space-y-6 animate-fadeIn">
              {/* Input Section - Top */}
              <div className="relative bg-card border border-border rounded-lg p-4 input-glow transition-all">
                <input
                  type="text"
                  placeholder="Plan a new brief for Drift to handle..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBrief()}
                  className="w-full bg-transparent text-base placeholder:text-muted-foreground/50 focus:outline-none"
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>Role</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBg} ${roleColor}`}>
                      {currentRole.toUpperCase()}
                    </span>
                  </div>
                  <Button
                    onClick={handleCreateBrief}
                    disabled={!inputValue.trim() || loading}
                    size="sm"
                    className="h-8"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  </Button>
                </div>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Briefs Column */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">Active Briefs</h2>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {briefs.filter(b => b.status === 'active').length}
                      </span>
                    </div>
                    <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      All <ArrowRight className="size-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {briefs.filter(b => b.status === 'active').slice(0, 5).map(brief => (
                      <div
                        key={brief.id}
                        className="group flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all"
                        onClick={() => handleBriefSelect(brief)}
                      >
                        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{brief.name}</div>
                          <div className="text-xs text-muted-foreground">Just now</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(brief.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                        >
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    {briefs.filter(b => b.status === 'active').length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                        No active briefs yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Pending Reviews Column */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">Pending Reviews</h2>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {submissions.filter(s => s.status === 'pending').length}
                      </span>
                    </div>
                    <button 
                      onClick={() => setCurrentView('reviews')}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      All <ArrowRight className="size-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {submissions.filter(s => s.status === 'pending').slice(0, 5).map(sub => (
                      <div
                        key={sub.id}
                        className="group flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-yellow-500/50 cursor-pointer transition-all"
                        onClick={() => setCurrentView('reviews')}
                      >
                        <div className="size-2 rounded-full bg-yellow-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{sub.userName}</div>
                          <div className="text-xs text-muted-foreground">{sub.role.toUpperCase()} • {sub.durationMinutes}m</div>
                        </div>
                        <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
                          Pending
                        </span>
                      </div>
                    ))}
                    {submissions.filter(s => s.status === 'pending').length === 0 && (
                      <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                        No pending reviews
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Completed Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Completed</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {submissions.filter(s => s.status === 'approved').length}
                    </span>
                  </div>
                  <button 
                    onClick={() => setCurrentView('reviews')}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    All <ArrowRight className="size-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {submissions.filter(s => s.status === 'approved').slice(0, 6).map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
                    >
                      <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{sub.userName}</div>
                        <div className="text-xs text-muted-foreground">{sub.role.toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                  {submissions.filter(s => s.status === 'approved').length === 0 && (
                    <div className="col-span-full p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No completed submissions yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REVIEWS VIEW */}
          {currentView === 'reviews' && (
            <div className="p-8 animate-fadeIn">
              <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-semibold mb-6">Submissions</h1>
                <div className="space-y-4">
                  {submissions.map(sub => (
                    <div key={sub.id} className="p-6 bg-card border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium">{sub.userName}</p>
                          <p className="text-sm text-muted-foreground">{sub.role.toUpperCase()} • {sub.durationMinutes}m</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${
                          sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          sub.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {sub.status === 'pending' ? <Clock className="size-3" /> : <CheckCircle className="size-3" />}
                          {sub.status}
                        </span>
                      </div>
                      <ul className="text-sm text-muted-foreground mb-4">
                        {sub.summaryLines.map((line, i) => <li key={i}>• {line}</li>)}
                      </ul>
                      {sub.status === 'pending' && currentRole === 'pm' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReview(sub.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReview(sub.id, 'rejected')}>Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {submissions.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      No submissions yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 animate-slideUp">
              <h3 className="font-semibold mb-2">Delete Brief?</h3>
              <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleDeleteBrief(deleteConfirm)}>
                  <Trash2 className="size-4 mr-2" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
