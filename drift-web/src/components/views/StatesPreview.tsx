interface StatesPreviewProps {
  states: string[]
}

export function StatesPreview({ states }: StatesPreviewProps) {
  if (states.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>🖼️ States</h3>
      </div>
      <div className="states">
        {states.map((state) => (
          <div key={state} className="state-pill">
            {state}
          </div>
        ))}
      </div>
    </section>
  )
}
