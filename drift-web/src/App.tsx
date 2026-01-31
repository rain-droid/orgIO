import { useMemo, useState, useEffect, useCallback } from 'react'
import './App.css'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react'
import type { Brief, Role, Submission, Task, User } from './types'
import { BriefView } from './components/brief/BriefView'
import { SprintOverview } from './components/dashboard/SprintOverview'
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
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orgId = clerkUser?.organizationMemberships?.[0]?.organization?.id ?? 'personal'

  // Active role comes from driftUser or fallback to pm
  const activeRole = driftUser?.role ?? 'pm'

  // Sync Clerk user to Supabase users table
  useEffect(() => {
    let mounted = true
    async function syncClerkUser() {
      if (!clerkUser) {
        setDriftUser(null)
        return
      }
      try {
        // Try to fetch existing user first
        let existingUser = await fetchUser(clerkUser.id)
        if (!existingUser) {
          // If not found, sync from Clerk
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
    return () => {
      mounted = false
    }
  }, [clerkUser, orgId])

  // Handle role change (persisted to database)
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
    () => briefs.find((brief) => brief.id === activeBriefId) ?? null,
    [briefs, activeBriefId]
  )

  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending')

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
        const briefIds = fetchedBriefs.map((brief) => brief.id)
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
    return () => {
      mounted = false
    }
  }, [clerkUser, orgId])

  const handleCreateBrief = async () => {
    if (!createName.trim() || !clerkUser) return
    setLoading(true)
    setError(null)
    try {
      const newBrief = await createBrief({
        orgId,
        name: createName.trim(),
        description: createDescription.trim() || 'No description yet.',
        createdBy: clerkUser.fullName ?? clerkUser.username ?? 'User',
      })
      setBriefs((prev) => [newBrief, ...prev])
      setCreateName('')
      setCreateDescription('')
      setShowCreate(false)
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
    setError(null)
    try {
      const briefTasks = tasks.filter((task) => task.briefId === briefId && task.role === role)
      const matchedTasks = briefTasks.slice(0, 2).map((task) => task.id)
      const submission = await createSubmission({
        briefId,
        userId: clerkUser.id,
        userName: clerkUser.fullName ?? clerkUser.username ?? 'User',
        role,
        summaryLines:
          role === 'pm'
            ? ['Prioritized sprint backlog', 'Reviewed dependencies', 'Updated timeline milestones']
            : role === 'dev'
              ? ['Implemented Stripe webhook handler', 'Added error handling for payments', 'Wrote unit tests']
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
    const submission = submissions.find((item) => item.id === submissionId)
    if (!submission) return
    setLoading(true)
    setError(null)
    try {
      await updateSubmissionStatus(submissionId, 'approved')
      await markTasksDone(submission.matchedTasks)
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submissionId ? { ...item, status: 'approved' } : item
        )
      )
      setTasks((prev) =>
        prev.map((task) =>
          submission.matchedTasks.includes(task.id) ? { ...task, status: 'done' } : task
        )
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectSubmission = async (submissionId: string) => {
    setLoading(true)
    setError(null)
    try {
      await updateSubmissionStatus(submissionId, 'rejected')
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submissionId ? { ...item, status: 'rejected' } : item
        )
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">DRIFT</div>
        <div className="topbar-actions">
          <SignedIn>
            <button className="btn ghost" onClick={() => setShowCreate((prev) => !prev)}>
              + New Brief
            </button>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn">Sign in</button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <main className="container">
        {error && <div className="card error-banner">{error}</div>}
        {loading && <div className="card loading-banner">Loading workspace...</div>}
        <SignedOut>
          <section className="card">
            <h2>Sign in to view your Drift workspace.</h2>
            <p className="muted">Clerk powers org-aware access and roles.</p>
          </section>
        </SignedOut>
        <SignedIn>
        {!activeBrief && (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">AI Sprint Planning</div>
                <h1>One brief. Three perspectives. Zero meetings.</h1>
                <p className="muted">
                  Drift turns a single brief into role-personalized views and auto-tracks progress
                  through submissions.
                </p>
              </div>
              <div className="hero-card card">
                <h3>Role Views</h3>
                <div className="role-pills">
                  {roles.map((role) => (
                    <span key={role} className={`pill role-${role}`}>
                      {role.toUpperCase()}
                    </span>
                  ))}
                </div>
                <p className="muted">Kanban, architecture diagrams, user flows and more.</p>
              </div>
            </section>

            {showCreate && (
              <section className="card create-brief">
                <div className="field">
                  <label>Brief Name</label>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="Apple Pay Checkout"
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    placeholder="Enable Apple Pay with fallbacks and clear error handling."
                  />
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button className="btn" onClick={handleCreateBrief}>
                    Create Brief
                  </button>
                </div>
              </section>
            )}

            <section className="grid two">
              <div className="card">
                <h2>Active Briefs</h2>
                <div className="card-list">
                  {briefs.length === 0 && (
                    <div className="empty muted">No briefs yet. Create one to begin.</div>
                  )}
                  {briefs.map((brief) => (
                    <button
                      key={brief.id}
                      className="card-item"
                      onClick={() => setActiveBriefId(brief.id)}
                    >
                      <div>
                        <div className="card-title">{brief.name}</div>
                        <div className="muted">{brief.description}</div>
                      </div>
                      <div className="card-meta">
                        <span className="status active">Active</span>
                        <span>{brief.createdBy}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2>Pending Reviews</h2>
                <div className="card-list">
                  {pendingSubmissions.length === 0 && (
                    <div className="empty muted">No submissions yet.</div>
                  )}
                  {pendingSubmissions.map((submission) => (
                    <button
                      key={submission.id}
                      className="card-item"
                      onClick={() => setActiveBriefId(submission.briefId)}
                    >
                      <div>
                        <div className="card-title">{submission.userName} submitted work</div>
                        <div className="muted">
                          {submission.summaryLines.slice(0, 1).join('')}
                        </div>
                      </div>
                      <div className="card-meta">
                        <span className={`pill role-${submission.role}`}>
                          {submission.role.toUpperCase()}
                        </span>
                        <span>Review →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <SprintOverview briefs={briefs} tasks={tasks} submissions={submissions} />
          </>
        )}

        {activeBrief && (
          <BriefView
            brief={activeBrief}
            briefContent={activeBrief.content ?? undefined}
            tasks={tasks.filter((task) => task.briefId === activeBrief.id)}
            submissions={submissions.filter((submission) => submission.briefId === activeBrief.id)}
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
