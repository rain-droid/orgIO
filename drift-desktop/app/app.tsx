import { useState, lazy, Suspense, useEffect } from 'react'
import { Mainbar } from './components/mainbar/Mainbar'
import { useUIState } from './state/UIStateProvider'
import { shell } from 'electron'

const AI = lazy(() => import('./components/mainbar/AI').then((module) => ({ default: module.AI })))

// Auth URL - opens in browser for login
const AUTH_URL = 'https://34.185.148.16/auth/desktop'

// Login Screen Component - just a button that opens browser
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    // Open browser for authentication
    window.api.send('open-auth-url', AUTH_URL)
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 to-black">
      <div className="glass rounded-2xl p-8 flex flex-col items-center gap-6 max-w-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Drift</h1>
        </div>

        <p className="text-gray-400 text-center">
          AI-Powered Sprint Planning
          <br />
          <span className="text-sm">Sign in to start your session</span>
        </p>

        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Opening Browser...' : 'Sign In with Drift'}
        </button>

        {isLoading && (
          <p className="text-xs text-gray-500 text-center">
            Complete login in your browser.<br/>
            The app will update automatically.
          </p>
        )}
      </div>
    </div>
  )
}

// Main App Component
function MainApp({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false)
  const [dockPosition, setDockPosition] = useState<'top' | 'bottom'>('top')

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]'
  const dockSizeClass = 'w-[520px] h-[56px]'
  const dockPositionClass = dockPosition === 'top'
    ? 'top-3 left-1/2 -translate-x-1/2'
    : 'bottom-3 left-1/2 -translate-x-1/2'

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

      <div className={`fixed z-40 ${dockSizeClass} ${dockPositionClass}`}>
        <Mainbar dockPosition={dockPosition} onDockChange={setDockPosition} />
      </div>

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
    Promise.all([
      window.api.invoke('get-auth-token'),
      window.api.invoke('get-user-email')
    ]).then(([token, email]: [string | null, string | null]) => {
      if (token) {
        setIsAuthenticated(true)
        setUserEmail(email || 'user@drift.app')
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
    return <LoginScreen onLogin={() => {}} />
  }

  return <MainApp userEmail={userEmail} onLogout={handleLogout} />
}
