import { BrowserWindow, shell, app } from 'electron'

// Disable hardware acceleration to prevent flickering on some systems
app.disableHardwareAcceleration()

import { join } from 'path'
import { registerWindowIPC } from '@/lib/window/ipcEvents'
import appIcon from '@/resources/build/icon.png?asset'
import { performance } from 'node:perf_hooks';

export function createAppWindow(isInvisible = false, t0: number): BrowserWindow {

  const mainWindow = new BrowserWindow({
    fullscreen: false,
    width: 900,
    height: 600,
    minWidth: 520,
    minHeight: 420,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false
    },
    show: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    focusable: true,
    icon: appIcon,
    titleBarStyle: 'hiddenInset',
    title: 'Drift',
    resizable: true,
    backgroundColor: '#0b0d10',
    backgroundMaterial: 'auto',
  })

  mainWindow.center()
  
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  if (!isInvisible) {
    // Prevent the window from appearing in most software screen captures (Windows).
    mainWindow.setContentProtection(true)
    if (process.platform === 'win32') {
      void import('@/lib/main/protectWindow')
        .then(({ applyWindowCaptureProtection }) => {
          applyWindowCaptureProtection(mainWindow)
        })
        .catch(() => {})
    }
  }

  // Register IPC events for the main window.
  registerWindowIPC(mainWindow)

  mainWindow.on('ready-to-show', () => {
    console.log('[perf] ready-to-show', (performance.now() - t0).toFixed(1), 'ms');
    mainWindow.show()
    mainWindow.focus()
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
