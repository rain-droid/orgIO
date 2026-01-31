import type { Submission, Task } from '../../types'

interface SubmissionReviewProps {
  submissions: Submission[]
  tasks: Task[]
  onApprove: (submissionId: string) => void
  onReject: (submissionId: string) => void
}

export function SubmissionReview({ submissions, tasks, onApprove, onReject }: SubmissionReviewProps) {
  if (submissions.length === 0) return null

  return (
    <section className="card submission-review">
      <div className="section-header">
        <h3>📥 Work Submissions</h3>
        <span className="muted">{submissions.length} total</span>
      </div>
      <div className="stack">
        {submissions.map((submission) => {
          const matched = tasks.filter((task) => submission.matchedTasks.includes(task.id))
          return (
            <div key={submission.id} className="submission-card">
              <div className="submission-meta">
                <div>
                  <div className="card-title">
                    {submission.userName} ({submission.role.toUpperCase()})
                  </div>
                  <div className="muted">Duration: {submission.durationMinutes} min</div>
                </div>
                <span className={`status ${submission.status}`}>
                  {submission.status.toUpperCase()}
                </span>
              </div>
              <div className="submission-body">
                <div className="submission-summary">
                  <div className="label">Summary</div>
                  <ul>
                    {submission.summaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="submission-tasks">
                  <div className="label">Matches Tasks</div>
                  <ul>
                    {matched.map((task) => (
                      <li key={task.id}>
                        <span className={`checkbox ${task.status === 'done' ? 'checked' : ''}`}>
                          {task.status === 'done' ? '✓' : ''}
                        </span>
                        {task.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {submission.status === 'pending' && (
                <div className="submission-actions">
                  <button className="btn ghost" onClick={() => onReject(submission.id)}>
                    Reject
                  </button>
                  <button className="btn" onClick={() => onApprove(submission.id)}>
                    Approve & Update Tasks ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
