import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { registerIpcHandlers } from './ipc/router'
import { UIState, appState } from '../state/AppStateMachine'
import { ShortcutsHelper } from './shortcuts'
import { windowRegistry } from './windowRegistry'
import { join } from 'path'

function registerResourcesProtocol() {
  protocol.registerFileProtocol('resources', (request, callback) => {
    const url = request.url.replace(/^resources:\/\//, '')
    const absolutePath = join(__dirname, '..', '..', 'resources', url)
    callback({ path: absolutePath })
  })
}

/**
 * The main application class for Drift.
 * AI-Powered Sprint Planning Desktop App.
 */
export class DriftApp {
  // =========================================================================================
  // Properties
  // =========================================================================================

  // --- App State ---
  private isInvisible = false
  private currentInputValue = ''
  private apiRequestController: AbortController | null = null
  private t0: number

  // --- Windows ---
  private mainWindow!: BrowserWindow

  // --- Services ---
  private shortcutsHelper!: ShortcutsHelper

  // =========================================================================================
  // Lifecycle
  // =========================================================================================

  /**
   * Initializes the application by creating services and attaching app events.
   */
  constructor(t0: number) {
    this.t0 = t0
    this._attachAppEvents()
    app.disableHardwareAcceleration()
  }

  /**
   * Attaches the core Electron app lifecycle events.
   */
  private _attachAppEvents(): void {
    app.whenReady().then(() => this._onReady())

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createAppWindow(this.isInvisible, this.t0)
      }
    })
  }

  /**
   * Runs when the Electron app is ready. Initializes windows, services, and handlers.
   */
  private _onReady(): void {
    electronApp.setAppUserModelId('com.drift.desktop')
    registerResourcesProtocol()

    // Create window and helper now that app is ready
    this.mainWindow = createAppWindow(this.isInvisible, this.t0)

    this.shortcutsHelper = new ShortcutsHelper(this.mainWindow)

    windowRegistry.setMainWindow(this.mainWindow)

    this._registerIpcHandlers()
    this._registerStateMachineHandlers()

    this.shortcutsHelper.registerGlobalShortcuts()
    ;(global as any).appState = appState

    this.mainWindow.webContents.on('did-finish-load', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('invisibility-state-changed', this.isInvisible)
      }
    })
  }

  // =========================================================================================
  // IPC and State Management
  // =========================================================================================

  /**
   * Registers all IPC handlers for the application.
   */
  private _registerIpcHandlers(): void {
    registerIpcHandlers({
      shortcutsHelper: this.shortcutsHelper,
      createAppWindow: (isInvisible: boolean) => createAppWindow(isInvisible, this.t0),
      getMainWindow: () => this.mainWindow,
      setMainWindow: (win: BrowserWindow) => {
        this.mainWindow = win
        windowRegistry.setMainWindow(win)
      },
      getIsInvisible: () => this.isInvisible,
      setIsInvisible: (val: boolean) => {
        this.isInvisible = val
      },
      setCurrentInputValue: (val: string) => {
        this.currentInputValue = val
      }
    })
  }

  /**
   * Registers the main state machine handler.
   */
  private _registerStateMachineHandlers(): void {
    appState.on('stateChange', async ({ prev, next }) => {
      // Cancel any API request if we are moving away from the Loading state
      if (prev === UIState.Loading && next !== UIState.Loading) {
        this.apiRequestController?.abort()
        this.apiRequestController = null
      }

      // Broadcast the state change to all windows
      windowRegistry.broadcast('state-changed', { prev, next })
    })
  }
}
