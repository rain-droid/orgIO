import { useState, useEffect, useRef, useCallback } from 'react'
import { FileCode, Clock, ChevronDown, ChevronUp, Sparkles, CheckCircle, Upload, Bot, Loader2, Trash2, AlertTriangle, ListChecks, Plus, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'

interface ActivityEntry {
  app: string
  title: string
  file?: string
  duration: number
  timestamp: number
  screenshot?: string
  isRelevant: boolean
}

interface SessionSummaryData {
  sessionId: string
  submissionId?: string
  briefId?: string
  briefName?: string
  durationMinutes: number
  summaryLines: string[]
  activitySummary?: Array<{ app: string; totalDuration: number; files: string[] }>
  notes?: Array<{ text: string; timestamp: number }>
}

interface AnalysisResult {
  updatedTasks: Array<{ taskId?: string; title: string; status: string; wasUpdated?: boolean; reason?: string }>
  newTasks: Array<{ title: string; description?: string; priority?: string; reason?: string }>
  issues: string[]
  aiSummary: string
}

interface ActivityItem {
  id: string
  type: 'insight' | 'note' | 'activity'
  content: string
  timestamp: number
  bullets?: string[]
}

interface SessionActivityProps {
  isVisible: boolean
  onClose: () => void
  sessionSummary?: SessionSummaryData | null
  onAddToWorkspace?: (summary: SessionSummaryData) => void
}

export function SessionActivity({ isVisible, onClose, sessionSummary, onAddToWorkspace }: SessionActivityProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [currentApp, setCurrentApp] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const itemsEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for live activity updates and screen insights
  useEffect(() => {
    const handleActivity = (activity: ActivityEntry) => {
      if (activity.isRelevant) {
        setCurrentApp(activity.app)
        setCurrentFile(activity.file || null)
      } else {
        setCurrentApp(activity.app)
        setCurrentFile(null)
      }
    }

    const handleScreenInsight = (data: { bullets: string[]; timestamp: number }) => {
      if (data.bullets && data.bullets.length > 0) {
        setItems(prev => [...prev, {
          id: `insight-${data.timestamp}`,
          type: 'insight',
          content: data.bullets.join(' • '),
          bullets: data.bullets,
          timestamp: data.timestamp
        }])
      }
    }

    window.api.receive('session:activity', handleActivity)
    window.api.receive('session:screen-insight', handleScreenInsight)
    
    // Reset state for new session
    setItems([])
    setHasAnalyzed(false)
    setIsAnalyzing(false)
    setAnalysisResult(null)

    return () => {
      window.api.removeAllListeners('session:activity')
      window.api.removeAllListeners('session:screen-insight')
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    itemsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

  // Handle analyze session
  const handleAnalyzeSession = async (summary: SessionSummaryData) => {
    if (isAnalyzing || hasAnalyzed) return
    
    setIsAnalyzing(true)
    
    try {
      const result = await window.api.invoke('session:analyze', {
        sessionId: summary.sessionId,
        submissionId: summary.submissionId,
        briefId: summary.briefId,
        activities: summary.activitySummary,
        notes: summary.notes,
        summaryLines: summary.summaryLines,
        durationMinutes: summary.durationMinutes
      })
      
      if (result && !result.error) {
        setHasAnalyzed(true)
        setAnalysisResult(result as AnalysisResult)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle adding note - processes through AI for clean bullet point
  const handleAddNote = async () => {
    if (!inputValue.trim()) return
    
    const noteText = inputValue.trim()
    setInputValue('')
    
    // Add temporary item while processing
    const tempId = `note-${Date.now()}`
    setItems(prev => [...prev, {
      id: tempId,
      type: 'note',
      content: noteText + ' ...',
      timestamp: Date.now()
    }])
    
    // Process through AI
    const result = await window.api.invoke('session:add-note', noteText)
    
    // Update with processed bullet
    if (result?.bullet) {
      setItems(prev => prev.map(item => 
        item.id === tempId 
          ? { ...item, content: result.bullet }
          : item
      ))
    }
  }

  // Handle delete item
  const handleDeleteItem = async (item: ActivityItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    if (item.type === 'note') {
      await window.api.invoke('session:remove-note', item.content)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddNote()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }

  if (!isVisible) return null

  // Session ended - show summary view
  if (sessionSummary) {
    return (
      <div className="glass rounded-lg w-[380px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-emerald-50">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-800">Session Complete</span>
          </div>
          <span className="text-xs text-emerald-600">{sessionSummary.durationMinutes} min</span>
        </div>

        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          {/* Summary Lines */}
          {sessionSummary.summaryLines.length > 0 && (
            <div className="space-y-1">
              {sessionSummary.summaryLines.map((line, idx) => (
                <div key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}

          {/* Activity Breakdown */}
          {sessionSummary.activitySummary && sessionSummary.activitySummary.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Activity</div>
              {sessionSummary.activitySummary.slice(0, 4).map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">{activity.app}</span>
                  <span className="text-gray-500">{Math.round(activity.totalDuration / 60)}m</span>
                </div>
              ))}
            </div>
          )}

          {/* Captured Insights */}
          {items.filter(i => i.type === 'insight').length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-amber-600 font-medium">AI Captured</div>
              {items.filter(i => i.type === 'insight').slice(-5).map((item) => (
                <div key={item.id} className="text-xs text-gray-700 bg-amber-50 rounded px-2 py-1">
                  {item.bullets?.map((b, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Sparkles size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
            <div className="space-y-2 bg-indigo-50 rounded-lg p-2 border border-indigo-200">
              <div className="flex items-center gap-1.5 text-indigo-700 font-medium text-xs">
                <ListChecks size={12} />
                <span>Workspace Updated</span>
              </div>
              
              {/* AI Summary */}
              {analysisResult.aiSummary && (
                <p className="text-[11px] text-indigo-600 italic">{analysisResult.aiSummary}</p>
              )}
              
              {/* Issues - Highlighted */}
              {analysisResult.issues.length > 0 && (
                <div className="bg-red-100 border border-red-200 rounded p-2 space-y-1">
                  <div className="flex items-center gap-1 text-red-700 font-medium text-[10px]">
                    <AlertTriangle size={10} />
                    <span>ATTENTION</span>
                  </div>
                  {analysisResult.issues.map((issue, idx) => (
                    <p key={idx} className="text-[11px] text-red-700">{issue}</p>
                  ))}
                </div>
              )}
              
              {/* Updated Tasks */}
              {analysisResult.updatedTasks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle size={10} />
                    Tasks Updated
                  </div>
                  {analysisResult.updatedTasks.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                        task.status === 'done' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        {task.status === 'done' ? 'DONE' : 'IN PROGRESS'}
                      </span>
                      <span className="text-gray-700 truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* New Tasks */}
              {analysisResult.newTasks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                    <Plus size={10} />
                    New Tasks
                  </div>
                  {analysisResult.newTasks.map((task, idx) => (
                    <div key={idx} className="text-[11px] text-gray-700 truncate">{task.title}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!hasAnalyzed ? (
            <button
              onClick={() => handleAnalyzeSession(sessionSummary)}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors text-xs font-medium"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Add to Workspace
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => onAddToWorkspace?.(sessionSummary)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-medium"
            >
              <ExternalLink size={14} />
              Open in Browser
            </button>
          )}
        </div>
      </div>
    )
  }

  // Active session - show activity feed
  return (
    <div className="glass rounded-lg w-[340px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium">Session Activity</span>
        </div>
        <Button variant="ghost" size="xs" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </Button>
      </div>

      {isExpanded && (
        <>
          {/* Current Activity */}
          {currentApp && (
            <div className="px-3 py-2 bg-gray-50 border-b border-black/5">
              <div className="flex items-center gap-2 text-xs">
                <FileCode size={12} className={currentFile ? 'text-emerald-600' : 'text-gray-400'} />
                <span className={`font-medium ${currentFile ? 'text-gray-800' : 'text-gray-500'}`}>
                  {currentFile || currentApp}
                </span>
                {!currentFile && <span className="text-gray-400 text-[10px]">(not tracked)</span>}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="max-h-[250px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                AI is watching your screen and will capture important moments...
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {items.map((item) => (
                  <div 
                    key={item.id} 
                    className={`group text-xs rounded-lg p-2 ${
                      item.type === 'insight' ? 'bg-amber-50 border border-amber-100' :
                      item.type === 'note' ? 'bg-blue-50 border border-blue-100' :
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        {item.type === 'insight' && <Sparkles size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />}
                        {item.type === 'note' && <Clock size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />}
                        <span className={`${
                          item.type === 'insight' ? 'text-amber-800' : 
                          item.type === 'note' ? 'text-blue-800' : 'text-gray-700'
                        }`}>
                          {item.bullets ? item.bullets.join(' • ') : item.content}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{formatTime(item.timestamp)}</span>
                        {item.type === 'note' && (
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-all"
                          >
                            <Trash2 size={10} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={itemsEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-black/10">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
              className="w-full bg-white/70 rounded-lg px-3 py-1.5 text-xs border border-black/10 focus:outline-none focus:border-blue-400"
            />
          </div>
        </>
      )}
    </div>
  )
}
