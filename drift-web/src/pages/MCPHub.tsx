import { useState } from 'react'
import { Search, Star, Download, ExternalLink, Filter, TrendingUp, Zap, Database, Cloud, Code, Brain, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MCPConnector {
  id: string
  name: string
  description: string
  category: string
  logo: string
  rating: number
  downloads: string
  tags: string[]
  featured: boolean
}

const mockConnectors: MCPConnector[] = [
  {
    id: '1',
    name: 'GitHub MCP',
    description: 'Access GitHub repositories, issues, and pull requests directly from your workflow',
    category: 'Development',
    logo: '🐙',
    rating: 4.8,
    downloads: '12.5K',
    tags: ['git', 'version-control', 'collaboration'],
    featured: true
  },
  {
    id: '2',
    name: 'Supabase MCP',
    description: 'Connect to your Supabase database with real-time queries and updates',
    category: 'Database',
    logo: '⚡',
    rating: 4.9,
    downloads: '8.2K',
    tags: ['database', 'postgres', 'real-time'],
    featured: true
  },
  {
    id: '3',
    name: 'OpenAI MCP',
    description: 'Integrate GPT-4, DALL-E, and other OpenAI models into your projects',
    category: 'AI',
    logo: '🤖',
    rating: 4.7,
    downloads: '15.3K',
    tags: ['ai', 'llm', 'gpt'],
    featured: true
  },
  {
    id: '4',
    name: 'Slack MCP',
    description: 'Send messages, manage channels, and automate Slack workflows',
    category: 'Communication',
    logo: '💬',
    rating: 4.6,
    downloads: '6.8K',
    tags: ['messaging', 'notifications', 'team'],
    featured: false
  },
  {
    id: '5',
    name: 'AWS MCP',
    description: 'Manage AWS services including S3, Lambda, EC2, and more',
    category: 'Cloud',
    logo: '☁️',
    rating: 4.5,
    downloads: '9.1K',
    tags: ['cloud', 'infrastructure', 'aws'],
    featured: false
  },
  {
    id: '6',
    name: 'Notion MCP',
    description: 'Read and write to Notion databases, pages, and blocks',
    category: 'Productivity',
    logo: '📝',
    rating: 4.8,
    downloads: '7.4K',
    tags: ['notes', 'documentation', 'knowledge'],
    featured: false
  },
  {
    id: '7',
    name: 'Stripe MCP',
    description: 'Process payments, manage subscriptions, and handle billing',
    category: 'Payments',
    logo: '💳',
    rating: 4.9,
    downloads: '5.6K',
    tags: ['payments', 'billing', 'subscriptions'],
    featured: false
  },
  {
    id: '8',
    name: 'Google Sheets MCP',
    description: 'Read, write, and manipulate Google Sheets data programmatically',
    category: 'Productivity',
    logo: '📊',
    rating: 4.4,
    downloads: '10.2K',
    tags: ['spreadsheets', 'data', 'automation'],
    featured: false
  }
]

const categories = [
  { name: 'All', icon: Filter },
  { name: 'Development', icon: Code },
  { name: 'AI', icon: Brain },
  { name: 'Database', icon: Database },
  { name: 'Cloud', icon: Cloud },
  { name: 'Productivity', icon: FileText }
]

export function MCPHub() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent'>('popular')

  const filteredConnectors = mockConnectors.filter(connector => {
    const matchesSearch = connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         connector.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         connector.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'All' || connector.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const sortedConnectors = [...filteredConnectors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating
    if (sortBy === 'popular') return parseFloat(b.downloads) - parseFloat(a.downloads)
    return 0
  })

  const featuredConnectors = sortedConnectors.filter(c => c.featured)
  const regularConnectors = sortedConnectors.filter(c => !c.featured)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-emerald-600" />
            <h1 className="text-4xl font-bold text-slate-900">MCP Hub</h1>
          </div>
          <p className="text-slate-600 text-lg">
            Discover and connect powerful MCP servers to supercharge your workflow
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search connectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="recent">Recently Added</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category.name
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Featured Section */}
        {featuredConnectors.length > 0 && selectedCategory === 'All' && !searchQuery && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2 className="text-2xl font-bold text-slate-900">Featured Connectors</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredConnectors.map((connector) => (
                <ConnectorCard key={connector.id} connector={connector} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Connectors */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {selectedCategory === 'All' ? 'All Connectors' : `${selectedCategory} Connectors`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularConnectors.map((connector) => (
              <ConnectorCard key={connector.id} connector={connector} />
            ))}
          </div>
        </div>

        {filteredConnectors.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">No connectors found matching your search</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectorCard({ connector, featured = false }: { connector: MCPConnector; featured?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 ${
      featured ? 'ring-2 ring-emerald-500' : ''
    }`}>
      {featured && (
        <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mb-2">
          <TrendingUp className="w-3 h-3" />
          FEATURED
        </div>
      )}
      
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">{connector.logo}</div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-slate-900 mb-1">{connector.name}</h3>
          <p className="text-sm text-slate-600 line-clamp-2">{connector.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="font-semibold">{connector.rating}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-600">
          <Download className="w-4 h-4" />
          <span>{connector.downloads}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {connector.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          Connect
        </Button>
        <Button variant="outline" size="icon">
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
