import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, FileCode, Clock, Eye, EyeOff, ChevronDown, ChevronUp, Sparkles, CheckCircle, Upload, Bot, Loader2, Trash2, AlertTriangle, ListChecks, Plus, ExternalLink } from 'lucide-react'
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

interface SessionMessage {
  type: 'activity' | 'note' | 'system' | 'summary' | 'ai_insight' | 'auto_bullet' | 'analysis'
  content: string
  timestamp: number
  app?: string
  file?: string
  screenshot?: string
  isRelevant?: boolean
  summaryData?: SessionSummaryData
  analysisData?: AnalysisResult
  id?: string // For deletion
  bullets?: string[] // For auto_bullet type
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

// Analysis result from backend
interface AnalysisResult {
  updatedTasks: Array<{ taskId?: string; title: string; status: string; wasUpdated?: boolean; reason?: string }>
  newTasks: Array<{ title: string; description?: string; priority?: string; reason?: string }>
  issues: string[]
  aiSummary: string
}

interface SessionChatProps {
  isVisible: boolean
  onClose: () => void
  sessionSummary?: SessionSummaryData | null
  onAddToWorkspace?: (summary: SessionSummaryData) => void
}

export function SessionChat({ isVisible, sessionSummary, onAddToWorkspace }: SessionChatProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showScreenshots, setShowScreenshots] = useState(false)
  const [lastActivity, setLastActivity] = useState<ActivityEntry | null>(null)
  const [isLoadingInsight, setIsLoadingInsight] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activityCountRef = useRef(0)
  const lastInsightTimeRef = useRef(0)

  // Generate AI insight based on recent activities
  const generateAIInsight = useCallback(async () => {
    if (isLoadingInsight) return
    
    // Don't generate too frequently (min 30 seconds apart)
    const now = Date.now()
    if (now - lastInsightTimeRef.current < 30000) return
    
    setIsLoadingInsight(true)
    lastInsightTimeRef.current = now
    
    try {
      const result = await window.api.invoke('session:get-live-insight')
      
      if (result && result.insight && !result.error) {
        setMessages(prev => [...prev, {
          type: 'ai_insight',
          content: result.insight,
          timestamp: Date.now(),
          id: `insight-${Date.now()}`
        }])
      }
    } catch (error) {
      console.error('Failed to get AI insight:', error)
    } finally {
      setIsLoadingInsight(false)
    }
  }, [isLoadingInsight])

  // Listen for live activity updates and screen insights
  useEffect(() => {
    const handleActivity = (activity: ActivityEntry) => {
      setLastActivity(activity)
      
      // Only add message if activity is relevant and different from last
      if (activity.isRelevant) {
        const content = activity.file 
          ? `Working on ${activity.file}`
          : `Active in ${activity.app}`
        
        setMessages(prev => {
          // Avoid duplicate messages for same activity
          const lastMsg = prev[prev.length - 1]
          if (lastMsg?.type === 'activity' && lastMsg.content === content) {
            return prev
          }
          
          return [...prev, {
            type: 'activity',
            content,
            timestamp: Date.now(),
            app: activity.app,
            file: activity.file,
            screenshot: activity.screenshot,
            isRelevant: true,
            id: `activity-${Date.now()}`
          }]
        })
        
        // Count relevant activities and trigger AI insight every 5 activities
        activityCountRef.current++
        if (activityCountRef.current >= 5) {
          activityCountRef.current = 0
          generateAIInsight()
        }
      }
    }

    // Handle live screen insights (auto-generated bullet points)
    const handleScreenInsight = (data: { bullets: string[]; timestamp: number }) => {
      if (data.bullets && data.bullets.length > 0) {
        setMessages(prev => [...prev, {
          type: 'auto_bullet',
          content: data.bullets.join(' • '),
          bullets: data.bullets,
          timestamp: data.timestamp,
          id: `auto-${data.timestamp}`
        }])
      }
    }

    window.api.receive('session:activity', handleActivity)
    window.api.receive('session:screen-insight', handleScreenInsight)
    
    // Reset analysis state for new session
    setHasAnalyzed(false)
    setIsAnalyzing(false)
    
    // Add initial system message
    setMessages([{
      type: 'system',
      content: '🤖 Session gestartet. KI analysiert deinen Screen live und notiert Wichtiges.',
      timestamp: Date.now()
    }])

    // Periodic AI insight (every 60 seconds) - now less frequent since we have screen analysis
    const insightInterval = setInterval(() => {
      generateAIInsight()
    }, 90000)

    return () => {
      window.api.removeAllListeners('session:activity')
      window.api.removeAllListeners('session:screen-insight')
      clearInterval(insightInterval)
    }
  }, [generateAIInsight])

