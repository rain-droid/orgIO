interface UserFlowDiagramProps {
  steps: string[]
}

export function UserFlowDiagram({ steps }: UserFlowDiagramProps) {
  if (steps.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>📱 User Flow</h3>
      </div>
      <div className="user-flow">
        {steps.map((step, index) => (
          <div key={step} className="flow-step">
            <span className="flow-node">{step}</span>
            {index < steps.length - 1 && <span className="flow-arrow">→</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
