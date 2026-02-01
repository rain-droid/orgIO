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

// Role-specific relevant apps
const ROLE_RELEVANT_APPS: Record<string, string[]> = {
  dev: [
    // Code Editors
    'code', 'cursor', 'webstorm', 'intellij', 'pycharm', 'sublime', 'atom', 'notepad++', 'vim', 'nvim', 'neovim',
    // Terminals
    'terminal', 'iterm', 'powershell', 'cmd', 'windowsterminal', 'hyper', 'alacritty', 'warp',
    // Git
    'github', 'gitlab', 'sourcetree', 'gitkraken', 'fork',
    // Documentation (when coding related)
    'stackoverflow', 'developer.', 'docs.', 'mdn', 'npm', 'pypi',
    // Databases
    'datagrip', 'dbeaver', 'tableplus', 'mongodb', 'redis',
    // Docker
    'docker', 'kubernetes', 'lens',
    // API
    'postman', 'insomnia', 'httpie',
  ],
  pm: [
    // Project Management
    'jira', 'asana', 'trello', 'monday', 'notion', 'clickup', 'linear',
    // Documentation
    'confluence', 'google docs', 'google sheets', 'excel', 'word',
    // Communication
    'slack', 'teams', 'discord', 'zoom', 'meet',
    // Design Review
    'figma', 'miro',
  ],
  designer: [
    // Design Tools
    'figma', 'sketch', 'adobe xd', 'invision', 'framer',
    // Image Editing
    'photoshop', 'illustrator', 'affinity', 'gimp', 'inkscape',
    // Prototyping
    'principle', 'protopie', 'origami',
    // Asset Management
    'zeplin', 'abstract',
    // 3D
    'blender', 'cinema 4d', 'spline',
  ]
}

// Irrelevant apps/sites for ALL roles
const ALWAYS_IRRELEVANT = [
  'youtube', 'netflix', 'twitch', 'spotify', 'tiktok', 'instagram', 'facebook', 'twitter', 'x.com',
  'reddit', 'hacker news', '9gag', 'imgur',
  'steam', 'epic games', 'battle.net', 'origin',
  'whatsapp', 'telegram', 'signal', // personal messaging
]

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
    
    // First check if it's always irrelevant
    for (const irrelevant of ALWAYS_IRRELEVANT) {
      if (combined.includes(irrelevant)) {
        return false
      }
    }
    
    // Then check if it matches role-specific apps
    const relevantApps = ROLE_RELEVANT_APPS[this.role] || ROLE_RELEVANT_APPS.dev
    
    for (const relevant of relevantApps) {
      if (combined.includes(relevant.toLowerCase())) {
        return true
      }
    }
    
    // For browsers, check the title more carefully
    const browsers = ['chrome', 'firefox', 'safari', 'edge', 'arc', 'brave', 'opera']
    const isBrowser = browsers.some(b => appLower.includes(b))
    
    if (isBrowser) {
      // Only relevant if title contains something work-related
      return relevantApps.some(rel => titleLower.includes(rel.toLowerCase()))
    }
    
    // Default: consider file managers, unknown apps as somewhat relevant
    return false
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
      // Dynamic import to handle optional dependency
      const activeWin = await import('active-win').then(m => m.default || m).catch(() => null)
      
      if (activeWin) {
        const window = await activeWin()
        if (window) {
          return {
            app: window.owner?.name || 'Unknown',
            title: window.title || ''
          }
        }
      }
      
      // Fallback: try using PowerShell on Windows
      if (process.platform === 'win32') {
        return await this.getActiveWindowWindows()
      }
      
      // Fallback: try using AppleScript on macOS
      if (process.platform === 'darwin') {
        return await this.getActiveWindowMac()
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
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      const script = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
        $hwnd = [Win32]::GetForegroundWindow()
        $title = New-Object System.Text.StringBuilder 256
        [Win32]::GetWindowText($hwnd, $title, 256) | Out-Null
        $processId = 0
        [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        @{
          title = $title.ToString()
          app = if ($process) { $process.ProcessName } else { "Unknown" }
        } | ConvertTo-Json
      `
      
      const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`, {
        timeout: 2000
      })
      
      const result = JSON.parse(stdout.trim())
      return { app: result.app, title: result.title }
    } catch {
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
