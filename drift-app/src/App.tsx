import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/clerk-react'
import { invoke } from '@tauri-apps/api/core'

interface RecordingStatus {
  is_recording: boolean
  brief_id: string | null
  duration_seconds: number
  screenshot_count: number
}

interface Brief {
  id: string
  name: string
}

export default function App() {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RecordingStatus | null>(null)
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [selectedBrief, setSelectedBrief] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [synced, setSynced] = useState(false)

  // Sync auth token with Tauri backend
  useEffect(() => {
    const syncToken = async () => {
      if (isSignedIn) {
        const token = await getToken()
        if (token) {
          await invoke('set_auth_token', { token })
          setSynced(true)
        }
      }
    }
    syncToken()
  }, [isSignedIn, getToken])

  // Poll recording status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await invoke<RecordingStatus>('get_recording_status')
        setStatus(s)
      } catch (e) {
        console.error(e)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch briefs from web app
  useEffect(() => {
    if (isSignedIn && synced) {
      // Mock briefs - in production, fetch from backend
      setBriefs([
        { id: '1', name: 'Apple Pay Checkout' },
        { id: '2', name: 'User Dashboard' },
      ])
    }
  }, [isSignedIn, synced])

  const handleStartRecording = async () => {
    if (!selectedBrief) return
    setLoading(true)
    try {
      await invoke('start_recording', { briefId: selectedBrief })
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleStopRecording = async () => {
    setLoading(true)
    try {
      const screenshots = await invoke<string[]>('stop_recording')
      console.log(`Captured ${screenshots.length} screenshots`)
      // TODO: Send to backend for processing
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  if (!isSignedIn) {
    return (
      <div className="app">
        <div className="header">
          <h1>DRIFT</h1>
        </div>
        <div className="content center">
          <p className="subtitle">Sign in to start recording</p>
          <SignInButton mode="modal">
            <button className="btn primary">Sign In</button>
          </SignInButton>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h1>DRIFT</h1>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="content">
        {/* Status */}
        {status?.is_recording ? (
          <div className="recording-active">
            <div className="pulse-dot" />
            <span>Recording</span>
          </div>
        ) : (
          <div className="recording-idle">
            <span>Ready</span>
          </div>
        )}

        {/* Brief Selection */}
        {!status?.is_recording && (
          <div className="section">
            <label>Select Brief</label>
            <select 
              value={selectedBrief} 
              onChange={(e) => setSelectedBrief(e.target.value)}
            >
              <option value="">Choose a brief...</option>
              {briefs.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Recording Info */}
        {status?.is_recording && (
          <div className="stats">
            <div className="stat">
              <span className="label">Duration</span>
              <span className="value">{formatDuration(status.duration_seconds)}</span>
            </div>
            <div className="stat">
              <span className="label">Captures</span>
              <span className="value">{status.screenshot_count}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="actions">
          {status?.is_recording ? (
            <button 
              className="btn danger" 
              onClick={handleStopRecording}
              disabled={loading}
            >
              End Session
            </button>
          ) : (
            <button 
              className="btn primary" 
              onClick={handleStartRecording}
              disabled={!selectedBrief || loading}
            >
              Start Recording
            </button>
          )}
        </div>

        {/* Sync Status */}
        <div className="sync-status">
          {synced ? (
            <span className="synced">✓ Synced with Web App</span>
          ) : (
            <span className="syncing">Syncing...</span>
          )}
        </div>
      </div>
    </div>
  )
}
