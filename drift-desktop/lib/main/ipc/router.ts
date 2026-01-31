import { BrowserWindow, ipcMain, screen, desktopCapturer, shell } from 'electron'
import { appState } from '@/lib/state/AppStateMachine'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'

// Drift Backend API URL
const DRIFT_API_URL = 'https://34.185.148.16/api'

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

  ipcMain.on('quit-app', () => {
    import('electron').then(({ app }) => app.quit())
  })

  ipcMain.on('set-current-input-value', (_event, value: string) => {
    setCurrentInputValue(value)
  })

  ipcMain.on('input-changed', (_evt, value: string) => {
    setCurrentInputValue(value)
  })

  /* ---------------- Auth handlers ---------------- */
  ipcMain.on('open-auth-url', (_evt, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('store-auth-token', async (_evt, token: string) => {
    // Store token securely (could use electron-store or keytar)
    ;(global as any).authToken = token
    return true
  })

  ipcMain.handle('get-auth-token', async () => {
    return (global as any).authToken || null
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
