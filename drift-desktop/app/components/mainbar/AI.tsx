import { useState, useEffect, useRef } from 'react'
import { useSelector } from '@xstate/react'
import { useUIActor } from '../../state/UIStateProvider'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Command, CornerDownLeft, CheckCircle2, Clock, FileCode, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import MarkdownRenderer from '../MarkdownRenderer'

// Session summary data from session:ended event
interface SessionSummaryData {
  sessionId: string
  submissionId?: string
  durationMinutes: number
  summaryLines: string[]
  activitySummary?: Array<{ app: string; totalDuration: number; files: string[] }>
  notes?: Array<{ text: string; timestamp: number }>
  briefId?: string
  briefName?: string
}

interface AIProps {
  isChatPaneVisible: boolean
  onContentChange?: (isWide: boolean) => void
}

export const AI: React.FC<AIProps> = ({ isChatPaneVisible, onContentChange }) => {
  const actor = useUIActor()
  const { send } = actor

  const { state, isChatIdle, isChatLoading, isChatError } = useSelector(actor, (s) => ({
    state: s,
    isChatIdle: s.matches({ chat: 'idle' }),
    isChatLoading: s.matches({ chat: 'loading' }),
    isChatError: s.matches({ chat: 'error' })
  }))

  const [answer, setAnswer] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string>('')
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null)
  const [isAddingToWorkspace, setIsAddingToWorkspace] = useState(false)
  const [addedToWorkspace, setAddedToWorkspace] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    updatedTasks: Array<{ title: string; status: string; wasUpdated: boolean }>
    newTasks: Array<{ title: string; priority: string }>
    issues: string[]
    aiSummary: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.matches('activeIdle')) {
      setAnswer(null)
      setErrorMessage(null)
      setInputValue('')
    } else if (isChatLoading) {
      setAnswer('')
      setErrorMessage(null)
    }
  }, [state, isChatLoading])

  // Listen for session:ended events to show summary in chat
  useEffect(() => {
    const handleSessionEnded = (data: SessionSummaryData) => {
      console.log('[AI] Session ended, showing summary:', data)
      setSessionSummary(data)
      setAddedToWorkspace(false)
      setAnalysisResult(null)
      onContentChange?.(true) // Make chat wider to show summary nicely
    }

    window.api.receive('session:ended', handleSessionEnded)
    
    return () => {
      window.api.removeAllListeners('session:ended')
    }
  }, [onContentChange])

  // Handle "Add to Workspace" - sends summary to backend for analysis
  const handleAddToWorkspace = async () => {
    if (!sessionSummary || isAddingToWorkspace) return
    
    setIsAddingToWorkspace(true)
    
    try {
      const result = await window.api.invoke('session:analyze', {
        sessionId: sessionSummary.sessionId,
        submissionId: sessionSummary.submissionId,
        briefId: sessionSummary.briefId,
        activities: sessionSummary.activitySummary,
        notes: sessionSummary.notes,
        summaryLines: sessionSummary.summaryLines,
        durationMinutes: sessionSummary.durationMinutes
      })
      
      if (result && !result.error) {
        setAddedToWorkspace(true)
        setAnalysisResult(result)
      } else {
        setErrorMessage(result?.error || 'Failed to analyze session')
      }
    } catch (error) {
      console.error('Failed to add to workspace:', error)
      setErrorMessage('Failed to analyze session')
    } finally {
      setIsAddingToWorkspace(false)
    }
  }

  // Clear session summary
  const handleDismissSummary = () => {
    setSessionSummary(null)
    setAddedToWorkspace(false)
    setAnalysisResult(null)
  }

  useEffect(() => {
    const handleStreamChunk = (chunk: { text?: string; reset?: boolean }) => {
      if (chunk.reset) {
        setAnswer('')
        return
      }

      if (!chunk.text) return

      setAnswer((prev) => {
        const base = prev || ''
        const newAnswer = base + chunk.text
        const containsCode = /```/.test(newAnswer)
        const wordCount = newAnswer.split(/\s+/).filter(Boolean).length
        const shouldBeWide = containsCode || wordCount > 100
        onContentChange?.(shouldBeWide)
        return newAnswer
      })
    }

    const handleApiError = (error: string) => setErrorMessage(error)
    const handleApiSuccess = () => {
      // API request succeeded
    }
    const handleSetInitialInput = (value: string) => setInputValue(value)

    // Expose focus and send helpers for global shortcuts
    ;(window as any).chatInputAPI = {
      focus: () => {
        inputRef.current?.focus()
      },
      submit: () => {
        const val = inputRef.current?.value.trim() || ''
        if (!isChatLoading && val) {
          send({ type: 'SUBMIT', value: val })
          setInputValue('')
        }
      }
    }

    window.api.receive('chat:chunk', handleStreamChunk as any)
    window.api.receive('api-error', handleApiError)
    window.api.receive('api-success', handleApiSuccess)
    window.api.receive('set-initial-input', handleSetInitialInput)

    return () => {
      window.api.removeAllListeners('chat:chunk')
      delete (window as any).chatInputAPI
      window.api.removeAllListeners('api-error')
      window.api.removeAllListeners('api-success')
      window.api.removeAllListeners('set-initial-input')
    }
  }, [send, isChatLoading, onContentChange])

  useEffect(() => {
    if (isChatPaneVisible && (isChatIdle || isChatError)) {
      inputRef.current?.focus()
    }
  }, [isChatPaneVisible, isChatIdle, isChatError])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const renderChatContent = () => {
    // Show session summary if available (priority over other content)
    if (sessionSummary) {
      return (
        <div className="flex-1 p-4 glass rounded-lg overflow-y-auto space-y-4">
          {/* Session Summary Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-500" />
              <span className="font-medium text-sm">Session Complete</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="size-3" />
              <span>{formatDuration(sessionSummary.durationMinutes)}</span>
            </div>
          </div>

          {/* Activity Summary */}
          {sessionSummary.activitySummary && sessionSummary.activitySummary.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Activity</div>
              {sessionSummary.activitySummary.slice(0, 4).map((activity, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-white/30 rounded-lg px-3 py-2">
                  <FileCode className="size-3 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">{activity.app}</span>
                  <span className="text-gray-500">
                    {Math.floor(activity.totalDuration / 60)}m
                  </span>
                  {activity.files.length > 0 && (
                    <span className="text-gray-400 truncate">
                      • {activity.files.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {sessionSummary.notes && sessionSummary.notes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Notes</div>
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs space-y-1">
                {sessionSummary.notes.map((note, i) => (
                  <div key={i} className="text-gray-700">• {note.text}</div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Result */}
          {analysisResult && (
            <div className="space-y-3 border-t border-black/10 pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-700">Added to Workspace</span>
              </div>
              
              {/* AI Summary */}
              <div className="text-xs text-gray-700 bg-emerald-50 rounded-lg px-3 py-2">
                {analysisResult.aiSummary}
              </div>

              {/* Updated Tasks */}
              {analysisResult.updatedTasks.filter(t => t.wasUpdated).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase">Tasks Updated</div>
                  {analysisResult.updatedTasks.filter(t => t.wasUpdated).map((task, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      <span>{task.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        task.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* New Tasks */}
              {analysisResult.newTasks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase">New Tasks Identified</div>
                  {analysisResult.newTasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-orange-700">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      <span>{task.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Issues */}
              {analysisResult.issues.length > 0 && (
                <div className="space-y-1 bg-red-50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-red-600 uppercase font-medium">⚠️ Attention Required</div>
                  {analysisResult.issues.map((issue, i) => (
                    <div key={i} className="text-xs text-red-700">• {issue}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {!addedToWorkspace ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleAddToWorkspace}
                disabled={isAddingToWorkspace}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isAddingToWorkspace ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-3 mr-2" />
                    Add to Workspace
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissSummary}
                className="flex-1"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      )
    }

    if (isChatError) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-red-500 glass rounded-lg">
          {errorMessage || 'An error occurred.'}
        </div>
      )
    }

    if (errorMessage) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-red-500 glass rounded-lg">
          {errorMessage}
        </div>
      )
    }

    if (isChatLoading && !answer) {
      return (
        <div className="flex-1 p-4 glass rounded-lg animate-pulse">Loading from Orgio AI...</div>
      )
    }

    if (answer) {
      return (
        <div className="flex-1 p-4 glass rounded-lg overflow-y-auto ">
          <MarkdownRenderer content={answer} />
        </div>
      )
    }

    return (
      <div className="flex-1 flex items-center justify-center p-4 glass rounded-lg text-gray-500">
        Ask Orgio anything...
      </div>
    )
  }

  return (
    <div className="flex max-h-full w-full bg-transparent p-2 gap-3">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col h-full gap-2 min-w-0 text-sm">
        {/* Chat Content */}
        {renderChatContent()}

        {/* Input Area */}
        <div className="relative max-h-10 flex-shrink-0">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
              isChatLoading
                ? 'Generating answer...'
                : answer
                  ? 'Ask a follow-up...'
                  : 'Ask me anything...'
            }
            className="glass rounded-full w-full mr-14"
            disabled={isChatLoading}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="flex gap-2 items-center">
              <Command className="size-4" />
              <CornerDownLeft className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
