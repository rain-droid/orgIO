import { useState, lazy, Suspense, useEffect } from 'react'
import { Mainbar } from './components/mainbar/Mainbar'
import { useUIState } from './state/UIStateProvider'
import { shell } from 'electron'

const AI = lazy(() => import('./components/mainbar/AI').then((module) => ({ default: module.AI })))

// Auth URL - opens in browser for login
const AUTH_URL = 'https://34.185.148.16/auth/desktop'

// Login Screen Component - intro -> auth flow
function LoginScreen() {
  const [stage, setStage] = useState<'intro' | 'auth'>('intro')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = () => {
    setIsLoading(true)
    window.api.send('open-auth-url', AUTH_URL)
  }

  const handleContinue = () => {
    if (stage !== 'intro') return
    setStage('auth')
    handleLogin()
  }

  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="login-left">
          <div className="login-card">
            <div className="login-logo">
              <div className="login-logo-mark">D</div>
              <span>Drift</span>
            </div>

            <h1 className="login-title">Welcome to Drift</h1>
            <p className="login-subtitle">The ultimate AI sprint assistant</p>

            <button
              onClick={stage === 'intro' ? handleContinue : handleLogin}
              disabled={stage === 'auth' && isLoading}
              className="login-cta"
            >
              {stage === 'intro' ? 'Continue' : isLoading ? 'Opening Browser...' : 'Continue'}
            </button>

            {stage === 'auth' && (
              <p className="login-helper">
                Complete login in your browser. The app will update automatically.
              </p>
            )}
          </div>
        </div>
        <div className="login-right">
          <div className="login-preview">
            <div className="login-preview-pill">Drift overlay</div>
            <div className="login-preview-card">
              <div className="login-preview-header">What should I say next?</div>
              <div className="login-preview-body">
                Smart suggestions and real-time context, always ready to help.
              </div>
            </div>
            <div className="login-preview-caption">
              Real-time assistant, always ready to help
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App Component
function MainApp({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false)

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]'

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
      {/* User info bar */}
      <div className="absolute top-2 right-4 flex items-center gap-2 z-50">
        <span className="text-xs text-gray-400">{userEmail}</span>
        <button 
          onClick={onLogout}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>

      <Mainbar />

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isChatPaneVisible ? 'max-h-[45vh] opacity-100' : 'max-h-0 opacity-0'} px-4 ${chatPaneWidthClass}`}
      >
        <Suspense
          fallback={<div className="flex-1 p-4 glass rounded-lg animate-pulse">Loading AI...</div>}
        >
          <AI isChatPaneVisible={isChatPaneVisible} onContentChange={setIsWideChatPane} />
        </Suspense>
      </div>
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if we have a stored token
    window.api.invoke('get-auth-token').then((token: string | null) => {
      if (token) {
        // TODO: Validate token and get user info
        setIsAuthenticated(true)
        setUserEmail('user@drift.app') // Placeholder
      }
      setIsLoading(false)
    })

    // Listen for auth token from callback
    window.api.receive('auth-token-received', (data: { token: string; email: string }) => {
      window.api.invoke('store-auth-token', data.token)
      setUserEmail(data.email)
      setIsAuthenticated(true)
    })

    return () => {
      window.api.removeAllListeners('auth-token-received')
    }
  }, [])

  const handleLogout = () => {
    window.api.invoke('store-auth-token', null)
    setIsAuthenticated(false)
    setUserEmail('')
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <MainApp userEmail={userEmail} onLogout={handleLogout} />
}
