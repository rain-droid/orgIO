import { useMemo, useState, useEffect, useCallback } from 'react'
import './App.css'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react'
import type { Brief, Role, Submission, Task, User } from './types'
import { BriefView } from './components/brief/BriefView'
import {
  createBrief,
  createSubmission,
  fetchBriefs,
  fetchSubmissions,
  fetchTasks,
  fetchUser,
  markTasksDone,
  syncUser,
  updateSubmissionStatus,
  updateUserRole,
} from './lib/data'

const roles: Role[] = ['pm', 'dev', 'designer']

function App() {
  const { user: clerkUser } = useUser()
  const [driftUser, setDriftUser] = useState<User | null>(null)
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState<'home' | 'briefs' | 'reviews'>('home')
  const [createName, setCreateName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orgId = clerkUser?.organizationMemberships?.[0]?.organization?.id ?? 'personal'

  const activeRole = driftUser?.role ?? 'pm'

  useEffect(() => {
    let mounted = true
    async function syncClerkUser() {
      if (!clerkUser) {
        setDriftUser(null)
        return
      }
      try {
        let existingUser = await fetchUser(clerkUser.id)
        if (!existingUser) {
          existingUser = await syncUser({
            id: clerkUser.id,
            orgId,
            email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
            name: clerkUser.fullName ?? clerkUser.username ?? 'User',
            avatarUrl: clerkUser.imageUrl ?? null,
          })
        }
        if (mounted) setDriftUser(existingUser)
      } catch (err) {
        console.error('Failed to sync user:', err)
      }
    }
    syncClerkUser()
    return () => { mounted = false }
  }, [clerkUser, orgId])

  const handleRoleChange = useCallback(async (newRole: Role) => {
    if (!driftUser) return
    try {
      const updatedUser = await updateUserRole(driftUser.id, newRole)
      setDriftUser(updatedUser)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [driftUser])

  const activeBrief = useMemo(
    () => briefs.find((b) => b.id === activeBriefId) ?? null,
    [briefs, activeBriefId]
  )

  const pendingSubmissions = submissions.filter((s) => s.status === 'pending')

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!clerkUser) return
      setLoading(true)
      setError(null)
      try {
        const fetchedBriefs = await fetchBriefs(orgId)
        if (!mounted) return
        setBriefs(fetchedBriefs)
        const briefIds = fetchedBriefs.map((b) => b.id)
        const [fetchedTasks, fetchedSubmissions] = await Promise.all([
          fetchTasks(briefIds),
          fetchSubmissions(briefIds),
        ])
        if (!mounted) return
        setTasks(fetchedTasks)
        setSubmissions(fetchedSubmissions)
      } catch (err) {
        if (!mounted) return
        setError((err as Error).message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [clerkUser, orgId])

  const handleCreateBrief = async () => {
    if (!createName.trim() || !clerkUser) return
    setLoading(true)
    try {
      const newBrief = await createBrief({
        orgId,
        name: createName.trim(),
        description: '',
        createdBy: clerkUser.fullName ?? clerkUser.username ?? 'User',
      })
      setBriefs((prev) => [newBrief, ...prev])
      setCreateName('')
      setActiveBriefId(newBrief.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSimulateSubmission = async (briefId: string, role: Role) => {
    if (!clerkUser) return
    setLoading(true)
    try {
      const briefTasks = tasks.filter((t) => t.briefId === briefId && t.role === role)
      const matchedTasks = briefTasks.slice(0, 2).map((t) => t.id)
      const submission = await createSubmission({
        briefId,
        userId: clerkUser.id,
        userName: clerkUser.fullName ?? clerkUser.username ?? 'User',
        role,
        summaryLines:
          role === 'pm'
            ? ['Prioritized sprint backlog', 'Reviewed dependencies', 'Updated timeline']
            : role === 'dev'
              ? ['Implemented Stripe webhook', 'Added error handling', 'Wrote unit tests']
              : ['Designed Apple Pay button', 'Defined component states', 'Updated user flow'],
        durationMinutes: 154,
        matchedTasks,
      })
      setSubmissions((prev) => [submission, ...prev])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSubmission = async (submissionId: string) => {
    const submission = submissions.find((s) => s.id === submissionId)
    if (!submission) return
    setLoading(true)
    try {
      await updateSubmissionStatus(submissionId, 'approved')
      await markTasksDone(submission.matchedTasks)
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: 'approved' } : s))
      )
      setTasks((prev) =>
        prev.map((t) => (submission.matchedTasks.includes(t.id) ? { ...t, status: 'done' } : t))
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectSubmission = async (submissionId: string) => {
    setLoading(true)
    try {
      await updateSubmissionStatus(submissionId, 'rejected')
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: 'rejected' } : s))
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-dot"></span>
            <span className="logo-text">DRIFT</span>
          </div>
        </div>

        <SignedIn>
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeNav === 'home' && !activeBrief ? 'active' : ''}`}
              onClick={() => { setActiveNav('home'); setActiveBriefId(null); }}
            >
              <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L1 6v9h5V10h4v5h5V6L8 1z"/>
              </svg>
              Home
            </button>
            <button 
              className={`nav-item ${activeNav === 'briefs' ? 'active' : ''}`}
              onClick={() => { setActiveNav('briefs'); setActiveBriefId(null); }}
            >
              <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z"/>
              </svg>
              Briefs
              {briefs.length > 0 && <span className="nav-badge">{briefs.length}</span>}
            </button>
            <button 
              className={`nav-item ${activeNav === 'reviews' ? 'active' : ''}`}
              onClick={() => { setActiveNav('reviews'); setActiveBriefId(null); }}
            >
              <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 11H7V9h2v2zm0-4H7V3h2v4z"/>
              </svg>
              Reviews
              {pendingSubmissions.length > 0 && (
                <span className="nav-badge warning">{pendingSubmissions.length}</span>
              )}
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Your Role</div>
            <div className="role-switcher">
              {roles.map((role) => (
                <button
                  key={role}
                  className={`role-btn ${activeRole === role ? `active role-${role}` : ''}`}
                  onClick={() => handleRoleChange(role)}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </SignedIn>

        <div className="sidebar-footer">
          <SignedIn>
            <div className="user-menu">
              <UserButton />
              <span className="user-name">{clerkUser?.firstName || 'User'}</span>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-signin">Sign in</button>
            </SignInButton>
          </SignedOut>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {error && <div className="toast error">{error}</div>}
        {loading && <div className="toast loading">Loading...</div>}

        <SignedOut>
          <div className="auth-prompt">
            <h1>Welcome to Drift</h1>
            <p>AI-powered sprint planning with personalized role views</p>
            <SignInButton mode="modal">
              <button className="btn primary large">Get Started</button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!activeBrief && (
            <>
              {/* Page Header */}
              <header className="page-header">
                <div className="page-title">
                  <h1>{activeNav === 'home' ? 'Dashboard' : activeNav === 'briefs' ? 'Briefs' : 'Reviews'}</h1>
                  <p className="page-subtitle">
                    {activeNav === 'home' && 'Your sprint planning overview'}
                    {activeNav === 'briefs' && 'Manage your team briefs'}
                    {activeNav === 'reviews' && 'Review submitted work'}
                  </p>
                </div>
                <div className="page-actions">
                  <div className="create-bar">
                    <input
                      type="text"
                      placeholder="Create new brief..."
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBrief()}
                    />
                    <button 
                      className="btn primary"
                      onClick={handleCreateBrief}
                      disabled={!createName.trim()}
                    >
                      Create
                    </button>
                  </div>
                </div>
              </header>

              {/* Dashboard Content */}
              {activeNav === 'home' && (
                <div className="dashboard-grid">
                  {/* Stats Row */}
                  <div className="stats-row">
                    <div className="stat-card">
                      <div className="stat-value">{briefs.length}</div>
                      <div className="stat-label">Active Briefs</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{pendingSubmissions.length}</div>
                      <div className="stat-label">Pending Reviews</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{tasks.filter(t => t.status === 'done').length}</div>
                      <div className="stat-label">Tasks Done</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{tasks.length}</div>
                      <div className="stat-label">Total Tasks</div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="content-section">
                    <div className="section-header">
                      <h2>Recent Briefs</h2>
                      <button className="link-btn" onClick={() => setActiveNav('briefs')}>View all →</button>
                    </div>
                    <div className="list">
                      {briefs.length === 0 ? (
                        <div className="empty-state">
                          <p>No briefs yet. Create your first brief to get started.</p>
                        </div>
                      ) : (
                        briefs.slice(0, 5).map((brief) => (
                          <div key={brief.id} className="list-item" onClick={() => setActiveBriefId(brief.id)}>
                            <div className="list-item-icon">
                              <span className="status-indicator active"></span>
                            </div>
                            <div className="list-item-content">
                              <div className="list-item-title">{brief.name}</div>
                              <div className="list-item-meta">Created by {brief.createdBy}</div>
                            </div>
                            <div className="list-item-action">→</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Pending Reviews */}
                  <div className="content-section">
                    <div className="section-header">
                      <h2>Pending Reviews</h2>
                      <button className="link-btn" onClick={() => setActiveNav('reviews')}>View all →</button>
                    </div>
                    <div className="list">
                      {pendingSubmissions.length === 0 ? (
                        <div className="empty-state">
                          <p>No pending reviews.</p>
                        </div>
                      ) : (
                        pendingSubmissions.slice(0, 5).map((sub) => (
                          <div key={sub.id} className="list-item" onClick={() => setActiveBriefId(sub.briefId)}>
                            <div className="list-item-icon">
                              <span className="status-indicator pending"></span>
                            </div>
                            <div className="list-item-content">
                              <div className="list-item-title">{sub.userName}</div>
                              <div className="list-item-meta">{sub.summaryLines[0]}</div>
                            </div>
                            <span className={`role-tag role-${sub.role}`}>{sub.role}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Briefs List */}
              {activeNav === 'briefs' && (
                <div className="content-section full">
                  <div className="list">
                    {briefs.length === 0 ? (
                      <div className="empty-state large">
                        <h3>No briefs yet</h3>
                        <p>Create your first brief to start sprint planning with your team.</p>
                      </div>
                    ) : (
                      briefs.map((brief) => (
                        <div key={brief.id} className="list-item" onClick={() => setActiveBriefId(brief.id)}>
                          <div className="list-item-icon">
                            <span className="status-indicator active"></span>
                          </div>
                          <div className="list-item-content">
                            <div className="list-item-title">{brief.name}</div>
                            <div className="list-item-meta">
                              Created by {brief.createdBy} • {tasks.filter(t => t.briefId === brief.id).length} tasks
                            </div>
                          </div>
                          <div className="list-item-action">→</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Reviews List */}
              {activeNav === 'reviews' && (
                <div className="content-section full">
                  <div className="list">
                    {pendingSubmissions.length === 0 ? (
                      <div className="empty-state large">
                        <h3>All caught up!</h3>
                        <p>No pending submissions to review.</p>
                      </div>
                    ) : (
                      pendingSubmissions.map((sub) => (
                        <div key={sub.id} className="list-item" onClick={() => setActiveBriefId(sub.briefId)}>
                          <div className="list-item-icon">
                            <span className="status-indicator pending"></span>
                          </div>
                          <div className="list-item-content">
                            <div className="list-item-title">{sub.userName} submitted work</div>
                            <div className="list-item-meta">{sub.summaryLines.join(' • ')}</div>
                          </div>
                          <span className={`role-tag role-${sub.role}`}>{sub.role}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeBrief && (
            <BriefView
              brief={activeBrief}
              briefContent={activeBrief.content ?? undefined}
              tasks={tasks.filter((t) => t.briefId === activeBrief.id)}
              submissions={submissions.filter((s) => s.briefId === activeBrief.id)}
              activeRole={activeRole}
              onRoleChange={handleRoleChange}
              onBack={() => setActiveBriefId(null)}
              onSimulateSubmission={handleSimulateSubmission}
              onApproveSubmission={handleApproveSubmission}
              onRejectSubmission={handleRejectSubmission}
            />
          )}
        </SignedIn>
      </main>
    </div>
  )
}

export default App
