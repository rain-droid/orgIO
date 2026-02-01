import { BrowserWindow, desktopCapturer, screen } from 'electron'

// Activity entry
export interface ActivityEntry {
  app: string
  title: string
  file?: string
  duration: number
  timestamp: number
  screenshot?: string // base64 encoded
  isRelevant: boolean
}

// Aggregated activity
export interface AggregatedActivity {
  app: string
  totalDuration: number
  files: string[]
  titles: string[]
}

// Manual note added by user
export interface ManualNote {
  text: string
  timestamp: number
}

// Apps that are ALWAYS relevant (work tools)

// Sites/apps that are NEVER relevant (distractions)
const ALWAYS_IRRELEVANT = [
  'youtube', 'netflix', 'twitch', 'spotify', 'tiktok', 'instagram', 'facebook', 'twitter', 'x.com',
  'reddit', 'hacker news', '9gag', 'imgur',
  'steam', 'epic games', 'battle.net', 'origin', 'riot',
  'whatsapp', 'telegram', 'signal',
  'tinder', 'bumble',
]

// Legacy - keep for backwards compatibility

// Known code editors and their title patterns
const CODE_EDITORS: Record<string, { pattern: RegExp; fileGroup: number }> = {
  'Code': { pattern: /^(.+?) [-–—] (.+?) [-–—] Visual Studio Code/, fileGroup: 1 },
  'Visual Studio Code': { pattern: /^(.+?) [-–—] (.+?) [-–—] Visual Studio Code/, fileGroup: 1 },
  'Cursor': { pattern: /^(.+?) [-–—] (.+?) [-–—] Cursor/, fileGroup: 1 },
  'WebStorm': { pattern: /^(.+?) [-–—] (.+)/, fileGroup: 1 },
  'IntelliJ': { pattern: /^(.+?) [-–—] (.+)/, fileGroup: 1 },
  'PyCharm': { pattern: /^(.+?) [-–—] (.+)/, fileGroup: 1 },
  'Sublime Text': { pattern: /^(.+?) [-–—] Sublime Text/, fileGroup: 1 },
  'Atom': { pattern: /^(.+?) [-–—] Atom/, fileGroup: 1 },
  'Notepad++': { pattern: /^(.+?) - Notepad\+\+/, fileGroup: 1 },
  'vim': { pattern: /^(.+?) - VIM/, fileGroup: 1 },
  'nvim': { pattern: /^(.+?) - NVIM/, fileGroup: 1 },
}

// Browser patterns for detecting what site
const BROWSER_PATTERNS: Record<string, RegExp> = {
  'Chrome': /^(.+?) - Google Chrome$/,
  'Firefox': /^(.+?) [-–—] Mozilla Firefox$/,
  'Safari': /^(.+?) [-–—] Safari$/,
  'Edge': /^(.+?) [-–—] Microsoft Edge$/,
  'Arc': /^(.+?)$/,
}

class ActivityTracker {
  private activities: ActivityEntry[] = []
  private currentActivity: { app: string; title: string; startTime: number; isRelevant: boolean } | null = null
  private intervalId: NodeJS.Timeout | null = null
  private isTracking = false
  private role: string = 'dev'
  private manualNotes: ManualNote[] = []
  private onActivityUpdate: ((activity: ActivityEntry) => void) | null = null
  private screenshotEnabled = true

  /**
   * Start tracking activities
   */
  start(role: string = 'dev', onUpdate?: (activity: ActivityEntry) => void): void {
    if (this.isTracking) return
    
    this.isTracking = true
    this.activities = []
    this.currentActivity = null
    this.manualNotes = []
    this.role = role
    this.onActivityUpdate = onUpdate || null
    
    console.log(`[ActivityTracker] Started tracking for role: ${role}`)
    
    // Check active window every 3 seconds
    this.intervalId = setInterval(() => this.captureActivity(), 3000)
    
    // Capture immediately
    this.captureActivity()
  }
  
  /**
   * Add a manual note
   */
  addNote(text: string): void {
    this.manualNotes.push({
      text,
      timestamp: Date.now()
    })
    console.log('[ActivityTracker] Added manual note:', text)
  }
  
  /**
   * Remove a manual note by text content
   */
  removeNote(text: string): void {
    const index = this.manualNotes.findIndex(n => n.text === text || n.text.includes(text))
    if (index !== -1) {
      this.manualNotes.splice(index, 1)
      console.log('[ActivityTracker] Removed manual note:', text)
    }
  }
  
  /**
   * Remove the last manual note
   */
  removeLastNote(): void {
    if (this.manualNotes.length > 0) {
      const removed = this.manualNotes.pop()
      console.log('[ActivityTracker] Removed last note:', removed?.text)
    }
  }
  
  /**
   * Get manual notes
   */
  getNotes(): ManualNote[] {
    return [...this.manualNotes]
  }
  
