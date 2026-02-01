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
        className={`fixed bottom-6 right-6 z-50 size-14 rounded border-2 border-foreground bg-background text-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-all ${className || ''}`}
      >
        <Sparkles className="size-6" />
      </button>
    )
  }

  return (
    <div className={`fixed z-50 bg-background border flex flex-col overflow-hidden transition-all duration-300 ${
      isExpanded ? 'inset-4' : 'bottom-6 right-6 w-[420px] h-[600px]'
    } ${className || ''}`}>
      {/* L-bracket corners */}
      <div aria-hidden className="absolute top-0 left-0 w-2.5 h-2.5 border-l-2 border-t-2 border-foreground/50 z-10" />
      <div aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 border-r-2 border-t-2 border-foreground/50 z-10" />
      <div aria-hidden className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l-2 border-b-2 border-foreground/50 z-10" />
      <div aria-hidden className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r-2 border-b-2 border-foreground/50 z-10" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-foreground text-background flex items-center justify-center">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Drift AI</h3>
            <p className="text-xs text-muted-foreground">
              {projectName || 'General Assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="p-2 hover:bg-muted rounded transition-colors" title="Clear chat">
            <Trash2 className="size-4" />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-muted rounded transition-colors" title={isExpanded ? "Minimize" : "Expand"}>
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-muted rounded transition-colors" title="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="size-16 rounded bg-muted flex items-center justify-center mb-4">
              <Bot className="size-8 text-muted-foreground" />
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
                  className="text-left text-sm px-4 py-2 rounded border bg-background hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="size-8 rounded bg-foreground text-background flex items-center justify-center shrink-0">
                <Bot className="size-4" />
              </div>
            )}
            <div className={`max-w-[80%] rounded px-4 py-2 relative group ${
              msg.role === 'user' ? 'bg-foreground text-background' : 'bg-muted'
            }`}>
              <div className="text-sm whitespace-pre-wrap">
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
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none bg-transparent border rounded px-4 py-2 text-sm input-focus max-h-32 min-h-[40px]"
            style={{ height: 'auto' }}
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="btn-primary size-10 rounded flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center uppercase tracking-wide">
          {userRole} Mode
        </p>
      </div>
    </div>
  )
}
