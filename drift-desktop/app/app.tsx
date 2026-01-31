import { useState, lazy, Suspense, useEffect } from 'react'
import { Mainbar } from './components/mainbar/Mainbar'
import { useUIState } from './state/UIStateProvider'
import { useAuth, useUser, SignInButton, SignOutButton } from '@clerk/clerk-react'

const AI = lazy(() => import('./components/mainbar/AI').then((module) => ({ default: module.AI })))

// Login Screen Component
function LoginScreen() {
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

        <SignInButton mode="modal">
          <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
            Sign In with Clerk
          </button>
        </SignInButton>
      </div>
    </div>
  )
}

// Main App Component
function MainApp() {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false)
  const { user } = useUser()

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]'

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
      {/* User info bar */}
      <div className="absolute top-2 right-4 flex items-center gap-2 z-50">
        <span className="text-xs text-gray-400">{user?.primaryEmailAddress?.emailAddress}</span>
        <SignOutButton>
          <button className="text-xs text-gray-500 hover:text-white transition-colors">
            Sign Out
          </button>
        </SignOutButton>
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
  const { isSignedIn, isLoaded, getToken } = useAuth()

  // Sync auth token with main process
  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) {
          window.api.invoke('store-auth-token', token)
        }
      })
    }
  }, [isSignedIn, getToken])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <LoginScreen />
  }

  return <MainApp />
}