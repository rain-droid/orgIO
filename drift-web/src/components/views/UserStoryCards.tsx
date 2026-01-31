interface UserStory {
  title: string
  acceptance: string[]
}

interface UserStoryCardsProps {
  stories: UserStory[]
}

export function UserStoryCards({ stories }: UserStoryCardsProps) {
  if (stories.length === 0) return null

  return (
    <section className="card view-card">
      <div className="section-header">
        <h3>📝 User Stories</h3>
      </div>
      <div className="stack">
        {stories.map((story) => (
          <div key={story.title} className="story-card">
            <div className="card-title">{story.title}</div>
            <ul>
              {story.acceptance.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
