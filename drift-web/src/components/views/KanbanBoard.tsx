import type { Task } from '../../types'

interface KanbanBoardProps {
  tasks: Task[]
}

const columns: Array<{ key: Task['status']; title: string }> = [
  { key: 'todo', title: 'To Do' },
  { key: 'in_progress', title: 'In Progress' },
  { key: 'done', title: 'Done' },
]

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>📊 Sprint Board</h3>
      </div>
      <div className="kanban">
        {columns.map((column) => (
          <div key={column.key} className="kanban-column">
            <div className="kanban-title">{column.title}</div>
            <div className="kanban-items">
              {tasks
                .filter((task) => task.status === column.key)
                .map((task) => (
                  <div key={task.id} className="kanban-item">
                    <div className="card-title">{task.title}</div>
                    <div className="muted">{task.description}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