  // Delete a message/note
  const handleDeleteMessage = async (msgId: string | undefined, msgContent: string) => {
    if (!msgId) return
    
    setMessages(prev => prev.filter(m => m.id !== msgId))
    
    // Also remove from backend notes if it was a note
    await window.api.invoke('session:remove-note', msgContent)
  }

  // Add summary message when session ends
  useEffect(() => {
    if (sessionSummary) {
      setMessages(prev => {
        // Check if summary already added
        if (prev.some(m => m.type === 'summary')) return prev
        
        return [...prev, {
          type: 'summary',
          content: 'Session completed',
          timestamp: Date.now(),
          summaryData: sessionSummary
        }]
      })
    }
  }, [sessionSummary])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle analyze session and add to workspace
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
        
        // Add analysis result as message
        setMessages(prev => [...prev, {
          type: 'analysis',
          content: 'Workspace aktualisiert',
          timestamp: Date.now(),
          analysisData: result as AnalysisResult
        }])
        
        // Call the original callback if provided (optional - to open web app)
        // onAddToWorkspace?.(summary)
      } else {
        // Show error
        setMessages(prev => [...prev, {
          type: 'system',
          content: `❌ Analyse fehlgeschlagen: ${result?.error || 'Unbekannter Fehler'}`,
          timestamp: Date.now()
        }])
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setMessages(prev => [...prev, {
        type: 'system',
        content: `❌ Analyse fehlgeschlagen: ${String(error)}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle sending notes
  const handleSend = async () => {
    if (!inputValue.trim()) return
    
    const noteText = inputValue.trim()
    setInputValue('')
    
    const noteId = `note-${Date.now()}`
    
    // Add to local messages
    setMessages(prev => [...prev, {
      type: 'note',
      content: noteText,
      timestamp: Date.now(),
      id: noteId
    }])
    
    // Send to backend
    await window.api.invoke('session:add-note', noteText)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (!isVisible) return null

  return (
    <div className="glass rounded-[8px] w-[400px] max-h-[500px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/10">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-500" />
          <span className="text-xs font-medium">Session Activity</span>
          {lastActivity && (
            <span className={`w-2 h-2 rounded-full ${lastActivity.isRelevant ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowScreenshots(!showScreenshots)}
            title={showScreenshots ? 'Hide screenshots' : 'Show screenshots'}
          >
            {showScreenshots ? <EyeOff size={12} /> : <Eye size={12} />}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Current Activity Banner */}
          {lastActivity && (
            <div className={`px-3 py-2 text-xs border-b border-black/5 ${
              lastActivity.isRelevant ? 'bg-emerald-50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-2">
                <FileCode size={12} className={lastActivity.isRelevant ? 'text-emerald-600' : 'text-gray-500'} />
                <span className="font-medium truncate">
                  {lastActivity.file || lastActivity.app}
                </span>
                {!lastActivity.isRelevant && (
                  <span className="text-gray-400 text-[10px]">(not tracked)</span>
                )}
              </div>
              {lastActivity.title && lastActivity.title !== lastActivity.file && (
                <div className="text-[10px] text-gray-500 truncate mt-0.5">
                  {lastActivity.title}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[300px]">
            {messages.map((msg, i) => (
              <div key={i} className={`text-xs ${
                msg.type === 'system' ? 'text-gray-400 text-center italic' :
                msg.type === 'note' ? 'bg-blue-50 rounded-lg p-2' :
                msg.type === 'summary' ? 'bg-emerald-50 rounded-lg p-3 border border-emerald-200' :
                'bg-white/50 rounded-lg p-2'
              }`}>
                {msg.type === 'activity' && (
                  <div className="flex items-start gap-2">
                    <FileCode size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{msg.content}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      {msg.app && (
                        <div className="text-[10px] text-gray-500">{msg.app}</div>
                      )}
                      {showScreenshots && msg.screenshot && (
                        <img 
                          src={`data:image/jpeg;base64,${msg.screenshot}`}
                          alt="Screenshot"
                          className="mt-2 rounded border border-gray-200 max-w-full"
                        />
                      )}
                    </div>
                  </div>
                )}
                {msg.type === 'note' && (
                  <div className="flex items-start gap-2 group">
                    <Clock size={12} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>{msg.content}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatTime(msg.timestamp)}
                          </span>
                          <button
                            onClick={() => handleDeleteMessage(msg.id, msg.content)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-all"
                            title="Delete note"
                          >
                            <Trash2 size={10} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {msg.type === 'ai_insight' && (
                  <div className="flex items-start gap-2 bg-purple-50 rounded-lg p-2 border border-purple-200">
                    <Bot size={12} className="text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wide">KI Insight</span>
                        <span className="text-[10px] text-purple-400">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <span className="text-purple-900">{msg.content}</span>
                    </div>
                  </div>
                )}
                {msg.type === 'auto_bullet' && msg.bullets && (
                  <div className="flex items-start gap-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-2 border border-amber-200 shadow-sm">
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">📝 Auto-Notiz</span>
                        <span className="text-[10px] text-amber-500">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {msg.bullets.map((bullet, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-amber-900">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span className="font-medium">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {msg.type === 'summary' && msg.summaryData && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-600" />
                      <span className="font-semibold text-emerald-800">Session Complete</span>
                    </div>
                    
                    {/* Duration */}
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Clock size={12} />
                      <span>{msg.summaryData.durationMinutes} minutes</span>
                    </div>
                    
                    {/* Summary Lines */}
                    {msg.summaryData.summaryLines.length > 0 && (
                      <div className="space-y-1">
                        {msg.summaryData.summaryLines.map((line, idx) => (
                          <div key={idx} className="text-emerald-800">• {line}</div>
                        ))}
                      </div>
                    )}
                    
                    {/* Activity Summary */}
                    {msg.summaryData.activitySummary && msg.summaryData.activitySummary.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-emerald-200">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">Activity Breakdown</div>
                        {msg.summaryData.activitySummary.slice(0, 5).map((activity, idx) => (
                          <div key={idx} className="flex items-center justify-between text-emerald-700">
                            <span className="truncate">{activity.app}</span>
                            <span className="text-[10px]">{Math.round(activity.totalDuration / 60)}m</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add to Workspace Button */}
                    {onAddToWorkspace && !hasAnalyzed && (
                      <button
                        onClick={() => handleAnalyzeSession(msg.summaryData!)}
                        disabled={isAnalyzing}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors font-medium"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Analysiere Workspace...
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            Add to Workspace
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
{msg.type === 'analysis' && msg.analysisData && (
                  <div className="space-y-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
                    <div className="flex items-center gap-2">
                      <ListChecks size={14} className="text-indigo-600" />
                      <span className="font-semibold text-indigo-800">Workspace Update</span>
                    </div>
                    
                    {/* AI Summary */}
                    {msg.analysisData.aiSummary && (
                      <div className="text-indigo-700 italic text-[11px] border-l-2 border-indigo-300 pl-2">
                        {msg.analysisData.aiSummary}
                      </div>
                    )}
                    
                    {/* Issues - HIGHLIGHTED */}
                    {msg.analysisData.issues.length > 0 && (
                      <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-red-700 font-medium">
                          <AlertTriangle size={12} />
                          <span className="text-[10px] uppercase tracking-wide">Achtung!</span>
                        </div>
                        {msg.analysisData.issues.map((issue, idx) => (
                          <div key={idx} className="text-red-800 text-[11px] flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5">⚠</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Updated Tasks */}
                    {msg.analysisData.updatedTasks.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle size={10} />
                          Tasks aktualisiert
                        </div>
                        {msg.analysisData.updatedTasks.map((task, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              task.status === 'done' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                            }`}>
                              {task.status === 'done' ? '✓ DONE' : '→ IN PROGRESS'}
                            </span>
                            <span className="text-gray-800 truncate">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* New Tasks */}
                    {msg.analysisData.newTasks.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-blue-600 font-medium flex items-center gap-1">
                          <Plus size={10} />
                          Neue Tasks erkannt
                        </div>
                        {msg.analysisData.newTasks.map((task, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              task.priority === 'high' ? 'bg-red-200 text-red-800' : 
                              task.priority === 'medium' ? 'bg-amber-200 text-amber-800' : 
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {task.priority?.toUpperCase() || 'MEDIUM'}
                            </span>
                            <span className="text-gray-800 truncate">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Open in Web Button */}
                    {onAddToWorkspace && (
                      <button
                        onClick={() => onAddToWorkspace(sessionSummary!)}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-[11px] font-medium"
                      >
                        <ExternalLink size={12} />
                        Im Browser öffnen
                      </button>
                    )}
                  </div>
                )}
                {msg.type === 'system' && msg.content}
              </div>
            ))}
            {isLoadingInsight && (
              <div className="flex items-center gap-2 text-xs text-purple-500 bg-purple-50 rounded-lg p-2">
                <Loader2 size={12} className="animate-spin" />
                <span>KI analysiert...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-black/10">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a note about what you're doing..."
                className="flex-1 bg-white/50 rounded-lg px-3 py-1.5 text-xs border border-black/10 focus:outline-none focus:border-emerald-500"
              />
              <Button
                variant="ghost"
                size="xs"
                onClick={handleSend}
                disabled={!inputValue.trim()}
              >
                <Send size={12} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
