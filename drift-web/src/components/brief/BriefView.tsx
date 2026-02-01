import type { Brief, BriefContent, Role, Submission, Task } from '../../types'
import { SubmissionReview } from './SubmissionReview'
import { KanbanBoard } from '../views/KanbanBoard'
import { UserStoryCards } from '../views/UserStoryCards'
import { TimelineView } from '../views/TimelineView'
import { ArchitectureDiagram } from '../views/ArchitectureDiagram'
import { APISpecCards } from '../views/APISpecCards'
import { CodeBlocks } from '../views/CodeBlocks'
import { UserFlowDiagram } from '../views/UserFlowDiagram'
import { ComponentSpecCards } from '../views/ComponentSpecCards'
import { StatesPreview } from '../views/StatesPreview'

interface BriefViewProps {
  brief: Brief
  briefContent?: BriefContent
  tasks: Task[]
  submissions: Submission[]
  activeRole: Role
  onRoleChange: (role: Role) => void
  onBack: () => void
  onSimulateSubmission: (briefId: string, role: Role) => void
  onApproveSubmission: (submissionId: string) => void
  onRejectSubmission: (submissionId: string) => void
}

const roleLabels: Record<Role, string> = {
  pm: 'PM View',
  dev: 'Dev View',
  designer: 'Design View',
}

const roleIcons: Record<Role, string> = {
  pm: '📋',
  dev: '💻',
  designer: '🎨',
}

function getProgress(tasks: Task[], role: Role) {
  const roleTasks = tasks.filter((task) => task.role === role)
  const done = roleTasks.filter((task) => task.status === 'done').length
  return { done, total: roleTasks.length }
}

export function BriefView({
  brief,
  briefContent,
  tasks,
  submissions,
  activeRole,
  onRoleChange,
  onBack,
  onSimulateSubmission,
  onApproveSubmission,
  onRejectSubmission,
}: BriefViewProps) {
  const pending = submissions.filter((submission) => submission.status === 'pending')
  const progressByRole = {
    pm: getProgress(tasks, 'pm'),
    dev: getProgress(tasks, 'dev'),
    designer: getProgress(tasks, 'designer'),
  }

  return (
    <section className="brief-view">
      <div className="brief-header card">
        <button className="btn ghost" onClick={onBack}>
          ← Projects
        </button>
        <div className="brief-title">
          <h2>{brief.name}</h2>
          <p className="muted">{brief.description}</p>
        </div>
        <div className="role-tabs">
          {(Object.keys(roleLabels) as Role[]).map((role) => (
            <button
              key={role}
              className={`tab ${activeRole === role ? 'active' : ''} role-${role}`}
              onClick={() => onRoleChange(role)}
            >
              {roleIcons[role]} {roleLabels[role]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid two">
        <div className="card progress-card">
          <h3>Progress</h3>
          {(Object.keys(progressByRole) as Role[]).map((role) => {
            const progress = progressByRole[role]
            const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
            return (
              <div key={role} className="progress-row">
                <div className="progress-label">
                  <span className={`pill role-${role}`}>{role.toUpperCase()}</span>
                  <span className="muted">
                    {progress.done}/{progress.total} done
                  </span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill role-${role}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
          <div className="progress-actions">
            <button className="btn" onClick={() => onSimulateSubmission(brief.id, activeRole)}>
              Simulate Submission
            </button>
            <span className="muted">Creates a mock desktop session for review.</span>
          </div>
        </div>
        <div className="card">
          <h3>Pending Reviews</h3>
          <div className="stack">
            {pending.length === 0 && <div className="empty muted">No submissions waiting.</div>}
            {pending.map((submission) => (
              <div key={submission.id} className="submission-mini">
                <div>
                  <div className="card-title">{submission.userName}</div>
                  <div className="muted">{submission.summaryLines[0]}</div>
                </div>
                <span className={`pill role-${submission.role}`}>
                  {submission.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="role-view">
        {activeRole === 'pm' && (
          <>
            <KanbanBoard tasks={tasks.filter((task) => task.role === 'pm')} />
            <UserStoryCards stories={briefContent?.userStories ?? []} />
            <TimelineView milestones={briefContent?.timeline ?? []} />
          </>
        )}
        {activeRole === 'dev' && (
          <>
            <ArchitectureDiagram nodes={briefContent?.architecture ?? []} />
            <APISpecCards endpoints={briefContent?.apiEndpoints ?? []} />
            <CodeBlocks snippets={briefContent?.codeSnippets ?? []} />
          </>
        )}
        {activeRole === 'designer' && (
          <>
            <UserFlowDiagram steps={briefContent?.userFlow ?? []} />
            <ComponentSpecCards specs={briefContent?.componentSpec ?? []} />
            <StatesPreview states={briefContent?.states ?? []} />
          </>
        )}
      </div>

      <SubmissionReview
        submissions={submissions}
        tasks={tasks}
        onApprove={onApproveSubmission}
        onReject={onRejectSubmission}
      />
    </section>
  )
}
