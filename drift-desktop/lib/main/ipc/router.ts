import { BrowserWindow, ipcMain, screen, desktopCapturer, shell } from 'electron'
import { appState } from '@/lib/state/AppStateMachine'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'
import { activityTracker } from '@/lib/main/activityTracker'
import { createServer, Server } from 'http'
import { parse } from 'url'
import axios from 'axios'

// Persistent store for auth - lazy loaded
let store: any = null
const getStore = async () => {
  if (!store) {
    const Store = (await import('electron-store')).default
    store = new Store<{ authToken?: string; userEmail?: string }>()
  }
  return store
}

// Drift Backend API URL - use environment variable or default to GCP server
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
      const response = await axios.post(`${DRIFT_API_URL}/chat`, {
        message: input,
        screenshot: screenshotBase64
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        signal: apiRequestController.signal,
        timeout: 30000
      })

      const data = response.data
      broadcast('api-success')
      broadcast('chat:chunk', { text: data.response || data.message })
    } catch (error: any) {
      console.error('Drift API error:', error)
      broadcast('api-error', String(error.message || error))
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
    // Check if session already active
    if (activeSessionId) {
      return { error: 'Session already active', sessionId: activeSessionId }
    }
    
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    try {
      const response = await axios.post(`${DRIFT_API_URL}/desktop/session/start`, {
        briefId,
        role
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 10000
      })
      
      const data = response.data
      
      // ONLY set state after successful response
      activeSessionId = data.sessionId
      activeSessionBriefId = data.briefId || briefId
      activeSessionBriefName = data.briefName || 'Project'
      
      // NOW start tracking
      activityTracker.start(role, (activity) => {
        broadcast('session:activity', activity)
      })
      console.log('[Session] Started tracking activities for role:', role)
      
      // Start continuous screen analysis AFTER session confirmed
      currentProjectName = data.briefName || 'Project'
      currentProjectDescription = null
      previousInsights = []
      
      if (screenAnalysisInterval) {
        clearInterval(screenAnalysisInterval)
      }
      
      // Demo mode: 3 fixed insights at 3s, 6s, 9s
      const demoInsights = [
        'Refactoring ActivityTracker component',
        'Adding TypeScript error handling',
        'Optimizing screen capture logic'
      ]
      
      console.log('[Session] Demo mode: sending 3 insights')
      
      // Send each insight with delay
      setTimeout(() => {
        console.log('[Demo] Insight 1')
        broadcast('session:screen-insight', { bullets: [demoInsights[0]], timestamp: Date.now() })
      }, 3000)
      
      setTimeout(() => {
        console.log('[Demo] Insight 2')
        broadcast('session:screen-insight', { bullets: [demoInsights[1]], timestamp: Date.now() })
      }, 6000)
      
      setTimeout(() => {
        console.log('[Demo] Insight 3')
        broadcast('session:screen-insight', { bullets: [demoInsights[2]], timestamp: Date.now() })
      }, 9000)
      
      broadcast('session:started', data)
      return data
      
    } catch (error: any) {
      // Cleanup on error
      activeSessionId = null
      activeSessionBriefId = null
      activeSessionBriefName = null
      
      console.error('Session start error:', error.message)
      if (error.response) {
        return { error: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}` }
      } else if (error.request) {
        return { error: 'Keine Verbindung zum Server möglich' }
      }
      return { error: error.message || String(error) }
    }
  })

  ipcMain.handle('session:end', async (_evt, _activities?: any[], summary?: string) => {
    if (!activeSessionId) {
      return { error: 'No active session' }
    }
    
    // Stop screen analysis
    if (screenAnalysisInterval) {
      clearInterval(screenAnalysisInterval)
      screenAnalysisInterval = null
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
      
      const response = await axios.post(`${DRIFT_API_URL}/desktop/session/end`, {
        sessionId: activeSessionId,
        activities: apiActivities,
        notes: notes.map(n => n.text),
        summary: generatedSummary
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 15000
      })
      
      const data = response.data
      const briefId = activeSessionBriefId
      const briefName = activeSessionBriefName
      activeSessionId = null
      activeSessionBriefId = null
      activeSessionBriefName = null
      broadcast('session:ended', { ...data, activitySummary, notes, briefId, briefName })
      return { ...data, activitySummary, notes, briefId, briefName }
    } catch (error: any) {
      console.error('Session end error:', error.message)
      
      // Cleanup screen analysis even on error
      if (screenAnalysisInterval) {
        clearInterval(screenAnalysisInterval)
        screenAnalysisInterval = null
      }
      
      // Stop activity tracking
      activityTracker.stop()
      
      // Reset session state
      const briefId = activeSessionBriefId
      const briefName = activeSessionBriefName
      activeSessionId = null
      activeSessionBriefId = null
      activeSessionBriefName = null
      
      // Provide detailed error
      if (error.code === 'ECONNABORTED') {
        return { error: 'Request timeout - server nicht erreichbar', briefId, briefName }
      } else if (error.response) {
        return { error: `Server error: ${error.response.status}`, briefId, briefName }
      } else if (error.request) {
        return { error: 'Keine Verbindung zum Server', briefId, briefName }
      }
      
      return { error: String(error.message || error), briefId, briefName }
    }
  })

  ipcMain.handle('session:get-active', () => activeSessionId)
  
  ipcMain.handle('session:get-activities', () => {
    return activityTracker.getActivities()
  })
  
  ipcMain.handle('session:add-note', async (_evt, text: string) => {
    const s = await getStore()
    const authToken = s.get('authToken')
    
    // If authenticated, process the note through AI
    if (authToken && text.length > 2) {
      try {
        const response = await axios.post(`${DRIFT_API_URL}/desktop/session/process-note`, {
          note: text,
          projectName: currentProjectName
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          timeout: 5000
        })
        
        const processed = response.data
        if (processed.bullet) {
          activityTracker.addNote(processed.bullet)
          broadcast('session:note-processed', { original: text, bullet: processed.bullet })
          return { ok: true, bullet: processed.bullet, processed: true }
        }
      } catch (err) {
        // Fallback to original note
        console.log('[Note] Processing failed, using original')
      }
    }
    
    // Fallback: add original note
    activityTracker.addNote(text)
    return { ok: true, bullet: text, processed: false }
  })
  
  ipcMain.handle('session:remove-note', (_evt, text: string) => {
    activityTracker.removeNote(text)
    return { ok: true }
  })
  
  ipcMain.handle('session:remove-last-note', () => {
    activityTracker.removeLastNote()
    return { ok: true }
  })
  
  ipcMain.handle('session:get-status', () => {
    return activityTracker.getStatus()
  })

  // Continuous screen analysis state
  let screenAnalysisInterval: NodeJS.Timeout | null = null
  let previousInsights: string[] = []
  let currentProjectName: string | null = null
  let currentProjectDescription: string | null = null

  // Start continuous screen analysis
  ipcMain.handle('session:start-screen-analysis', async (_evt, projectInfo?: { name: string; description?: string }) => {
    if (screenAnalysisInterval) {
      clearInterval(screenAnalysisInterval)
    }
    
    previousInsights = []
    currentProjectName = projectInfo?.name || null
    currentProjectDescription = projectInfo?.description || null
    
    const analyzeScreen = async () => {
      const s = await getStore()
      const authToken = s.get('authToken')
      
      if (!authToken || !activityTracker.getStatus().isTracking) {
        return
      }
      
      try {
        // Capture current screen
        const primaryDisplay = screen.getPrimaryDisplay()
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: Math.floor(primaryDisplay.size.width / 3), height: Math.floor(primaryDisplay.size.height / 3) }
        })
        
        if (sources.length === 0) return
        
        const screenshot = sources[0].thumbnail.toJPEG(50).toString('base64')
        
        // Send to backend for analysis
        const response = await fetch(`${DRIFT_API_URL}/desktop/session/analyze-screen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            screenshot,
            projectName: currentProjectName,
            projectDescription: currentProjectDescription,
            previousInsights: previousInsights.slice(-10)
          })
        })
        
        if (!response.ok) return
        
        const data = await response.json()
        
        if (data.bullets && data.bullets.length > 0 && !data.skip) {
          // Add to previous insights to avoid repetition
          previousInsights.push(...data.bullets)
          
          // Keep only last 20 insights
          if (previousInsights.length > 20) {
            previousInsights = previousInsights.slice(-20)
          }
          
          // Broadcast to renderer
          broadcast('session:screen-insight', {
            bullets: data.bullets,
            timestamp: Date.now()
          })
          
          console.log('[ScreenAnalysis] New insights:', data.bullets)
        }
      } catch (error) {
        console.error('[ScreenAnalysis] Error:', error)
      }
    }
    
    // Run analysis every 10 seconds
    screenAnalysisInterval = setInterval(analyzeScreen, 10000)
    
    // Run immediately
    analyzeScreen()
    
    return { ok: true }
  })

  // Stop screen analysis
  ipcMain.handle('session:stop-screen-analysis', () => {
    if (screenAnalysisInterval) {
      clearInterval(screenAnalysisInterval)
      screenAnalysisInterval = null
    }
    previousInsights = []
    return { ok: true }
  })

  // Get live AI insight about current session
  ipcMain.handle('session:get-live-insight', async () => {
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      return { error: 'Not authenticated' }
    }
    
    // Get current activities
    const activities = activityTracker.getActivities()
    const notes = activityTracker.getNotes()
    const status = activityTracker.getStatus()
    
    if (activities.length === 0) {
      return { insight: null }
    }
    
    try {
      const response = await fetch(`${DRIFT_API_URL}/desktop/session/live-insight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          activities: activities.slice(-10).map(a => ({
            app: a.app,
            title: a.title,
            file: a.file,
            duration: a.duration
          })),
          notes: notes.slice(-5).map(n => n.text),
          totalDuration: status.activityCount * 3 // rough estimate in seconds
        })
      })
      
      if (!response.ok) {
        return { error: `Insight failed: ${response.status}` }
      }
      
      const data = await response.json()
      return { insight: data.insight }
    } catch (error) {
      console.error('Live insight error:', error)
      return { error: String(error) }
    }
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
    console.log('[drift:sync] Starting sync...')
    console.log('[drift:sync] API URL:', DRIFT_API_URL)
    const s = await getStore()
    const authToken = s.get('authToken')
    
    if (!authToken) {
      console.log('[drift:sync] ❌ No auth token found')
      return { error: 'Not authenticated' }
    }
    
    console.log('[drift:sync] Auth token found, calling API:', `${DRIFT_API_URL}/desktop/sync`)
    
    try {
      const response = await axios.post(`${DRIFT_API_URL}/desktop/sync`, {
        userId: 'from-token'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 10000
      })
      
      console.log('[drift:sync] Response status:', response.status)
      const data = response.data
      
      console.log('[drift:sync] ✅ Success! Briefs:', data.briefs?.length || 0, 'Role:', data.role)
      if (data.briefs?.length > 0) {
        console.log('[drift:sync] Projects:', data.briefs.map((b: any) => b.name).join(', '))
      }
      broadcast('drift:synced', data)
      return data
    } catch (error: any) {
      console.error('[drift:sync] ❌ Error:', error.message)
      if (error.response) {
        const status = error.response.status
        console.error('[drift:sync] Response error:', status, error.response.data)
        
        // Specific handling for auth errors
        if (status === 401 || status === 403) {
          return { error: `401 - Not authenticated or token expired` }
        }
        
        return { error: `API Error: ${status} - ${JSON.stringify(error.response.data)}` }
      } else if (error.request) {
        console.error('[drift:sync] No response received:', error.request)
        return { error: 'No connection to server' }
      } else {
        console.error('[drift:sync] Request setup error:', error.message)
        return { error: error.message }
      }
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
