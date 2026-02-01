import { Command, CornerDownLeft, Space, GripVertical, LogOut, ChevronDown, FileText, Mic, Settings, Power, RefreshCw, Activity } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button'
import { useUIActor } from '../../state/UIStateProvider'
import { useSelector } from '@xstate/react'
import { SessionChat } from './SessionChat'

type ShortcutAction = 'toggleOverlay' | 'submitChat' | 'toggleSession' | 'toggleVoice' | 'escape'
type ShortcutConfig = Record<ShortcutAction, string>
type ShortcutUpdateResult = { ok: boolean; failed: ShortcutAction[]; shortcuts: ShortcutConfig }

// Project type from API
interface Project {
  id: string
  name: string
  description?: string
  status?: string
}

// Session summary from API
interface SessionSummary {
  sessionId: string
  submissionId?: string
  briefId?: string
  briefName?: string
  durationMinutes: number
  summaryLines: string[]
  activitySummary?: Array<{ app: string; totalDuration: number; files: string[] }>
  notes?: Array<{ text: string; timestamp: number }>
}

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

// Voice Equalizer Component with real mic input and speech recognition
function VoiceEqualizer({ isActive, onTranscript }: { isActive: boolean; onTranscript?: (text: string) => void }) {
  const [levels, setLevels] = useState([2, 2, 2])
  const [isListening, setIsListening] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const analyze = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Voice frequency bands (roughly 85-255Hz, 255-500Hz, 500-2000Hz)
    const low = dataArray.slice(2, 6).reduce((a, b) => a + b, 0) / 4
    const mid = dataArray.slice(6, 12).reduce((a, b) => a + b, 0) / 6
    const high = dataArray.slice(12, 24).reduce((a, b) => a + b, 0) / 12

    // Scale to 2-10px range
    const scale = (val: number) => Math.max(2, Math.min(10, (val / 255) * 12 + 2))
    
    setLevels([scale(low), scale(mid), scale(high)])
    animationRef.current = requestAnimationFrame(analyze)
  }, [])

  useEffect(() => {
    if (isActive) {
      // Start audio visualization
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          streamRef.current = stream
          audioContextRef.current = new AudioContext()
          analyserRef.current = audioContextRef.current.createAnalyser()
          analyserRef.current.fftSize = 64
          analyserRef.current.smoothingTimeConstant = 0.4

          const source = audioContextRef.current.createMediaStreamSource(stream)
          source.connect(analyserRef.current)
          
          analyze()
        })
        .catch((err) => console.error('Mic access denied:', err))

      // Start speech recognition
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'de-DE' // German by default, can be made configurable
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const last = event.results.length - 1
          const transcript = event.results[last][0].transcript.trim()
          if (transcript && onTranscript) {
            console.log('[Voice] Transcribed:', transcript)
            onTranscript(transcript)
          }
        }
        
        recognition.onerror = (event) => {
          console.error('[Voice] Recognition error:', event)
        }
        
        recognition.onend = () => {
          // Restart if still active
          if (isActive && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              // Already started
            }
          }
        }
        
        recognition.onstart = () => {
          setIsListening(true)
        }
        
        recognitionRef.current = recognition
        
        try {
          recognition.start()
        } catch (e) {
          console.error('[Voice] Failed to start recognition:', e)
        }
      } else {
        console.warn('[Voice] Speech recognition not supported')
      }
    } else {
      // Cleanup audio
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close()
      setLevels([2, 2, 2])
      
      // Cleanup speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Already stopped
        }
        recognitionRef.current = null
      }
      setIsListening(false)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Already stopped
        }
      }
    }
  }, [isActive, analyze, onTranscript])

  return (
    <div className="flex items-center gap-[2px] h-[10px]" title={isListening ? 'Listening...' : 'Starting...'}>
      {levels.map((h, i) => (
        <span
          key={i}
          className="w-[2px] bg-white/90 rounded-full transition-all duration-75"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

export const Mainbar = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [userRole, setUserRole] = useState<string>('dev')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [settingsPosition, setSettingsPosition] = useState({ top: 0, left: 0 })
  const [showExitMenu, setShowExitMenu] = useState(false)
  const [exitMenuPosition, setExitMenuPosition] = useState({ top: 0, left: 0 })
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null)
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [currentActivity, setCurrentActivity] = useState<string | null>(null)
  const [showSessionChat, setShowSessionChat] = useState(false)
  const [sessionChatPosition, setSessionChatPosition] = useState({ top: 0, left: 0 })
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false) // Track if session just ended
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activitiesRef = useRef<Array<{ app: string; title: string; duration: number; timestamp: number }>>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const sessionChatButtonRef = useRef<HTMLButtonElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const exitMenuRef = useRef<HTMLDivElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)

  const uiActor = useUIActor()
  const { send } = uiActor

  const { chatActive } = useSelector(uiActor, (s) => ({
    chatActive: s.matches('chat')
  }))

  const shortcutItems: { id: ShortcutAction; label: string }[] = [
    { id: 'toggleOverlay', label: 'Show/Hide overlay' },
    { id: 'submitChat', label: 'Open chat' },
    { id: 'toggleSession', label: 'Start/Stop session' },
    { id: 'toggleVoice', label: 'Toggle voice' },
    { id: 'escape', label: 'Close/Back' }
  ]

  // Update dropdown position when opened
  useEffect(() => {
    if (showProjectDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }
  }, [showProjectDropdown])

  // Update settings menu position when opened
  useEffect(() => {
    if (showSettingsMenu && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect()
      setSettingsPosition({
        top: rect.bottom + 8,
        left: rect.right - 220
      })
    }
  }, [showSettingsMenu])

  // Update exit menu position when opened
  useEffect(() => {
    if (showExitMenu && exitButtonRef.current) {
      const rect = exitButtonRef.current.getBoundingClientRect()
      setExitMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 120
      })
    }
  }, [showExitMenu])
  
  // Update session chat position
  useEffect(() => {
    if (showSessionChat && sessionChatButtonRef.current) {
      const rect = sessionChatButtonRef.current.getBoundingClientRect()
      setSessionChatPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.left - 150) // Center it roughly
      })
    }
  }, [showSessionChat])

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowProjectDropdown(false)
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(target) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(target)
      ) {
        setShowSettingsMenu(false)
      }
      if (
        exitMenuRef.current &&
        !exitMenuRef.current.contains(target) &&
        exitButtonRef.current &&
        !exitButtonRef.current.contains(target)
      ) {
        setShowExitMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [syncError, setSyncError] = useState<string | null>(null)

  // Fetch projects from API on mount
  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    setSyncError(null)
    try {
      const result = await window.api.invoke('drift:sync')
      if (result && !result.error) {
        setProjects(result.briefs || [])
        setUserRole(result.role || 'dev')
        // Auto-select first project if none selected
        if (!selectedProject && result.briefs?.length > 0) {
          setSelectedProject(result.briefs[0].id)
        }
      } else if (result?.error) {
        console.error('Sync error:', result.error)
        if (result.error.includes('Not authenticated')) {
          setSyncError('auth')
        } else {
          setSyncError('error')
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      setSyncError('error')
    } finally {
      setIsLoadingProjects(false)
    }
  }, [selectedProject])

  useEffect(() => {
    fetchProjects()
    // Listen for sync events
    window.api.receive('drift:synced', (data: { briefs: Project[]; role: string }) => {
      setProjects(data.briefs || [])
      setUserRole(data.role || 'dev')
    })
    return () => {
      window.api.removeAllListeners('drift:synced')
    }
  }, [fetchProjects])

  useEffect(() => {
    window.api
      .invoke('shortcuts:get')
      .then((data: ShortcutConfig) => setShortcuts(data))
      .catch(() => setShortcuts(null))
  }, [])

  useEffect(() => {
    if (!editingShortcut) return

    const toKeyPart = (key: string) => {
      const aliasMap: Record<string, string> = {
        ' ': 'Space',
        Escape: 'Escape',
        Enter: 'Enter',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Tab: 'Tab',
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right'
      }

      if (aliasMap[key]) return aliasMap[key]
      if (key.length === 1) return key.toUpperCase()
      return key
    }

    const buildAccelerator = (event: KeyboardEvent) => {
      const isModifierOnly = ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)
      if (isModifierOnly) return null

      const keyPart = toKeyPart(event.key)
      const hasModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey

      if (!hasModifier && keyPart !== 'Escape') {
        return null
      }

      const parts: string[] = []
      if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')
      parts.push(keyPart)

      return parts.join('+')
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape' && editingShortcut !== 'escape') {
        setEditingShortcut(null)
        setShortcutError(null)
        return
      }

      const accelerator = buildAccelerator(event)
      if (!accelerator) {
        setShortcutError('Use a modifier like Ctrl/Alt/Shift (except Escape).')
        return
      }

      window.api
        .invoke('shortcuts:set', { [editingShortcut]: accelerator })
        .then((result: ShortcutUpdateResult) => {
          if (!result.ok) {
            setShortcutError('Shortcut invalid or already in use.')
            return
          }
          setShortcuts(result.shortcuts)
          setShortcutError(null)
          setEditingShortcut(null)
        })
        .catch(() => {
          setShortcutError('Failed to update shortcut.')
        })
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [editingShortcut])

  // Recording timer & activity updates
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000)
      
      // Listen for live activity updates from main process
      const handleActivity = (activity: { app: string; file?: string; title?: string; isRelevant: boolean }) => {
        if (activity.isRelevant) {
          if (activity.file) {
            setCurrentActivity(`${activity.app}: ${activity.file}`)
          } else if (activity.title) {
            const title = activity.title.length > 40 ? activity.title.slice(0, 37) + '...' : activity.title
            setCurrentActivity(`${activity.app}: ${title}`)
          } else {
            setCurrentActivity(activity.app)
          }
        } else {
          setCurrentActivity(`${activity.app} (not tracked)`)
        }
      }
      
      window.api.receive('session:activity', handleActivity)
      
      return () => {
        window.api.removeAllListeners('session:activity')
      }
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      setRecordingTime(0)
      setCurrentActivity(null)
      // Don't close the chat - keep it open to show summary
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  // Listen for toggle-session shortcut
  useEffect(() => {
    const handleToggleSession = async () => {
      if (!selectedProject) {
        // Shortcut should start immediately; default to first project
        if (projects.length > 0) {
          setSelectedProject(projects[0].id)
        }
        setShowProjectDropdown(false)
      }
      
      if (!isRecording) {
        // Start session via API
        const projectId = selectedProject || projects[0]?.id
        if (projectId) {
          const result = await window.api.invoke('session:start', projectId, userRole)
          if (result && !result.error) {
            activitiesRef.current = []
            setSessionSummary(null)
            setSessionEnded(false)
            setIsRecording(true)
            setShowSessionChat(true)
          }
        }
      } else {
        // End session via API
        const result = await window.api.invoke('session:end')
        if (result && !result.error) {
          setIsRecording(false)
          setSessionEnded(true)
          setSessionSummary({
            sessionId: result.sessionId,
            submissionId: result.submissionId,
            briefId: result.briefId,
            briefName: result.briefName,
            durationMinutes: result.durationMinutes,
            summaryLines: result.summaryLines || [],
            activitySummary: result.activitySummary,
            notes: result.notes
          })
          setShowSessionChat(true)
        }
      }
    }
    window.addEventListener('toggle-session', handleToggleSession)
    return () => window.removeEventListener('toggle-session', handleToggleSession)
  }, [selectedProject, isRecording, projects, userRole])

  // Listen for toggle-voice shortcut
  useEffect(() => {
    const handleToggleVoice = () => {
      setIsVoiceActive((prev) => !prev)
    }
    window.addEventListener('toggle-voice', handleToggleVoice)
    return () => window.removeEventListener('toggle-voice', handleToggleVoice)
  }, [])

  const handleChatClick = () => {
    if (chatActive) {
      send({ type: 'ESC' })
    } else {
      send({ type: 'OPEN_CHAT' })
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${secs}`
  }

  const handleSessionClick = async () => {
    if (!isRecording) {
      // Start session
      let projectId = selectedProject
      if (!projectId && projects.length > 0) {
        projectId = projects[0].id
        setSelectedProject(projectId)
      }
      setShowProjectDropdown(false)
      
      if (projectId) {
        const result = await window.api.invoke('session:start', projectId, userRole)
        if (result && !result.error) {
          activitiesRef.current = []
          setSessionSummary(null)
          setSessionEnded(false)
          setIsRecording(true)
          setShowSessionChat(true) // Open chat when session starts
        } else {
          console.error('Failed to start session:', result?.error)
        }
      }
    } else {
      // End session
      const result = await window.api.invoke('session:end')
      if (result && !result.error) {
        setIsRecording(false)
        setSessionEnded(true)
        // Set summary - keep chat open to show it
        setSessionSummary({
          sessionId: result.sessionId,
          submissionId: result.submissionId,
          briefId: result.briefId,
          briefName: result.briefName,
          durationMinutes: result.durationMinutes,
          summaryLines: result.summaryLines || [],
          activitySummary: result.activitySummary,
          notes: result.notes
        })
        setShowSessionChat(true) // Make sure chat is open to show summary
      } else {
        console.error('Failed to end session:', result?.error)
      }
    }
  }

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId)
    setShowProjectDropdown(false)
  }

  const getSelectedProjectName = () => {
    const project = projects.find(p => p.id === selectedProject)
    return project?.name || (isLoadingProjects ? 'Loading...' : 'Select Project')
  }

  const handleLogout = async () => {
    console.log('[Logout] Clearing auth token...')
    await window.api.invoke('store-auth-token', null)
    console.log('[Logout] Token cleared, reloading...')
    window.location.reload()
  }

  const handleExit = () => {
    window.api.send('quit-app')
  }

  const handleVoiceClick = () => {
    setIsVoiceActive(!isVoiceActive)
  }

  // Handle voice transcript - add as session note or process commands
  const handleVoiceTranscript = useCallback(async (text: string) => {
    const lowerText = text.toLowerCase().trim()
    
    // Voice commands
    if (lowerText.startsWith('lösche') || lowerText.startsWith('delete') || lowerText.startsWith('entferne')) {
      // Delete command - remove last note or specific note
      if (lowerText.includes('letzte') || lowerText.includes('last')) {
        await window.api.invoke('session:remove-last-note')
        console.log('[Voice] Removed last note')
      } else {
        // Try to find and remove specific text
        const searchText = text.replace(/^(lösche|delete|entferne)\s*/i, '').trim()
        if (searchText) {
          await window.api.invoke('session:remove-note', searchText)
          console.log('[Voice] Removed note containing:', searchText)
        }
      }
      return
    }
    
    if (lowerText.startsWith('stopp') || lowerText.startsWith('stop')) {
      // Stop session command
      if (isRecording) {
        const result = await window.api.invoke('session:end', activitiesRef.current)
        if (result && !result.error) {
          setIsRecording(false)
        }
      }
      return
    }
    
    if (lowerText.startsWith('start')) {
      // Start session command
      if (!isRecording && selectedProject) {
        const result = await window.api.invoke('session:start', selectedProject, userRole)
        if (result && !result.error) {
          activitiesRef.current = []
          setIsRecording(true)
        }
      }
      return
    }
    
    // Default: add as note during session
    if (isRecording) {
      // Clean up common prefixes
      let noteText = text
        .replace(/^(notiz|note|add|hinzufügen)\s*:?\s*/i, '')
        .trim()
      
      if (noteText) {
        await window.api.invoke('session:add-note', `🎤 ${noteText}`)
        console.log('[Voice] Added note to session:', noteText)
      }
    } else {
      // Not in session, could open chat and send
      console.log('[Voice] Transcript (no session):', text)
    }
  }, [isRecording, selectedProject, userRole])

  const handleAddToWorkspace = async (summary: SessionSummary) => {
    // Open the web app to the submission review page
    const webUrl = 'https://test.usehavoc.com'
    const submissionUrl = summary.submissionId 
      ? `${webUrl}?view=reviews&submission=${summary.submissionId}`
      : `${webUrl}?view=reviews`
    
    // Open in browser
    window.open(submissionUrl, '_blank')
    
    // Close the chat and reset
    setShowSessionChat(false)
    setSessionSummary(null)
    setSessionEnded(false)
  }

  const handleCloseSessionChat = () => {
    setShowSessionChat(false)
    // If session has ended, also clear the summary
    if (sessionEnded) {
      setSessionSummary(null)
      setSessionEnded(false)
    }
  }

  const dropdownPortal = showProjectDropdown && createPortal(
    <div 
      ref={dropdownRef}
      className="glass rounded-[8px] min-w-[200px] overflow-hidden py-1"
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999
      }}
    >
      {/* Refresh button */}
      <button
        onClick={() => fetchProjects()}
        className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 transition-colors text-gray-500"
        disabled={isLoadingProjects}
      >
        <RefreshCw size={12} className={isLoadingProjects ? 'animate-spin' : ''} />
        <span>{isLoadingProjects ? 'Loading...' : 'Refresh projects'}</span>
      </button>
      <div className="h-px bg-black/10 my-1" />
      {syncError === 'auth' ? (
        <div className="px-2.5 py-2 text-xs text-gray-500 text-center">
          <span className="text-amber-600">Not logged in.</span><br />
          Restart the app to connect.
        </div>
      ) : projects.length === 0 ? (
        <div className="px-2.5 py-2 text-xs text-gray-500 text-center">
          No projects found.<br />
          <button 
            onClick={() => {
              window.open('https://test.usehavoc.com', '_blank')
            }}
            className="text-blue-500 hover:underline"
          >
            Create one in the web app →
          </button>
        </div>
      ) : (
        projects.map((project) => (
          <button
            key={project.id}
            onClick={() => handleProjectSelect(project.id)}
            className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 transition-colors ${
              selectedProject === project.id ? 'bg-black/5 font-medium' : ''
            }`}
          >
            <FileText size={12} className="text-gray-500 flex-shrink-0" />
            <span className="truncate">{project.name}</span>
          </button>
        ))
      )}
    </div>,
    document.body
  )

  const settingsPortal = showSettingsMenu && createPortal(
    <div
      ref={settingsRef}
      className="glass rounded-[8px] min-w-[220px] overflow-hidden py-1"
      style={{
        position: 'fixed',
        top: settingsPosition.top,
        left: settingsPosition.left,
        zIndex: 9999
      }}
    >
      <div className="px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-500">Shortcuts</div>
      {shortcutItems.map((item) => {
        const value = shortcuts?.[item.id] ?? 'Unassigned'
        const isEditing = editingShortcut === item.id
        return (
          <div key={item.id} className="px-2.5 py-1.5 text-xs flex items-center justify-between gap-2">
            <span className="text-gray-800">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray-500">{value}</span>
              <button
                onClick={() => {
                  setShortcutError(null)
                  setEditingShortcut(isEditing ? null : item.id)
                }}
                className="rounded-[6px] px-2 py-0.5 text-[11px] text-gray-700 hover:bg-black/5 transition-colors"
              >
                {isEditing ? 'Cancel' : 'Reassign'}
              </button>
            </div>
          </div>
        )
      })}
      {editingShortcut && (
        <div className="px-2.5 py-1.5 text-[11px] text-gray-500">
          Press keys now. Esc to cancel.
        </div>
      )}
      {shortcutError && (
        <div className="px-2.5 pb-1.5 text-[11px] text-red-500">{shortcutError}</div>
      )}
      <button
        onClick={() => {
          window.api
            .invoke('shortcuts:reset')
            .then((result: ShortcutUpdateResult) => {
              if (result.ok) {
                setShortcuts(result.shortcuts)
              }
            })
        }}
        className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-black/5 transition-colors"
      >
        Reset to defaults
      </button>
    </div>,
    document.body
  )

  return (
    <div className="pl-3 pr-3 glass rounded-[8px] font-sans flex-none h-[40px] max-h-[40px]">
      <div className="flex items-center justify-between w-full h-full gap-2">
        {/* Left - Voice, Session, Timer, Brief | Chat, Hide */}
        <div className="flex items-center gap-1 justify-start">
          {/* Voice Button with Equalizer */}
          <Button
            variant={isVoiceActive ? 'destructive' : 'ghost'}
            size="xs"
            onClick={handleVoiceClick}
          >
            {isVoiceActive ? (
              <VoiceEqualizer isActive={isVoiceActive} onTranscript={handleVoiceTranscript} />
            ) : (
              <Mic size={12} />
            )}
          </Button>

          <Button
            variant={isRecording ? 'destructive' : 'ghost'}
            size="xs"
            onClick={handleSessionClick}
          >
            {isRecording && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />}
            <span>{isRecording ? 'Stop' : 'Start Session'}</span>
          </Button>
          
          {isRecording && (
            <>
              <span className="text-xs font-mono tabular-nums text-red-500 ml-1">{formatTime(recordingTime)}</span>
              {currentActivity && (
                <span className="text-[10px] text-gray-500 ml-2 truncate max-w-[150px]" title={currentActivity}>
                  {currentActivity}
                </span>
              )}
            </>
          )}
          
          {/* Show activity button during recording OR when session ended with summary */}
          {(isRecording || sessionEnded) && (
            <Button
              ref={sessionChatButtonRef}
              variant={showSessionChat ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setShowSessionChat(!showSessionChat)}
              title={sessionEnded ? "View Session Summary" : "Session Activity & Notes"}
            >
              <Activity size={12} />
              {sessionEnded && <span className="ml-1 w-2 h-2 bg-emerald-500 rounded-full" />}
            </Button>
          )}

          {/* Project Selector */}
          <Button
            ref={buttonRef}
            variant="ghost"
            size="xs"
            onClick={() => {
              setShowProjectDropdown(!showProjectDropdown)
              setShowSettingsMenu(false)
            }}
            className="max-w-[180px]"
          >
            <span className="truncate">{getSelectedProjectName()}</span>
            <ChevronDown size={10} className={`transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
          </Button>

          {dropdownPortal}

          {/* Separator */}
          <div className="w-px h-4 bg-black/10 mx-1" />

          <Button
            variant={chatActive ? 'secondary' : 'ghost'}
            size="xs"
            onClick={handleChatClick}
          >
            <span>Chat</span>
            <Command />
            <CornerDownLeft />
          </Button>
          
          <Button variant="ghost" size="xs">
            <span>Hide</span>
            <Command />
            <Space />
          </Button>
        </div>

        {/* Right - Drag, Logout */}
        <div className="flex items-center gap-1 justify-end">
          <Button
            ref={settingsButtonRef}
            variant="ghost"
            size="xs"
            onClick={() => {
              setShowSettingsMenu(!showSettingsMenu)
              setShowProjectDropdown(false)
            }}
            title="Settings"
          >
            <Settings size={14} />
          </Button>
          {settingsPortal}
          <div className="cursor-grab active:cursor-grabbing px-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <GripVertical size={16} className="text-gray-500" />
          </div>
          <Button
            ref={exitButtonRef}
            variant="ghost"
            size="xs"
            onClick={() => {
              setShowExitMenu(!showExitMenu)
              setShowSettingsMenu(false)
              setShowProjectDropdown(false)
            }}
            title="Exit"
          >
            <Power size={14} />
          </Button>
          {showExitMenu && createPortal(
            <div
              ref={exitMenuRef}
              className="glass rounded-[8px] min-w-[120px] overflow-hidden py-1"
              style={{
                position: 'fixed',
                top: exitMenuPosition.top,
                left: exitMenuPosition.left,
                zIndex: 9999
              }}
            >
              <button
                onClick={handleLogout}
                className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 transition-colors"
              >
                <LogOut size={12} className="text-gray-500" />
                <span>Logout</span>
              </button>
              <button
                onClick={handleExit}
                className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 transition-colors text-red-600"
              >
                <Power size={12} />
                <span>Exit</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
      
      {/* Session Chat Portal - show during recording OR when session just ended with summary */}
      {showSessionChat && (isRecording || sessionEnded) && createPortal(
        <div
          style={{
            position: 'fixed',
            top: sessionChatPosition.top,
            left: sessionChatPosition.left,
            zIndex: 9999
          }}
        >
          <SessionChat 
            isVisible={true} 
            onClose={handleCloseSessionChat}
            sessionSummary={sessionSummary}
            onAddToWorkspace={handleAddToWorkspace}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