  /**
   * Check if an app/title is relevant for the current role
   */
  private isRelevantForRole(app: string, title: string): boolean {
    const appLower = app.toLowerCase()
    const titleLower = title.toLowerCase()
    const combined = `${appLower} ${titleLower}`
    
    // Check if it's a distraction (ALWAYS_IRRELEVANT)
    for (const irrelevant of ALWAYS_IRRELEVANT) {
      if (combined.includes(irrelevant.toLowerCase())) {
        return false
      }
    }
    
    // Everything else is relevant - we want to track work!
    // The AI will decide what's actually important from screenshots
    return true
  }
  
  /**
   * Capture screenshot of the active display
   */
  private async captureScreenshot(): Promise<string | undefined> {
    if (!this.screenshotEnabled) return undefined
    
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.floor(width / 2), height: Math.floor(height / 2) } // Half resolution for smaller file
      })
      
      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail
        // Convert to JPEG base64 for smaller size
        const jpegBuffer = thumbnail.toJPEG(60) // 60% quality
        return jpegBuffer.toString('base64')
      }
      
      return undefined
    } catch (error) {
      console.error('[ActivityTracker] Screenshot failed:', error)
      return undefined
    }
  }

  /**
   * Stop tracking and return aggregated activities
   */
  stop(): { activities: ActivityEntry[]; summary: AggregatedActivity[]; notes: ManualNote[] } {
    if (!this.isTracking) {
      return { activities: [], summary: [], notes: [] }
    }
    
    this.isTracking = false
    this.onActivityUpdate = null
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    // Finalize current activity
    if (this.currentActivity) {
      const duration = Math.floor((Date.now() - this.currentActivity.startTime) / 1000)
      if (duration > 0) {
        this.activities.push({
          app: this.currentActivity.app,
          title: this.currentActivity.title,
          file: this.extractFile(this.currentActivity.app, this.currentActivity.title),
          duration,
          timestamp: this.currentActivity.startTime,
          isRelevant: this.currentActivity.isRelevant
        })
      }
    }
    
    // Filter to only relevant activities
    const relevantActivities = this.activities.filter(a => a.isRelevant)
    
    console.log('[ActivityTracker] Stopped tracking, captured', this.activities.length, 'activities,', relevantActivities.length, 'relevant')
    
    const summary = this.aggregateActivities()
    return { activities: relevantActivities, summary, notes: this.manualNotes }
  }
  
  /**
   * Get current tracking status
   */
  getStatus(): { isTracking: boolean; role: string; activityCount: number; relevantCount: number } {
    const relevantCount = this.activities.filter(a => a.isRelevant).length
    return {
      isTracking: this.isTracking,
      role: this.role,
      activityCount: this.activities.length,
      relevantCount
    }
  }

  /**
   * Get current activities without stopping
   */
  getActivities(): ActivityEntry[] {
    return [...this.activities]
  }

  /**
   * Capture current active window
   */
  private async captureActivity(): Promise<void> {
    try {
      // Get active window info using Electron
      const focusedWindow = BrowserWindow.getFocusedWindow()
      
      // Use native module or fallback
      let activeApp = 'Unknown'
      let activeTitle = ''
      
      // Try to get active window from OS
      const activeWindow = await this.getActiveWindow()
      
      if (activeWindow) {
        activeApp = activeWindow.app
        activeTitle = activeWindow.title
      } else if (focusedWindow) {
        // Fallback: if our window is focused, mark as "Drift Desktop"
        activeApp = 'Drift Desktop'
        activeTitle = 'Drift Overlay'
      }
      
      const now = Date.now()
      const isRelevant = this.isRelevantForRole(activeApp, activeTitle)
      
      // Check if activity changed
      if (this.currentActivity) {
        const sameActivity = 
          this.currentActivity.app === activeApp && 
          this.currentActivity.title === activeTitle
        
        if (!sameActivity) {
          // Save previous activity
          const duration = Math.floor((now - this.currentActivity.startTime) / 1000)
          if (duration > 0) {
            const entry: ActivityEntry = {
              app: this.currentActivity.app,
              title: this.currentActivity.title,
              file: this.extractFile(this.currentActivity.app, this.currentActivity.title),
              duration,
              timestamp: this.currentActivity.startTime,
              isRelevant: this.currentActivity.isRelevant
            }
            this.activities.push(entry)
          }
          
          // Start new activity
          this.currentActivity = { app: activeApp, title: activeTitle, startTime: now, isRelevant }
        }
      } else {
        // First activity
        this.currentActivity = { app: activeApp, title: activeTitle, startTime: now, isRelevant }
      }
      
      // Take screenshot ONLY if activity is relevant
      let screenshot: string | undefined
      if (isRelevant) {
        screenshot = await this.captureScreenshot()
      }
      
      // Notify callback with current state
      if (this.onActivityUpdate && this.currentActivity) {
        const currentEntry: ActivityEntry = {
          app: activeApp,
          title: activeTitle,
          file: this.extractFile(activeApp, activeTitle),
          duration: Math.floor((now - this.currentActivity.startTime) / 1000),
          timestamp: this.currentActivity.startTime,
          screenshot,
          isRelevant
        }
        this.onActivityUpdate(currentEntry)
      }
      
    } catch (error) {
      console.error('[ActivityTracker] Error capturing activity:', error)
    }
  }

  /**
   * Get active window using platform-specific methods
   */
  private async getActiveWindow(): Promise<{ app: string; title: string } | null> {
    try {
      // Use platform-specific method directly (more reliable)
      if (process.platform === 'win32') {
        return await this.getActiveWindowWindows()
      }
      
      if (process.platform === 'darwin') {
        return await this.getActiveWindowMac()
      }
      
      // Linux/other: try active-win
      try {
        const activeWin = await import('active-win').then(m => m.default || m)
        if (activeWin) {
          const window = await activeWin()
          if (window) {
            return {
              app: window.owner?.name || 'Unknown',
              title: window.title || ''
            }
          }
        }
      } catch {
        // active-win not available
      }
      
      return null
    } catch {
      return null
    }
  }

  /**
   * Get active window on Windows using PowerShell
   */
  private async getActiveWindowWindows(): Promise<{ app: string; title: string } | null> {
    try {
      const { execSync } = await import('child_process')
      
      // Method 1: Get foreground window directly via user32.dll
      try {
        const script = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;using System.Text;public class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}' -Language CSharp;$h=[W]::GetForegroundWindow();$t=New-Object Text.StringBuilder 256;[void][W]::GetWindowText($h,$t,256);$i=0;[void][W]::GetWindowThreadProcessId($h,[ref]$i);$n=(Get-Process -Id $i -EA 0).ProcessName;Write-Output "$n|$($t.ToString())"`
        
        const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, {
          timeout: 2000,
          windowsHide: true,
          encoding: 'utf8'
        }).toString().trim()
        
        if (result && result.includes('|')) {
          const pipeIndex = result.indexOf('|')
          const app = result.substring(0, pipeIndex).trim()
          const title = result.substring(pipeIndex + 1).trim()
          
          if (app && app !== '' && app !== 'undefined') {
            console.log(`[ActivityTracker] Detected: ${app} - ${title.substring(0, 50)}`)
            return { app, title }
          }
        }
      } catch (e) {
        console.log('[ActivityTracker] Method 1 failed, trying fallback')
      }
      
      // Method 2: Simple fallback - get most active process
      try {
        const result = execSync(
          'powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Sort-Object CPU -Descending | Select-Object -First 1 | ForEach-Object { $_.ProcessName + \'|\' + $_.MainWindowTitle })"',
          { timeout: 1500, windowsHide: true, encoding: 'utf8' }
        ).toString().trim()
        
        if (result && result.includes('|')) {
          const [app, title] = result.split('|')
          if (app) {
            return { app, title: title || '' }
          }
        }
      } catch {
        // Final fallback failed
      }
      
      return null
    } catch (err) {
      console.error('[ActivityTracker] Windows detection error:', err)
      return null
    }
  }

  /**
   * Get active window on macOS using AppleScript
   */
  private async getActiveWindowMac(): Promise<{ app: string; title: string } | null> {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      const { stdout: appName } = await execAsync(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
        { timeout: 2000 }
      )
      
      const { stdout: windowTitle } = await execAsync(
        `osascript -e 'tell application "System Events" to get name of front window of first application process whose frontmost is true'`,
        { timeout: 2000 }
      ).catch(() => ({ stdout: '' }))
      
      return {
        app: appName.trim(),
        title: windowTitle.trim()
      }
    } catch {
      return null
    }
  }

  /**
   * Extract file name from window title based on app
   */
  private extractFile(app: string, title: string): string | undefined {
    // Check code editors
    for (const [editorName, config] of Object.entries(CODE_EDITORS)) {
      if (app.toLowerCase().includes(editorName.toLowerCase())) {
        const match = title.match(config.pattern)
        if (match && match[config.fileGroup]) {
          return match[config.fileGroup].trim()
        }
        // Fallback: just take first part before dash
        const parts = title.split(/[-–—]/)
        if (parts.length > 0) {
          return parts[0].trim()
        }
      }
    }
    
    // Check browsers
    for (const [browserName, pattern] of Object.entries(BROWSER_PATTERNS)) {
      if (app.toLowerCase().includes(browserName.toLowerCase())) {
        const match = title.match(pattern)
        if (match && match[1]) {
          return match[1].trim()
        }
      }
    }
    
    return undefined
  }

  /**
   * Aggregate activities by app
   */
  private aggregateActivities(): AggregatedActivity[] {
    const byApp: Record<string, AggregatedActivity> = {}
    
    for (const activity of this.activities) {
      if (!byApp[activity.app]) {
        byApp[activity.app] = {
          app: activity.app,
          totalDuration: 0,
          files: [],
          titles: []
        }
      }
      
      byApp[activity.app].totalDuration += activity.duration
      
      if (activity.file && !byApp[activity.app].files.includes(activity.file)) {
        byApp[activity.app].files.push(activity.file)
      }
      
      if (activity.title && !byApp[activity.app].titles.includes(activity.title)) {
        byApp[activity.app].titles.push(activity.title)
      }
    }
    
    // Sort by duration descending
    return Object.values(byApp).sort((a, b) => b.totalDuration - a.totalDuration)
  }
}

// Singleton instance
export const activityTracker = new ActivityTracker()
