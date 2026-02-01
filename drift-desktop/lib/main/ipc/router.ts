import { BrowserWindow, ipcMain, screen, desktopCapturer, shell } from 'electron'
import { appState } from '@/lib/state/AppStateMachine'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'
import { activityTracker } from '@/lib/main/activityTracker'
import { createServer, Server } from 'http'
import { parse } from 'url'

// Persistent store for auth - lazy loaded
let store: any = null
const getStore = async () => {
  if (!store) {
    const Store = (await import('electron-store')).default
    store = new Store<{ authToken?: string; userEmail?: string }>()
  }
  return store
}

// Drift Backend API URL - use test domain or fall back to IP
const DRIFT_API_URL = process.env.DRIFT_API_URL || 'https://test.usehavoc.com/api'

interface IpcContext {
  shortcutsHelper: ShortcutsHelper
  createAppWindow: (invisible: boolean) => BrowserWindow
  getMainWindow: () => BrowserWindow | null
  setMainWindow: (win: BrowserWindow) => void
  getIsInvisible: () => boolean
  setIsInvisible: (val: boolean) => void
  setCurrentInputValue: (val: string) => void
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const {
    shortcutsHelper,
    createAppWindow,
    getMainWindow,
    setMainWindow,
    getIsInvisible,
    setIsInvisible,
    setCurrentInputValue
  } = ctx

  /* ---------------- generic helpers ---------------- */
  const broadcast = (channel: string, ...args: any[]) => {
    windowRegistry.broadcast(channel, ...args)
  }

  /* ---------------- basic handlers ---------------- */
  ipcMain.handle('get-invisibility-state', () => getIsInvisible())
  ipcMain.handle('shortcuts:get', () => shortcutsHelper.getShortcuts())
  ipcMain.handle('shortcuts:set', (_evt, next) => shortcutsHelper.setShortcuts(next))
  ipcMain.handle('shortcuts:reset', () => shortcutsHelper.resetShortcuts())

  ipcMain.on('quit-app', () => {
    import('electron').then(({ app }) => app.quit())
  })

