import React from 'react'
import ReactDOM from 'react-dom/client'
import appIcon from '@/resources/build/icon.png'
import { WindowContextProvider, menuItems } from '@/lib/window'
import App from './app'
import { UIStateProvider } from './state/UIStateProvider'
import { ClerkProvider } from '@clerk/clerk-react'
import './styles/app.css'

const CLERK_PUBLISHABLE_KEY = 'pk_test_ZmluZS1zaHJldy01OC5jbGVyay5hY2NvdW50cy5kZXY$'

console.timeEnd('renderer bootstrap')
console.time('react mount')
ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <UIStateProvider>
        <WindowContextProvider titlebar={{ title: 'Drift', icon: appIcon, menuItems }}>
          <App />
        </WindowContextProvider>
      </UIStateProvider>
    </ClerkProvider>
  </React.StrictMode>
)
console.timeEnd('react mount')
