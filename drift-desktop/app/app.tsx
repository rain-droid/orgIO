import { useState, lazy, Suspense, useEffect } from 'react'
import { Mainbar } from './components/mainbar/Mainbar'
import { useUIState } from './state/UIStateProvider'

const AI = lazy(() => import('./components/mainbar/AI').then((module) => ({ default: module.AI })))

// Auth URL - opens in browser for login
const AUTH_URL = 'https://test.usehavoc.com/auth/desktop'

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
function MainApp() {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false)

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]'

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if we have a stored token AND validate it
    window.api.invoke('get-auth-token').then(async (token: string | null) => {
      if (token) {
        // Validate token by trying to sync
        const result = await window.api.invoke('drift:sync')
        if (result?.error?.includes('401') || result?.error?.includes('Not authenticated')) {
          // Token is invalid/expired - clear it
          console.log('[Auth] Token expired, clearing...')
          await window.api.invoke('store-auth-token', null)
          setIsAuthenticated(false)
        } else {
          setIsAuthenticated(true)
        }
      }
      setIsLoading(false)
    })

    // Listen for auth token from callback
    window.api.receive('auth-token-received', (data: { token: string; email: string }) => {
      window.api.invoke('store-auth-token', data.token)
      setIsAuthenticated(true)
    })

    return () => {
      window.api.removeAllListeners('auth-token-received')
    }
  }, [])

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

  return <MainApp />
}
