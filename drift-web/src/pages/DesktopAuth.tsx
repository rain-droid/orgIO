import { useEffect, useState } from 'react'
import { useUser, useAuth, SignInButton } from '@clerk/clerk-react'
import { Loader2, Monitor, Check, ArrowRight } from 'lucide-react'

export function DesktopAuth() {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [status, setStatus] = useState<'login' | 'redirecting' | 'done' | 'error'>('login')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSignedIn) {
      setStatus('login')
      return
    }

    const redirectToApp = async () => {
      setStatus('redirecting')
      try {
        const token = await getToken()
        if (!token) {
          setError('Could not get authentication token')
          setStatus('error')
          return
        }

        // Redirect to deep link with token
        const deepLink = `drift://auth?token=${encodeURIComponent(token)}`
        
        // Try to open the deep link
        window.location.href = deepLink
        
        // Mark as done after a short delay
        setTimeout(() => {
          setStatus('done')
        }, 500)
        
      } catch (err) {
        console.error('Failed to redirect to desktop app:', err)
        setError('Failed to open desktop app')
        setStatus('error')
      }
    }

    redirectToApp()
  }, [isSignedIn, getToken])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-[spin_20s_linear_infinite]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(139,92,246,0.1)_0%,transparent_50%)]" />
        </div>
      </div>

      <div className="relative z-10 text-center p-10 max-w-md">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_20px_60px_rgba(99,102,241,0.4)]">
          <Monitor className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          Drift Desktop
        </h1>
        
        {status === 'login' && (
          <>
            <p className="text-zinc-400 mb-8">
              Sign in to connect your desktop app
            </p>
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-[0_12px_40px_rgba(99,102,241,0.4)] transition-all hover:-translate-y-0.5">
                Sign In
                <ArrowRight className="w-5 h-5" />
              </button>
            </SignInButton>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <p className="text-zinc-400 mb-8">
              Opening Drift Desktop...
            </p>
            <div className="flex items-center justify-center gap-3 text-indigo-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Redirecting</span>
            </div>
          </>
        )}

        {status === 'done' && (
          <>
            <p className="text-emerald-400 mb-6 flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              Connected! You can close this tab.
            </p>
            <p className="text-zinc-500 text-sm">
              If the app didn't open,{' '}
              <a href="drift://auth" className="text-indigo-400 hover:underline">
                click here
              </a>
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-400 mb-6">
              {error || 'Something went wrong'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Try Again
            </button>
            <p className="text-zinc-500 text-sm mt-4">
              Make sure Drift Desktop is installed
            </p>
          </>
        )}

        {/* User info if signed in */}
        {isSignedIn && user && status !== 'login' && (
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-center gap-3">
              {user.imageUrl && (
                <img 
                  src={user.imageUrl} 
                  alt="" 
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-zinc-400 text-sm">
                {user.emailAddresses[0]?.emailAddress}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