  ipcMain.on('set-current-input-value', (_event, value: string) => {
    setCurrentInputValue(value)
  })

  ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean) => {
    const m = getMainWindow()
    if (m && !m.isDestroyed()) {
      m.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  ipcMain.on('input-changed', (_evt, value: string) => {
    setCurrentInputValue(value)
  })

  /* ---------------- Auth handlers ---------------- */
  let authServer: Server | null = null
  ipcMain.on('open-auth-url', (_evt, url: string) => {
    // Stop any existing server
    if (authServer) {
      authServer.close()
      authServer = null
    }

    // Create callback server
    authServer = createServer(async (req, res) => {
      const urlParts = parse(req.url || '', true)

      if (urlParts.pathname === '/callback') {
        const token = urlParts.query.token as string
        const email = urlParts.query.email as string

        if (token) {
          // Store persistently
          const s = await getStore()
          s.set('authToken', token)
          s.set('userEmail', email || 'user@drift.app')

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <head>
                <style>
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh; 
                    margin: 0;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                  }
                  .container { text-align: center; }
                  h1 { color: #4ade80; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>✓ Connected to Drift!</h1>
                  <p>You can close this tab and return to the app.</p>
                </div>
              </body>
            </html>
          `)

          broadcast('auth-token-received', { token, email: email || 'user@drift.app' })

          setTimeout(() => {
            if (authServer) {
              authServer.close()
              authServer = null
            }
          }, 1000)
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing token')
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })

    authServer.listen(0, '127.0.0.1', () => {
      const address = authServer!.address()
      if (address && typeof address === 'object') {
        const port = address.port
        const callbackUrl = `http://localhost:${port}/callback`
        const authUrl = `${url}?callback=${encodeURIComponent(callbackUrl)}`
        shell.openExternal(authUrl)
      }
    })
  })

  ipcMain.handle('store-auth-token', async (_evt, token: string | null) => {
    const s = await getStore()
    if (token === null) {
      s.delete('authToken')
      s.delete('userEmail')
    } else {
      s.set('authToken', token)
    }
    return true
  })

  ipcMain.handle('get-auth-token', async () => {
    const s = await getStore()
    return s.get('authToken') || null
  })

  /* ---------------- Chat handlers (connect to Drift backend) ---------------- */
  let apiRequestController: AbortController | null = null

  ipcMain.on('chat:submit', async (_evt, input: string) => {
    console.log('[router.ts] chat:submit received with input:', input)
    setCurrentInputValue(input)
    apiRequestController = new AbortController()

    try {
      // 1. Capture screenshot
      const primaryDisplay = screen.getPrimaryDisplay()
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: primaryDisplay.size
      })
      const primaryScreenSource =
        sources.find((source) => source.display_id === String(primaryDisplay.id)) || sources[0]

      let screenshotBase64 = ''
      if (primaryScreenSource) {
        const screenshotPng = primaryScreenSource.thumbnail.toPNG()
        if (screenshotPng && screenshotPng.length > 0) {
          screenshotBase64 = screenshotPng.toString('base64')
        }
      }

      // 2. Send to Drift backend
      const s = await getStore()
      const authToken = s.get('authToken')
      const response = await fetch(`${DRIFT_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: input,
          screenshot: screenshotBase64
        }),
        signal: apiRequestController.signal
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      broadcast('api-success')
      broadcast('chat:chunk', { text: data.response || data.message })
    } catch (error) {
      console.error('Drift API error:', error)
      broadcast('api-error', String(error))
    }
  })

  ipcMain.on('chat:cancel', () => {
    apiRequestController?.abort()
    appState.dispatch('ESC')
  })

  ipcMain.on('open-chat', () => {
    appState.dispatch('OPEN_CHAT')
  })

  /* ---------------- Session Management (connect to Drift backend) ---------------- */
  let activeSessionId: string | null = null
  let activeSessionBriefId: string | null = null
  let activeSessionBriefName: string | null = null

  ipcMain.handle('session:start', async (_evt, briefId: string, role: string) => {
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    try {
      const response = await fetch(`${DRIFT_API_URL}/desktop/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ briefId, role })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Session start failed: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      activeSessionId = data.sessionId
      activeSessionBriefId = data.briefId || briefId
      activeSessionBriefName = data.briefName || 'Project'
      
      // Start activity tracking with live updates
      activityTracker.start(role, (activity) => {
        // Broadcast live activity updates to renderer
        broadcast('session:activity', activity)
      })
      console.log('[Session] Started tracking activities for role:', role)
      
      broadcast('session:started', data)
      return data
    } catch (error) {
      console.error('Session start error:', error)
      return { error: String(error) }
    }
  })

  ipcMain.handle('session:end', async (_evt, _activities?: any[], summary?: string) => {
    if (!activeSessionId) {
      return { error: 'No active session' }
    }
    
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    try {
      // Stop activity tracking and get results
      const { activities, summary: activitySummary, notes } = activityTracker.stop()
      console.log('[Session] Stopped tracking, got', activities.length, 'relevant activities,', notes.length, 'notes')
      
      // Generate summary from activities + notes
      let generatedSummary = summary
      if (!generatedSummary) {
        const summaryParts: string[] = []
        
        // Add activity summary
        for (const item of activitySummary.slice(0, 3)) {
          const mins = Math.floor(item.totalDuration / 60)
          if (mins > 0) {
            if (item.files.length > 0) {
              summaryParts.push(`${item.app}: ${item.files.slice(0, 3).join(', ')} (${mins}m)`)
            } else {
              summaryParts.push(`${item.app} (${mins}m)`)
            }
          }
        }
        
        // Add manual notes
        if (notes.length > 0) {
          summaryParts.push('Notes: ' + notes.map(n => n.text).join(', '))
        }
        
        generatedSummary = summaryParts.join(' | ')
      }
      
      // Convert to API format (include screenshots for relevant activities)
      const apiActivities = activities.map(a => ({
        app: a.app,
        title: a.title,
        file: a.file,
        duration: a.duration,
        timestamp: a.timestamp,
        screenshot: a.screenshot // Include screenshot if captured
      }))
      
      const response = await fetch(`${DRIFT_API_URL}/desktop/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          activities: apiActivities,
          notes: notes.map(n => n.text),
          summary: generatedSummary
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Session end failed: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      const briefId = activeSessionBriefId
      const briefName = activeSessionBriefName
      activeSessionId = null
      activeSessionBriefId = null
      activeSessionBriefName = null
      broadcast('session:ended', { ...data, activitySummary, notes, briefId, briefName })
      return { ...data, activitySummary, notes, briefId, briefName }
    } catch (error) {
      console.error('Session end error:', error)
      return { error: String(error) }
    }
  })

  ipcMain.handle('session:get-active', () => activeSessionId)
  
  ipcMain.handle('session:get-activities', () => {
    return activityTracker.getActivities()
  })
  
  ipcMain.handle('session:add-note', (_evt, text: string) => {
    activityTracker.addNote(text)
    return { ok: true }
  })
  
  ipcMain.handle('session:get-status', () => {
    return activityTracker.getStatus()
  })

  // Analyze session and update workspace tasks
  ipcMain.handle('session:analyze', async (_evt, data: {
    sessionId: string
    submissionId?: string
    briefId?: string
    activities?: Array<{ app: string; totalDuration: number; files: string[] }>
    notes?: Array<{ text: string; timestamp: number }>
    summaryLines: string[]
    durationMinutes: number
  }) => {
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    try {
      const response = await fetch(`${DRIFT_API_URL}/desktop/session/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Session analysis failed: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      
      // Broadcast to web clients that workspace was updated
      broadcast('workspace:updated', {
        sessionId: data.sessionId,
        briefId: data.briefId,
        ...result
      })
      
      return result
    } catch (error) {
      console.error('Session analysis error:', error)
      return { error: String(error) }
    }
  })

  /* ---------------- Sync with Drift backend ---------------- */
  ipcMain.handle('drift:sync', async () => {
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    try {
      const response = await fetch(`${DRIFT_API_URL}/desktop/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({})
      })
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`)
      }
      
      const data = await response.json()
      broadcast('drift:synced', data)
      return data
    } catch (error) {
      console.error('Drift sync error:', error)
      return { error: String(error) }
    }
  })

  /* ---------------- toggle invisibility ---------------- */
  ipcMain.on('toggle-invisibility', () => {
    const newInvisible = !getIsInvisible()
    setIsInvisible(newInvisible)

    const m = getMainWindow()
    if (m && !m.isDestroyed()) m.close()

    const newMain = createAppWindow(newInvisible)
    setMainWindow(newMain)
    shortcutsHelper.updateMainWindow(newMain)

    newMain.webContents.on('did-finish-load', () => {
      if (!newMain.isDestroyed()) {
        newMain.webContents.send('invisibility-state-changed', newInvisible)
      }
    })

    broadcast('invisibility-state-changed', newInvisible)
  })

  /* ---------------- Screenshot capture ---------------- */
  ipcMain.handle('capture-screenshot', async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: primaryDisplay.size
    })
    const source =
      sources.find((s) => s.display_id === String(primaryDisplay.id)) || sources[0]

    if (!source) return null

    const png = source.thumbnail.toPNG()
    return png.toString('base64')
  })
}
