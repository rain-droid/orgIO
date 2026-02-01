import { useState, useEffect, useRef } from 'react'
import { Send, FileCode, Clock, Eye, EyeOff, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
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
  type: 'activity' | 'note' | 'system'
  content: string
  timestamp: number
  app?: string
  file?: string
  screenshot?: string
  isRelevant?: boolean
}

export function SessionChat({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showScreenshots, setShowScreenshots] = useState(false)
  const [lastActivity, setLastActivity] = useState<ActivityEntry | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for live activity updates
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
            isRelevant: true
          }]
        })
      }
    }

    window.api.receive('session:activity', handleActivity)
    
    // Add initial system message
    setMessages([{
      type: 'system',
      content: 'Session started. Activity tracking active. Add notes by typing below.',
      timestamp: Date.now()
    }])

    return () => {
      window.api.removeAllListeners('session:activity')
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle sending notes
  const handleSend = async () => {
    if (!inputValue.trim()) return
    
    const noteText = inputValue.trim()
    setInputValue('')
    
    // Add to local messages
    setMessages(prev => [...prev, {
      type: 'note',
      content: noteText,
      timestamp: Date.now()
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
                  <div className="flex items-start gap-2">
                    <Clock size={12} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>{msg.content}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {msg.type === 'system' && msg.content}
              </div>
            ))}
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
