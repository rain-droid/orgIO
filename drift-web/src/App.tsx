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
  fetchSubmissions,
  createSubmission,
  updateSubmissionStatus,
  fetchUser,
} from './lib/data'
import { Send, Sparkles, FileText, CheckCircle, Clock, ArrowRight, Loader2 } from 'lucide-react'

type View = 'home' | 'brief-chat' | 'briefs' | 'reviews'

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
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([])

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
    if (!inputValue.trim() || !orgId || !clerkUser) return
    setLoading(true)
    try {
      const newBrief = await createBrief({
        orgId: orgId,
        name: inputValue,
        description: '',
        createdBy: clerkUser.id,
      })
      setBriefs([newBrief, ...briefs])
      setSelectedBrief(newBrief)
      setChatMessages([{ role: 'user', content: inputValue }])
      setInputValue('')
      setCurrentView('brief-chat')
      
      // Simulate AI generation
      setGenerating(true)
      setTimeout(() => {
        const roleContent = getRoleSpecificContent(currentRole, inputValue)
        setChatMessages(prev => [...prev, { role: 'ai', content: roleContent }])
        setGenerating(false)
      }, 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getRoleSpecificContent = (role: Role, briefName: string): string => {
    if (role === 'pm') {
      return `## ${briefName}\n\n### User Stories\n- As a user, I want to...\n- As an admin, I want to...\n\n### Acceptance Criteria\n- [ ] Feature works as expected\n- [ ] Tests are passing\n- [ ] Documentation updated\n\n### Timeline\n- Sprint 1: Research & Design\n- Sprint 2: Implementation\n- Sprint 3: Testing & Launch`
    } else if (role === 'dev') {
      return `## ${briefName}\n\n### Architecture\n\`\`\`\nClient → API Gateway → Service → Database\n\`\`\`\n\n### Tech Stack\n- Frontend: React + TypeScript\n- Backend: Node.js\n- Database: PostgreSQL\n\n### API Endpoints\n- \`POST /api/...\`\n- \`GET /api/...\`\n- \`PUT /api/...\``
    } else {
      return `## ${briefName}\n\n### User Flow\nLanding → Sign Up → Dashboard → Feature → Success\n\n### Components\n- Primary Button: 48px height, 8px radius\n- Card: 16px padding, 1px border\n- Input: 40px height, no radius\n\n### States\n- Default\n- Hover\n- Active\n- Disabled`
    }
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
        summaryLines: [`Work completed for ${selectedBrief.name}`],
        durationMinutes: 60,
        matchedTasks: [],
      })
      setSubmissions([newSub, ...submissions])
      setChatMessages(prev => [...prev, 
        { role: 'user', content: 'Work submitted for review ✓' },
        { role: 'ai', content: 'Great work! Your submission has been sent to the PM for review.' }
      ])
    } catch (err) {
      console.error(err)
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
    } finally {
      setLoading(false)
    }
  }

  const handleBriefSelect = (brief: Brief) => {
    setSelectedBrief(brief)
    setChatMessages([
      { role: 'user', content: brief.name },
      { role: 'ai', content: getRoleSpecificContent(currentRole, brief.name) }
    ])
    setCurrentView('brief-chat')
  }

  const handleViewChange = (view: 'home' | 'briefs' | 'reviews') => {
    setCurrentView(view)
    if (view === 'home') {
      setSelectedBrief(null)
      setChatMessages([])
    }
  }

  const userData = clerkUser ? {
    name: clerkUser.fullName || clerkUser.username || 'User',
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    avatar: clerkUser.imageUrl,
  } : undefined

  const pendingReviews = submissions.filter(s => s.status === 'pending').length
  const activeBriefs = briefs.filter(b => b.status === 'active').length

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="bg-primary text-primary-foreground flex aspect-square size-12 items-center justify-center">
              <FileText className="size-6" />
            </div>
            <h1 className="text-3xl font-bold">Drift</h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm">AI-powered sprint planning</p>
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
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-mono text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Needs onboarding
  if (!orgId || needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <SidebarProvider>
      <AppSidebar 
        user={userData}
        briefs={briefs}
        onBriefSelect={handleBriefSelect}
        onViewChange={handleViewChange}
        currentView={currentView}
        userRole={currentRole}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b px-4">
          <SidebarTrigger />
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={`px-2 py-1 ${
              currentRole === 'pm' ? 'bg-pink-100 text-pink-700' :
              currentRole === 'dev' ? 'bg-blue-100 text-blue-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {currentRole.toUpperCase()}
            </span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Home View */}
          {currentView === 'home' && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Big Input */}
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Plan a new brief for your team to handle..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCreateBrief()}
                    className="w-full h-14 px-4 pr-24 bg-card border text-base font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    onClick={handleCreateBrief}
                    disabled={!inputValue.trim() || loading}
                    className="absolute right-2 top-2 h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Describe what needs to be built. AI will generate {currentRole === 'pm' ? 'user stories & acceptance criteria' : currentRole === 'dev' ? 'architecture & API specs' : 'user flows & component specs'}.
                </p>
              </div>

              {/* Two Column Layout */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Active Briefs */}
                <div className="border bg-card">
                  <div className="p-4 border-b flex items-center justify-between">
      <div>
                      <h2 className="font-semibold">Active Briefs</h2>
                      <p className="text-xs text-muted-foreground font-mono">What you're working on</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{activeBriefs}</span>
                  </div>
                  <div className="divide-y max-h-80 overflow-auto">
                    {briefs.filter(b => b.status === 'active').map(brief => (
                      <button
                        key={brief.id}
                        onClick={() => handleBriefSelect(brief)}
                        className="w-full p-4 text-left hover:bg-accent/50 transition-colors flex items-center gap-3"
                      >
                        <div className="size-2 bg-chart-1 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{brief.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">Active</div>
      </div>
                        <ArrowRight className="size-4 text-muted-foreground" />
        </button>
                    ))}
                    {activeBriefs === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm font-mono">
                        No active briefs
                      </div>
                    )}
                  </div>
                </div>

                {/* Pending Reviews (for PM) or Submissions (for others) */}
                <div className="border bg-card">
                  <div className="p-4 border-b flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">{currentRole === 'pm' ? 'Pending Reviews' : 'Your Submissions'}</h2>
                      <p className="text-xs text-muted-foreground font-mono">
                        {currentRole === 'pm' ? 'Requires your attention' : 'Track your work'}
        </p>
      </div>
                    <span className="text-xs font-mono text-muted-foreground">{pendingReviews}</span>
                  </div>
                  <div className="divide-y max-h-80 overflow-auto">
                    {submissions.map(sub => (
                      <div key={sub.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">{sub.userName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{sub.role.toUpperCase()}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 flex items-center gap-1 ${
                            sub.status === 'approved' ? 'bg-green-100 text-green-700' :
                            sub.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {sub.status === 'approved' && <CheckCircle className="size-3" />}
                            {sub.status === 'pending' && <Clock className="size-3" />}
                            {sub.status}
                          </span>
                        </div>
                        {sub.status === 'pending' && currentRole === 'pm' && (
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" onClick={() => handleReview(sub.id, 'approved')} className="h-7 text-xs">
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReview(sub.id, 'rejected')} className="h-7 text-xs">
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {submissions.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm font-mono">
                        No submissions yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Brief Chat View */}
          {currentView === 'brief-chat' && selectedBrief && (
            <div className="max-w-3xl mx-auto">
              {/* Chat Messages */}
              <div className="space-y-6 mb-6">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'ai' && (
                      <div className="size-8 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Sparkles className="size-4" />
                      </div>
                    )}
                    <div className={`max-w-2xl ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground px-4 py-3' 
                        : 'bg-card border px-4 py-3'
                    }`}>
                      {msg.role === 'ai' ? (
                        <div className="prose prose-sm max-w-none font-mono text-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      ) : (
                        <p className="font-mono text-sm">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {generating && (
                  <div className="flex gap-3">
                    <div className="size-8 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Sparkles className="size-4" />
                    </div>
                    <div className="bg-card border px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                        <Loader2 className="size-4 animate-spin" />
                        Generating {currentRole === 'pm' ? 'user stories' : currentRole === 'dev' ? 'architecture' : 'design specs'}...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!generating && chatMessages.length > 0 && currentRole !== 'pm' && (
                <div className="border-t pt-4">
                  <Button onClick={handleSubmitWork} disabled={loading} className="w-full h-12">
                    <Send className="size-4 mr-2" />
                    Submit Work for Review
                  </Button>
                </div>
              )}

              {/* Back Button */}
              <div className="mt-6">
                <Button variant="ghost" onClick={() => handleViewChange('home')} className="text-muted-foreground">
                  ← Back to Home
                </Button>
              </div>
            </div>
          )}

          {/* Briefs List View */}
          {currentView === 'briefs' && (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-xl font-semibold mb-6">All Briefs</h1>
              <div className="border bg-card divide-y">
                {briefs.map(brief => (
                  <button
                    key={brief.id}
                    onClick={() => handleBriefSelect(brief)}
                    className="w-full p-4 text-left hover:bg-accent/50 transition-colors flex items-center gap-3"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{brief.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{brief.status}</div>
                    </div>
                  </button>
                ))}
                {briefs.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                    No briefs yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviews View */}
          {currentView === 'reviews' && (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-xl font-semibold mb-6">Reviews</h1>
              <div className="border bg-card divide-y">
                {submissions.map(sub => (
                  <div key={sub.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{sub.userName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{sub.role.toUpperCase()} • {sub.durationMinutes}min</div>
                      </div>
                      <span className={`text-xs px-2 py-1 ${
                        sub.status === 'approved' ? 'bg-green-100 text-green-700' :
                        sub.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                    <ul className="text-sm text-muted-foreground font-mono">
                      {sub.summaryLines.map((line, i) => <li key={i}>• {line}</li>)}
                    </ul>
                    {sub.status === 'pending' && currentRole === 'pm' && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleReview(sub.id, 'approved')}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleReview(sub.id, 'rejected')}>Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
                {submissions.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                    No submissions yet
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
