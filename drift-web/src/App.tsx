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
    () => briefs.find((brief) => brief.id === activeBriefId) ?? null,
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
    <div className="app">
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="brand">DRIFT</div>
          </div>
          <div className="topbar-actions">
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn primary">Sign in</button>
              </SignInButton>
            </SignedOut>
          </div>
        </header>

        <div className="container">
          {error && <div className="error-banner">{error}</div>}
          {loading && <div className="loading-banner">Loading...</div>}

          <SignedOut>
            <div className="empty">Sign in to view your workspace</div>
          </SignedOut>

          <SignedIn>
            {!activeBrief && (
              <>
                {/* Create Input */}
                <div className="create-input-wrapper">
                  <div className="create-input">
                    <input
                      type="text"
                      placeholder="Create a new brief..."
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBrief()}
                    />
                    <div className="create-input-meta">
                      <span className="meta-tag">
                        <span className="status-dot running" />
                        {driftUser?.role?.toUpperCase() || 'PM'}
                      </span>
                    </div>
                    <button 
                      className="create-btn" 
                      onClick={handleCreateBrief}
                      disabled={!createName.trim()}
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="columns">
                  {/* Active Briefs */}
                  <div className="column">
                    <div className="column-header">
                      <div>
                        <div className="column-title">
                          Active Briefs <span className="count">{briefs.length}</span>
                        </div>
                        <div className="column-subtitle">Your sprint planning briefs</div>
                      </div>
                      <button className="column-action">All →</button>
                    </div>
                    <div className="item-list">
                      {briefs.length === 0 && (
                        <div className="empty">No briefs yet</div>
                      )}
                      {briefs.map((brief) => (
                        <div
                          key={brief.id}
                          className="item-card"
                          onClick={() => setActiveBriefId(brief.id)}
                        >
                          <div className="item-icon running">
                            <span className="status-dot running" />
                          </div>
                          <div className="item-content">
                            <div className="item-title">{brief.name}</div>
                            <div className="item-meta">
                              <span>Just now</span>
                              <span className="item-meta-sep">•</span>
                              <span>{brief.createdBy}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending Reviews */}
                  <div className="column">
                    <div className="column-header">
                      <div>
                        <div className="column-title">
                          Submissions to Review <span className="count">{pendingSubmissions.length}</span>
                        </div>
                        <div className="column-subtitle">Requires your attention</div>
                      </div>
                      <button className="column-action">All →</button>
                    </div>
                    <div className="item-list">
                      {pendingSubmissions.length === 0 && (
                        <div className="empty">No pending reviews</div>
                      )}
                      {pendingSubmissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="item-card"
                          onClick={() => setActiveBriefId(sub.briefId)}
                        >
                          <div className="item-icon pending">
                            <span className="status-dot pending" />
                          </div>
                          <div className="item-content">
                            <div className="item-title">{sub.userName} submitted work</div>
                            <div className="item-meta">
                              <span>{sub.summaryLines[0]}</span>
                            </div>
                          </div>
                          <span className={`pill role-${sub.role}`}>
                            {sub.role.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role Pills */}
                <div className="section">
                  <div className="section-header">
                    <div className="section-title">
                      Your Role <span className="count">Switch perspective</span>
                    </div>
                  </div>
                  <div className="role-tabs">
                    {roles.map((role) => (
                      <button
                        key={role}
                        className={`tab ${activeRole === role ? `active role-${role}` : ''}`}
                        onClick={() => handleRoleChange(role)}
                      >
                        {role.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
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
        </div>
      </div>
    </div>
  )
}

export default App
