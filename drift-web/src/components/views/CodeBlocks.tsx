interface CodeBlocksProps {
  snippets: string[]
}

export function CodeBlocks({ snippets }: CodeBlocksProps) {
  if (snippets.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>💻 Code</h3>
      </div>
      <div className="stack">
        {snippets.map((snippet) => (
          <pre key={snippet} className="code-block">
            <code>{snippet}</code>
          </pre>
        ))}
      </div>
    </section>
  )
}
