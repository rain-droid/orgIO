import { BrowserWindow, shell, app } from 'electron'

// Disable hardware acceleration to prevent flickering on some systems
app.disableHardwareAcceleration()

import { join } from 'path'
import { registerWindowIPC } from '@/lib/window/ipcEvents'
import appIcon from '@/resources/build/icon.png?asset'
import { performance } from 'node:perf_hooks';

export function createAppWindow(isInvisible = false, t0: number): BrowserWindow {

  const mainWindow = new BrowserWindow({
    fullscreen: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    focusable: true,
    icon: appIcon,
    title: 'Drift',
    resizable: false,
    backgroundColor: '#00000000',
  })
  
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)

  // Re-focus when window loses focus to keep it on top
  mainWindow.on('blur', () => {
    // Small delay to allow click events to process first
    setTimeout(() => {
      if (!mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    }, 100)
  })

  // Register IPC events for the main window.
  registerWindowIPC(mainWindow)

  mainWindow.on('ready-to-show', () => {
    console.log('[perf] ready-to-show', (performance.now() - t0).toFixed(1), 'ms');
    mainWindow.show()
    mainWindow.focus()
  })

  // Debug: log when window loses focus
  mainWindow.on('blur', () => {
    console.log('[debug] Window lost focus (blur event)')
  })

  mainWindow.on('hide', () => {
    console.log('[debug] Window hidden')
  })

  const lastTime = { value: t0 };
  mainWindow.webContents.on('did-start-loading', () => {
    const now = performance.now();
    console.log('[perf] did-start-loading', (now - t0).toFixed(1), 'ms', `(+${(now - lastTime.value).toFixed(1)} ms)`);
    lastTime.value = now;
  });
  mainWindow.webContents.on('dom-ready', () => {
    const now = performance.now();
    console.log('[perf] dom-ready', (now - t0).toFixed(1), 'ms', `(+${(now - lastTime.value).toFixed(1)} ms)`);
    lastTime.value = now;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    const now = performance.now();
    console.log('[perf] did-finish-load', (now - t0).toFixed(1), 'ms', `(+${(now - lastTime.value).toFixed(1)} ms)`);
    lastTime.value = now;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}