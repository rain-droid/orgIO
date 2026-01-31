import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/clerk-react'
import { AppSidebar } from '@/components/app-sidebar'
import { Onboarding } from '@/components/onboarding'
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
  createSubmission,
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
  Send,
  Code,
  Palette,
  LayoutGrid,
  FileText,
  X
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
  const [generating, setGenerating] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
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
      
      // Simulate AI generation
      setGenerating(true)
      setTimeout(() => {
        setGeneratedContent(generateRoleContent(currentRole, inputValue))
        setGenerating(false)
      }, 1500)
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
    setGeneratedContent(generateRoleContent(currentRole, brief.name))
    setCurrentView('brief')
  }

  const handleSubmitWork = async () => {
    if (!selectedBrief || !clerkUser || !driftUser) return
    setLoading(true)
    try {
      const newSub = await createSubmission({
        briefId: selectedBrief.id,
        userId: clerkUser.id,
        userName: driftUser.name,
        role: currentRole,
        summaryLines: [`Completed work on ${selectedBrief.name}`],
        durationMinutes: 60,
        matchedTasks: [],
      })
      setSubmissions([newSub, ...submissions])
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (subId: string, status: 'approved' | 'rejected') => {
    await updateSubmissionStatus(subId, status)
    setSubmissions(submissions.map(s => s.id === subId ? { ...s, status } : s))
  }

  const generateRoleContent = (role: Role, name: string) => {
    if (role === 'pm') return 'pm'
    if (role === 'dev') return 'dev'
    return 'designer'
  }

  const userData = clerkUser ? {
    name: clerkUser.fullName || clerkUser.username || 'User',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    avatar: clerkUser.imageUrl,
  } : undefined

  const roleIcon = currentRole === 'pm' ? LayoutGrid : currentRole === 'dev' ? Code : Palette
  const roleColor = currentRole === 'pm' ? 'text-blue-400' : currentRole === 'dev' ? 'text-emerald-400' : 'text-violet-400'
  const roleBg = currentRole === 'pm' ? 'bg-blue-500/10' : currentRole === 'dev' ? 'bg-emerald-500/10' : 'bg-violet-500/10'

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-8 animate-fadeIn">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight">DRIFT</h1>
            <p className="text-muted-foreground text-lg">One brief. Three views. Zero meetings.</p>
          </div>
          <SignInButton mode="modal">
            <Button size="lg" className="h-12 px-8 text-base">
              Get Started <ArrowRight className="ml-2 size-4" />
            </Button>
          </SignInButton>
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
            {roleIcon({ className: `size-3.5 ${roleColor}` })}
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
            <div className="min-h-full flex flex-col">
              {/* Hero Input Section */}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl space-y-6 animate-slideUp">
                  <div className="text-center space-y-2">
                    <h1 className="text-3xl font-semibold">What are we building?</h1>
                    <p className="text-muted-foreground">
                      Describe your feature. AI generates {currentRole === 'pm' ? 'user stories & timeline' : currentRole === 'dev' ? 'architecture & API specs' : 'user flows & components'}.
                    </p>
                  </div>
                  
                  {/* Big Input */}
                  <div className="relative">
                    <textarea
                      placeholder="e.g. Apple Pay Checkout, User Authentication, Dashboard Redesign..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCreateBrief())}
                      className="w-full h-32 p-6 bg-card border border-border rounded-lg text-lg resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                    <Button
                      onClick={handleCreateBrief}
                      disabled={!inputValue.trim() || loading}
                      className="absolute bottom-4 right-4 h-10 px-6"
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : <>Create <ArrowRight className="ml-2 size-4" /></>}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Recent Briefs */}
              {briefs.length > 0 && (
                <div className="border-t border-border/50 p-8">
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">RECENT BRIEFS</h2>
                    <div className="grid gap-2">
                      {briefs.slice(0, 5).map(brief => (
                        <div
                          key={brief.id}
                          className="group flex items-center gap-4 p-4 bg-card/50 hover:bg-card border border-transparent hover:border-border rounded-lg cursor-pointer transition-all"
                          onClick={() => handleBriefSelect(brief)}
                        >
                          <div className={`size-2 rounded-full ${brief.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                          <span className="flex-1 font-medium">{brief.name}</span>
                          <span className="text-xs text-muted-foreground">{brief.status}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(brief.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BRIEF VIEW */}
          {currentView === 'brief' && selectedBrief && (
            <div className="p-8 animate-fadeIn">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Brief Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <button 
                      onClick={() => { setCurrentView('home'); setSelectedBrief(null); }}
                      className="text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
                    >
                      ← Back
                    </button>
                    <h1 className="text-2xl font-semibold">{selectedBrief.name}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentRole !== 'pm' && (
                      <Button onClick={handleSubmitWork} disabled={loading}>
                        <Send className="size-4 mr-2" /> Submit Work
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(selectedBrief.id)}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Generated Content */}
                {generating ? (
                  <div className="flex items-center gap-3 p-6 bg-card border border-border rounded-lg">
                    <div className={`size-10 rounded-lg ${roleBg} flex items-center justify-center`}>
                      <Sparkles className={`size-5 ${roleColor} animate-pulse`} />
                    </div>
                    <div>
                      <p className="font-medium">Generating your {currentRole === 'pm' ? 'sprint plan' : currentRole === 'dev' ? 'technical spec' : 'design spec'}...</p>
                      <p className="text-sm text-muted-foreground">AI is analyzing your brief</p>
                    </div>
                  </div>
                ) : generatedContent && (
                  <div className="space-y-6">
                    {/* PM View */}
                    {currentRole === 'pm' && (
                      <>
                        {/* Kanban */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">📊 SPRINT BOARD</h3>
                          <div className="grid grid-cols-3 gap-4">
                            {['To Do', 'In Progress', 'Done'].map(col => (
                              <div key={col} className="space-y-3">
                                <div className="text-xs font-medium text-muted-foreground">{col}</div>
                                {col === 'To Do' && (
                                  <>
                                    <div className="p-3 bg-background border border-border rounded">Setup payment intent</div>
                                    <div className="p-3 bg-background border border-border rounded">Handle webhook</div>
                                  </>
                                )}
                                {col === 'In Progress' && (
                                  <div className="p-3 bg-background border border-border rounded">UI integration</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* User Stories */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">📝 USER STORIES</h3>
                          <div className="space-y-3">
                            <div className="p-4 bg-background border border-border rounded">
                              <p className="font-medium mb-2">As a customer, I want to pay quickly so I can complete checkout faster.</p>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>✓ Payment button visible when supported</p>
                                <p>✓ Fallback for unsupported devices</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Timeline */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">⏱️ TIMELINE</h3>
                          <div className="flex items-center gap-2">
                            {['Backend', 'Frontend', 'Testing', 'Launch'].map((phase, i) => (
                              <div key={phase} className="flex items-center">
                                <div className={`px-4 py-2 rounded ${i < 2 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                  {phase}
                                </div>
                                {i < 3 && <div className="w-4 h-px bg-border" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Dev View */}
                    {currentRole === 'dev' && (
                      <>
                        {/* Architecture */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">🔧 ARCHITECTURE</h3>
                          <div className="flex items-center justify-center gap-4 py-8">
                            <div className="px-6 py-3 bg-background border border-border rounded">Client</div>
                            <div className="text-muted-foreground">→</div>
                            <div className="px-6 py-3 bg-background border border-border rounded">API</div>
                            <div className="text-muted-foreground">→</div>
                            <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded">Stripe</div>
                          </div>
                        </div>

                        {/* API Endpoints */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">📦 API ENDPOINTS</h3>
                          <div className="font-mono text-sm space-y-4">
                            <div className="p-4 bg-background border border-border rounded">
                              <p className="text-emerald-400">POST /api/payments/create-intent</p>
                              <p className="text-muted-foreground mt-2">Request: {'{ amount, currency }'}</p>
                              <p className="text-muted-foreground">Response: {'{ clientSecret, paymentIntentId }'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Code */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">💻 CODE</h3>
                          <pre className="p-4 bg-background border border-border rounded font-mono text-sm overflow-x-auto">
{`const payment = await stripe.paymentIntents.create({
  amount: total * 100,
  currency: 'usd',
  payment_method_types: ['card'],
});`}
                          </pre>
                        </div>
                      </>
                    )}

                    {/* Designer View */}
                    {currentRole === 'designer' && (
                      <>
                        {/* User Flow */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">📱 USER FLOW</h3>
                          <div className="flex items-center justify-center gap-2 py-6">
                            {['Cart', 'Checkout', 'Payment', 'Success'].map((step, i) => (
                              <div key={step} className="flex items-center">
                                <div className="flex flex-col items-center">
                                  <div className={`size-10 rounded-full flex items-center justify-center ${i < 3 ? 'bg-violet-500/20 text-violet-400' : 'bg-muted text-muted-foreground'}`}>
                                    {i + 1}
                                  </div>
                                  <span className="text-xs mt-2">{step}</span>
                                </div>
                                {i < 3 && <div className="w-8 h-px bg-border mx-2" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Component Spec */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">🎨 COMPONENT SPEC</h3>
                          <div className="flex items-center justify-center py-6">
                            <div className="space-y-4 text-center">
                              <button className="px-8 py-3 bg-foreground text-background rounded-lg font-medium">
                                Pay with Apple Pay
                              </button>
                              <div className="text-xs text-muted-foreground">
                                Height: 48px | Radius: 8px | Background: #000
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* States */}
                        <div className="bg-card border border-border rounded-lg p-6">
                          <h3 className="text-sm font-medium text-muted-foreground mb-4">🖼️ STATES</h3>
                          <div className="flex items-center justify-center gap-6 py-4">
                            {['Default', 'Hover', 'Loading', 'Disabled'].map((state, i) => (
                              <div key={state} className="text-center">
                                <div className={`w-24 h-10 rounded ${i === 3 ? 'bg-muted' : i === 2 ? 'bg-foreground/70' : 'bg-foreground'}`} />
                                <span className="text-xs text-muted-foreground mt-2 block">{state}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
