import { BrowserWindow, ipcMain, screen, desktopCapturer, shell, app } from 'electron'
import { appState } from '@/lib/state/AppStateMachine'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'
import { createServer, Server } from 'http'
import { parse } from 'url'
import { promises as fs } from 'fs'
import { join } from 'path'

// Drift Backend API URL
const DRIFT_API_URL = 'https://34.185.148.16/api'
const AUTH_BASE_URL = 'https://34.185.148.16/auth/desktop'

interface IpcContext {
  shortcutsHelper: ShortcutsHelper
  createAppWindow: (invisible: boolean) => BrowserWindow
  getMainWindow: () => BrowserWindow | null
  setMainWindow: (win: BrowserWindow) => void
  getIsInvisible: () => boolean
  setIsInvisible: (val: boolean) => void
  setCurrentInputValue: (val: string) => void
}

// Auth callback server
let authServer: Server | null = null
const authFilePath = join(app.getPath('userData'), 'auth.json')

const readAuthFromDisk = async (): Promise<{ token: string | null; email: string | null }> => {
  try {
    const raw = await fs.readFile(authFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as { token?: string | null; email?: string | null }
    return { token: parsed.token || null, email: parsed.email || null }
  } catch {
    return { token: null, email: null }
  }
}

const writeAuthToDisk = async (token: string | null, email: string | null): Promise<void> => {
  const payload = JSON.stringify({ token, email })
  await fs.writeFile(authFilePath, payload, 'utf-8')
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

  ipcMain.on('quit-app', () => {
    import('electron').then(({ app }) => app.quit())
  })

  ipcMain.on('set-current-input-value', (_event, value: string) => {
    setCurrentInputValue(value)
  })

  ipcMain.on('input-changed', (_evt, value: string) => {
    setCurrentInputValue(value)
  })

  /* ---------------- Auth handlers with localhost callback ---------------- */
  ipcMain.on('open-auth-url', async (_evt) => {
    // Stop any existing server
    if (authServer) {
      authServer.close()
      authServer = null
    }

    // Create callback server
    authServer = createServer((req, res) => {
      const urlParts = parse(req.url || '', true)
      
      if (urlParts.pathname === '/callback') {
        const token = urlParts.query.token as string
        const email = urlParts.query.email as string
        
        if (token) {
          // Store the token
          const normalizedEmail = email || 'user@drift.app'
          ;(global as any).authToken = token
          ;(global as any).userEmail = normalizedEmail
          void writeAuthToDisk(token, normalizedEmail)
          
          // Send success response
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
          
          // Notify renderer
          broadcast('auth-token-received', { token, email: email || 'user@drift.app' })
          
          // Close server after a short delay
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

    // Listen on random available port
    authServer.listen(0, '127.0.0.1', () => {
      const address = authServer!.address()
      if (address && typeof address === 'object') {
        const port = address.port
        const callbackUrl = `http://localhost:${port}/callback`
        const authUrl = `${AUTH_BASE_URL}?callback=${encodeURIComponent(callbackUrl)}`
        
        console.log('[Auth] Starting callback server on port:', port)
        console.log('[Auth] Opening:', authUrl)
        
        shell.openExternal(authUrl)
      }
    })
  })

  ipcMain.handle('store-auth-token', async (_evt, token: string | null) => {
    ;(global as any).authToken = token
    if (!token) {
      ;(global as any).userEmail = null
      await writeAuthToDisk(null, null)
      return true
    }
    const email = (global as any).userEmail || null
    await writeAuthToDisk(token, email)
    return true
  })

  ipcMain.handle('get-auth-token', async () => {
    if ((global as any).authToken) return (global as any).authToken
    const { token, email } = await readAuthFromDisk()
    if (token) {
      ;(global as any).authToken = token
      ;(global as any).userEmail = email
    }
    return token
  })

  ipcMain.handle('get-user-email', async () => {
    if ((global as any).userEmail) return (global as any).userEmail
    const { token, email } = await readAuthFromDisk()
    if (token) {
      ;(global as any).authToken = token
      ;(global as any).userEmail = email
    }
    return email
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
      const authToken = (global as any).authToken
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
