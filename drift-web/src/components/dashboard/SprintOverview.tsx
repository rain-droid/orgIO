import type { Brief, Submission, Task } from '../../types'

interface SprintOverviewProps {
  briefs: Brief[]
  tasks: Task[]
  submissions: Submission[]
}

function getProgress(tasks: Task[]) {
  const done = tasks.filter((task) => task.status === 'done').length
  const total = tasks.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export function SprintOverview({ briefs, tasks, submissions }: SprintOverviewProps) {
  const activeBrief = briefs[0]
  const briefTasks = tasks.filter((task) => task.briefId === activeBrief?.id)
  const progress = getProgress(briefTasks)
  const recentSubmission = submissions[0]

  return (
    <section className="card sprint-overview">
      <div className="section-header">
        <h2>Team Overview</h2>
        <span className="muted">{activeBrief?.name}</span>
      </div>
      <div className="overview-grid">
        <div className="overview-card">
          <div className="label">Overall Progress</div>
          <div className="progress-bar">
            <div className="progress-fill role-pm" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="muted">
            {progress.done}/{progress.total} tasks done
          </div>
        </div>
        <div className="overview-card">
          <div className="label">Latest Activity</div>
          {recentSubmission ? (
            <>
              <div className="card-title">{recentSubmission.userName} submitted work</div>
              <div className="muted">{recentSubmission.summaryLines[0]}</div>
            </>
          ) : (
            <div className="muted">No activity yet.</div>
          )}
        </div>
        <div className="overview-card">
          <div className="label">Pending Reviews</div>
          <div className="card-title">
            {submissions.filter((submission) => submission.status === 'pending').length}
          </div>
          <div className="muted">Waiting for approval</div>
        </div>
      </div>
    </section>
  )
}
