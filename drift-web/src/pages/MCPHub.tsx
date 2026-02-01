import { useState } from 'react'
import { Search, Check, Plus, ExternalLink, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MCPConnector {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
}

const connectors: MCPConnector[] = [
  {
    id: '1',
    name: 'GitHub',
    description: 'Repositories, issues, and pull requests',
    icon: '🐙',
    connected: true
  },
  {
    id: '2',
    name: 'Notion',
    description: 'Pages, databases, and blocks',
    icon: '📝',
    connected: true
  },
  {
    id: '3',
    name: 'Slack',
    description: 'Messages, channels, and notifications',
    icon: '💬',
    connected: true
  },
  {
    id: '4',
    name: 'Jira',
    description: 'Issues, sprints, and projects',
    icon: '🎯',
    connected: true
  },
  {
    id: '5',
    name: 'Linear',
    description: 'Issues, cycles, and roadmaps',
    icon: '📊',
    connected: false
  },
  {
    id: '6',
    name: 'Figma',
    description: 'Design files and components',
    icon: '🎨',
    connected: false
  },
  {
    id: '7',
    name: 'Google Drive',
    description: 'Files, docs, and sheets',
    icon: '📁',
    connected: false
  },
  {
    id: '8',
    name: 'OpenAI',
    description: 'GPT-4, DALL-E, and embeddings',
    icon: '🤖',
    connected: false
  },
  {
    id: '9',
    name: 'Supabase',
    description: 'Database and authentication',
    icon: '⚡',
    connected: false
  },
  {
    id: '10',
    name: 'AWS',
    description: 'S3, Lambda, and EC2',
    icon: '☁️',
    connected: false
  }
]

export function MCPHub() {
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState(connectors)

  const filteredConnectors = items.filter(connector =>
    connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    connector.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const connectedCount = items.filter(c => c.connected).length

  const toggleConnection = (id: string) => {
    setItems(prev => prev.map(c => 
      c.id === id ? { ...c, connected: !c.connected } : c
    ))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center">
            <Plug className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">MCP Hub</h1>
            <p className="text-sm text-muted-foreground">
              {connectedCount} of {items.length} connected
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Connected */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Connected
        </h2>
        <div className="space-y-2">
          {filteredConnectors.filter(c => c.connected).map((connector) => (
            <ConnectorRow 
              key={connector.id} 
              connector={connector} 
              onToggle={() => toggleConnection(connector.id)}
            />
          ))}
          {filteredConnectors.filter(c => c.connected).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No connected integrations
            </p>
          )}
        </div>
      </div>

      {/* Available */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Available
        </h2>
        <div className="space-y-2">
          {filteredConnectors.filter(c => !c.connected).map((connector) => (
            <ConnectorRow 
              key={connector.id} 
              connector={connector}
              onToggle={() => toggleConnection(connector.id)}
            />
          ))}
          {filteredConnectors.filter(c => !c.connected).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All integrations connected
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectorRow({ connector, onToggle }: { connector: MCPConnector; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors group">
      <div className="text-2xl">{connector.icon}</div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm">{connector.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{connector.description}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        
        <Button
          variant={connector.connected ? "secondary" : "default"}
          size="sm"
          onClick={onToggle}
          className={connector.connected ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : ""}
        >
          {connector.connected ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              Connected
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 mr-1" />
              Connect
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
