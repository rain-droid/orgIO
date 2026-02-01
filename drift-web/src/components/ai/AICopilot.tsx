import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { 
  Sparkles, 
  Send, 
  X, 
  Loader2, 
  Trash2,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AICopilotProps {
  projectName?: string
  projectDescription?: string
  userRole?: 'pm' | 'dev' | 'designer'
  className?: string
}

export function AICopilot({ 
  projectName = '', 
  projectDescription = '', 
  userRole = 'dev',
  className 
}: AICopilotProps) {
  const { getToken } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const currentResponseRef = useRef<string>('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const apiUrl = import.meta.env.VITE_API_URL || ''
    const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')
    
    wsRef.current = new WebSocket(`${wsUrl}/api/ws/chat`)
    
    wsRef.current.onopen = async () => {
      console.log('AI Copilot connected')
      // Authenticate
      const token = await getToken()
      if (token && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'context',
          token: `Bearer ${token}`,
          context: {
            role: userRole,
            project_name: projectName,
            project_description: projectDescription
          }
        }))
      }
    }

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'start') {
        currentResponseRef.current = ''
        setIsStreaming(true)
        // Add empty assistant message
        const newMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, newMsg])
      } 
      else if (data.type === 'chunk') {
        currentResponseRef.current += data.content
        // Update last message
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: currentResponseRef.current
            }
          }
          return updated
        })
      }
      else if (data.type === 'end') {
        setIsStreaming(false)
      }
      else if (data.type === 'error') {
        setIsStreaming(false)
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${data.content}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMsg])
      }
    }

    wsRef.current.onclose = () => {
      console.log('AI Copilot disconnected')
    }

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [getToken, userRole, projectName, projectDescription])

  useEffect(() => {
    if (isOpen) {
      connectWebSocket()
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [isOpen, connectWebSocket])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const token = await getToken()
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: input.trim(),
        token: `Bearer ${token}`,
        context: {
          role: userRole,
          project_name: projectName,
          project_description: projectDescription
        }
      }))
    }
  }

  const clearChat = async () => {
    setMessages([])
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const token = await getToken()
      wsRef.current.send(JSON.stringify({
        type: 'clear',
        token: `Bearer ${token}`
      }))
    }
  }

  const copyToClipboard = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 size-14 rounded-full",
          "bg-gradient-to-br from-violet-500 to-purple-600",
          "text-white shadow-lg shadow-purple-500/25",
          "flex items-center justify-center",
          "hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30",
          "transition-all duration-200",
          "animate-pulse-slow",
          className
        )}
      >
        <Sparkles className="size-6" />
      </button>
    )
  }

  return (
    <div 
      className={cn(
        "fixed z-50 bg-background border border-border rounded-xl shadow-2xl",
        "flex flex-col overflow-hidden transition-all duration-300",
        isExpanded 
          ? "inset-4" 
          : "bottom-6 right-6 w-[420px] h-[600px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Drift AI</h3>
            <p className="text-xs text-muted-foreground">
              {projectName || 'General Assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={clearChat}
            title="Clear chat"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Bot className="size-8 text-violet-500" />
            </div>
            <h3 className="font-semibold mb-2">Hi! I'm Drift AI</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              I can help you plan projects, write specs, generate code, and design user flows.
            </p>
            <div className="grid gap-2 w-full max-w-xs">
              {[
                "Generate tasks for this project",
                "Write API specifications",
                "Create user stories",
                "Suggest architecture"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="text-left text-sm px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                <Bot className="size-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-4 py-2 relative group",
                msg.role === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                {msg.content || (isStreaming && msg.role === 'assistant' ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    Thinking...
                  </span>
                ) : null)}
              </div>
              {msg.role === 'assistant' && msg.content && (
                <button
                  onClick={() => copyToClipboard(msg.content, msg.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedId === msg.id ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <User className="size-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className={cn(
              "flex-1 resize-none bg-muted rounded-lg px-4 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "max-h-32 min-h-[40px]"
            )}
            style={{ height: 'auto' }}
            disabled={isStreaming}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="shrink-0 size-10"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Drift AI • {userRole.toUpperCase()} Mode
        </p>
      </div>
    </div>
  )
}
