interface Endpoint {
  title: string
  request: string
  response: string
}

interface APISpecCardsProps {
  endpoints: Endpoint[]
}

export function APISpecCards({ endpoints }: APISpecCardsProps) {
  if (endpoints.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>📦 API Endpoints</h3>
      </div>
      <div className="stack">
        {endpoints.map((endpoint) => (
          <div key={endpoint.title} className="api-card">
            <div className="card-title">{endpoint.title}</div>
            <div className="muted">Request: {endpoint.request}</div>
            <div className="muted">Response: {endpoint.response}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
