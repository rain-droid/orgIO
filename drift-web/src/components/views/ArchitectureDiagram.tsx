interface ArchitectureNode {
  label: string
}

interface ArchitectureDiagramProps {
  nodes: ArchitectureNode[]
}

export function ArchitectureDiagram({ nodes }: ArchitectureDiagramProps) {
  if (nodes.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>🔧 Architecture</h3>
      </div>
      <div className="architecture">
        {nodes.map((node, index) => (
          <div key={node.label} className="architecture-node">
            <div className="node">{node.label}</div>
            {index < nodes.length - 1 && <div className="arrow">→</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
