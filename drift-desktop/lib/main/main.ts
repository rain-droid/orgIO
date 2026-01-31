import { app } from 'electron'
import { DriftApp } from './Drift'
import { performance } from 'node:perf_hooks'

const t0 = performance.now()
console.log('Starting Drift main process...')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require('electron-squirrel-startup')) {
  app.quit()
}

// Instantiate the app. This will handle all app lifecycle events.
new DriftApp(t0)

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
