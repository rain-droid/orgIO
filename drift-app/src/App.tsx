import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-shell'

interface RecordingStatus {
  is_recording: boolean
  brief_id: string | null
  duration_seconds: number
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [status, setStatus] = useState<RecordingStatus | null>(null)
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null)
  const [showBriefSelect, setShowBriefSelect] = useState(false)
  const [activities, setActivities] = useState<string[]>([])

  const briefs = [
    { id: '1', name: 'Apple Pay Integration' },
    { id: '2', name: 'Dashboard Redesign' },
    { id: '3', name: 'API Optimization' },
  ]

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await invoke<string | null>('get_auth_token')
        setIsLoggedIn(!!token)
      } catch (e) {
        console.error(e)
      }
    }
    checkAuth()
  }, [])

  // Listen for deep link auth token
  useEffect(() => {
    const unsubscribe = listen<string>('auth-token', async (event) => {
      const token = event.payload
      console.log('Received auth token from deep link')
      await invoke('set_auth_token', { token })
      setIsLoggedIn(true)
    })
    
    return () => {
      unsubscribe.then(fn => fn())
    }
  }, [])

  // Poll recording status
  useEffect(() => {
    if (!isLoggedIn) return
    
    const interval = setInterval(async () => {
      try {
        const s = await invoke<RecordingStatus>('get_recording_status')
        setStatus(s)
        
        // Simulate activity detection
        if (s.is_recording && Math.random() > 0.85) {
          const newActivities = [
            'Editing PaymentService.ts',
            'Running tests',
            'Reviewing PR #42',
            'Writing docs',
            'Debugging flow',
            'Updating API',
            'Refactoring code',
          ]
          setActivities(prev => [
            newActivities[Math.floor(Math.random() * newActivities.length)],
            ...prev
          ].slice(0, 3))
        }
      } catch (e) {
        console.error(e)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isLoggedIn])

  const handleLogin = async () => {
    // Opens web app desktop auth page, which will redirect back with drift:// deep link
    try {
      await open('https://34.185.148.16/auth/desktop')
    } catch (e) {
      console.error('Failed to open browser:', e)
    }
  }

  const handleStartRecording = async () => {
    if (!selectedBrief) {
      setShowBriefSelect(true)
      return
    }
    try {
      await invoke('start_recording', { briefId: selectedBrief })
      setShowBriefSelect(false)
      setActivities([])
    } catch (e) {
      console.error(e)
    }
  }

  const handleStopRecording = async () => {
    try {
      await invoke('stop_recording')
      setActivities([])
    } catch (e) {
      console.error(e)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getBriefName = (id: string | null) => {
    return briefs.find(b => b.id === id)?.name || 'Unknown'
  }

  // ==========================================
  // LOGIN SCREEN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-bg">
          <div className="login-gradient"></div>
        </div>
        <div className="login-content">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <h1 className="login-title">DRIFT</h1>
          <p className="login-subtitle">AI-Powered Work Tracking</p>
          
          <button className="login-btn" onClick={handleLogin}>
            <span>Log In with Drift</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          
          <p className="login-hint">Opens browser for secure authentication</p>
        </div>
      </div>
    )
  }

  // ==========================================
  // FLOATING BAR (CLUELY-STYLE)
  // ==========================================
  return (
    <div className="floating-app">
      {/* Main Bar */}
      <div className="floating-bar">
        {/* Left: Status Indicator */}
        <div className="bar-status">
          {status?.is_recording ? (
            <div className="status-recording">
              <span className="rec-dot"></span>
              <span className="rec-time">{formatTime(status.duration_seconds)}</span>
            </div>
          ) : (
            <div className="status-idle">
              <span className="idle-dot"></span>
            </div>
          )}
        </div>

        {/* Center: Action Button */}
        <button 
          className={`bar-action ${status?.is_recording ? 'recording' : ''}`}
          onClick={status?.is_recording ? handleStopRecording : handleStartRecording}
        >
          {status?.is_recording ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              <span>Stop Session</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              <span>Start Session</span>
            </>
          )}
        </button>

        {/* Right: Menu */}
        <div className="bar-menu">
          <button className="menu-btn" onClick={() => setShowBriefSelect(!showBriefSelect)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Brief Selector Dropdown */}
      {showBriefSelect && !status?.is_recording && (
        <div className="brief-dropdown">
          <div className="dropdown-header">Select Sprint</div>
          {briefs.map(brief => (
            <button
              key={brief.id}
              className={`dropdown-item ${selectedBrief === brief.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedBrief(brief.id)
                setShowBriefSelect(false)
              }}
            >
              <span>{brief.name}</span>
              {selectedBrief === brief.id && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Activity Panel (when recording) */}
      {status?.is_recording && (
        <div className="activity-panel">
          <div className="panel-header">
            <span className="panel-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              {getBriefName(selectedBrief)}
            </span>
            <span className="ai-tag">AI</span>
          </div>
          <div className="panel-activities">
            {activities.length === 0 ? (
              <div className="activity-empty">Analyzing your work...</div>
            ) : (
              activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <span className="activity-dot"></span>
                  <span>{act}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
