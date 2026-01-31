interface ComponentSpec {
  name: string
  height: string
  radius: string
  color: string
}

interface ComponentSpecCardsProps {
  specs: ComponentSpec[]
}

export function ComponentSpecCards({ specs }: ComponentSpecCardsProps) {
  if (specs.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>🎨 Component Specs</h3>
      </div>
      <div className="stack">
        {specs.map((spec) => (
          <div key={spec.name} className="spec-card">
            <div className="card-title">{spec.name}</div>
            <div className="spec-preview" style={{ background: spec.color }} />
            <div className="muted">
              Height: {spec.height} · Radius: {spec.radius} · Color: {spec.color}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
