import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-shell'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface RecordingStatus {
  is_recording: boolean
  brief_id: string | null
  duration_seconds: number
}

const BRIEFS = [
  { id: '1', name: 'Apple Pay Integration' },
  { id: '2', name: 'Dashboard Redesign' },
  { id: '3', name: 'API Optimization' },
]

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [status, setStatus] = useState<RecordingStatus | null>(null)
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Auth
  useEffect(() => {
    invoke<string | null>('get_auth_token').then(token => setIsLoggedIn(!!token))
  }, [])

  useEffect(() => {
    const unsub = listen<string>('auth-token', async (e) => {
      await invoke('set_auth_token', { token: e.payload })
      setIsLoggedIn(true)
      setLoggingIn(false)
    })
    return () => { unsub.then(fn => fn()) }
  }, [])

  // Recording status polling
  useEffect(() => {
    if (!isLoggedIn) return
    const interval = setInterval(async () => {
      setStatus(await invoke<RecordingStatus>('get_recording_status'))
    }, 500)
    return () => clearInterval(interval)
  }, [isLoggedIn])

  const handleLogin = async () => {
    setLoggingIn(true)
    try {
      const callback = await invoke<string>('start_auth_server')
      await open(`https://34.185.148.16/auth/desktop?callback=${encodeURIComponent(callback)}`)
    } catch { setLoggingIn(false) }
  }

  const handleStart = async () => {
    if (!selectedBrief) { setShowSettings(true); return }
    await invoke('start_recording', { briefId: selectedBrief })
    setShowSettings(false)
  }

  const handleStop = () => invoke('stop_recording')
  const handleClose = () => getCurrentWindow().close()
  const handleHide = () => getCurrentWindow().hide()

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Login View
  if (!isLoggedIn) {
    return (
      <div className="bar" data-tauri-drag-region>
        <button className="btn primary" onClick={handleLogin} disabled={loggingIn}>
          {loggingIn ? 'Connecting...' : 'Sign In to Drift'}
        </button>
        <div className="divider" />
        <button className="icon-btn" onClick={handleClose} title="Close">
          <CloseIcon />
        </button>
      </div>
    )
  }

  // Main Bar
  return (
    <div className="container">
      <div className="bar" data-tauri-drag-region>
        {/* Recording Indicator */}
        <div className={`indicator ${status?.is_recording ? 'recording' : ''}`} />

        {/* Main Action */}
        <button 
          className={`btn ${status?.is_recording ? 'stop' : 'primary'}`}
          onClick={status?.is_recording ? handleStop : handleStart}
        >
          {status?.is_recording ? (
            <>Stop · {formatTime(status.duration_seconds)}</>
          ) : (
            'Start Session'
          )}
        </button>

        <div className="divider" />

        {/* Settings / Sprint Select */}
        <button 
          className="icon-btn" 
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          <GridIcon />
        </button>

        {/* Hide */}
        <button className="icon-btn" onClick={handleHide} title="Hide (Ctrl+\)">
          <MinusIcon />
        </button>

        {/* Close */}
        <button className="icon-btn" onClick={handleClose} title="Close">
          <CloseIcon />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="panel">
          <div className="panel-section">
            <div className="panel-label">Select Sprint</div>
            {BRIEFS.map(b => (
              <button
                key={b.id}
                className={`panel-item ${selectedBrief === b.id ? 'selected' : ''}`}
                onClick={() => { setSelectedBrief(b.id); setShowSettings(false) }}
              >
                {b.name}
                {selectedBrief === b.id && <CheckIcon />}
              </button>
            ))}
          </div>
          <div className="panel-section">
            <div className="panel-label">Shortcuts</div>
            <div className="shortcut">
              <span>Show/Hide</span>
              <div className="keys"><Key>Ctrl</Key><Key>\</Key></div>
            </div>
            <div className="shortcut">
              <span>Start/Stop</span>
              <div className="keys"><Key>Ctrl</Key><Key>Enter</Key></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)

const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/>
  </svg>
)

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="key">{children}</span>
)
