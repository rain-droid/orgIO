interface TimelineItem {
  label: string
  progress: number
}

interface TimelineViewProps {
  milestones: TimelineItem[]
}

export function TimelineView({ milestones }: TimelineViewProps) {
  if (milestones.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>⏱️ Timeline</h3>
      </div>
      <div className="timeline">
        {milestones.map((milestone) => (
          <div key={milestone.label} className="timeline-row">
            <div className="timeline-label">{milestone.label}</div>
            <div className="progress-bar">
              <div className="progress-fill role-pm" style={{ width: `${milestone.progress * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
