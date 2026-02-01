import { globalShortcut, app, BrowserWindow } from 'electron'

export type ShortcutAction = 'toggleOverlay' | 'submitChat' | 'toggleSession' | 'toggleVoice' | 'escape'
export type ShortcutConfig = Record<ShortcutAction, string>

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  toggleOverlay: 'CommandOrControl+Space',
  submitChat: 'CommandOrControl+Enter',
  toggleSession: 'CommandOrControl+Alt+S',
  toggleVoice: 'CommandOrControl+Alt+V',
  escape: 'Escape'
}

/**
 * Handles registration of global keyboard shortcuts.
 * This class only dispatches events to the state machine and does not
 * perform any window manipulations directly.
 */
export class ShortcutsHelper {
  private mainWindow: BrowserWindow
  private shortcuts: ShortcutConfig = { ...DEFAULT_SHORTCUTS }
  private willQuitHandlerAttached = false

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  public updateMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  public getShortcuts(): ShortcutConfig {
    return { ...this.shortcuts }
  }

  public resetShortcuts(): { ok: boolean; failed: ShortcutAction[]; shortcuts: ShortcutConfig } {
    this.shortcuts = { ...DEFAULT_SHORTCUTS }
    const failed = this.reRegisterAll()
    return { ok: failed.length === 0, failed, shortcuts: { ...this.shortcuts } }
  }

  public setShortcuts(next: Partial<ShortcutConfig>): { ok: boolean; failed: ShortcutAction[]; shortcuts: ShortcutConfig } {
    const previous = { ...this.shortcuts }
    this.shortcuts = { ...this.shortcuts, ...next }
    const failed = this.reRegisterAll()

    if (failed.length > 0) {
      this.shortcuts = previous
      this.reRegisterAll()
      return { ok: false, failed, shortcuts: { ...this.shortcuts } }
    }

    return { ok: true, failed: [], shortcuts: { ...this.shortcuts } }
  }

  public registerGlobalShortcuts(): void {
    this.reRegisterAll()
    if (!this.willQuitHandlerAttached) {
      this.willQuitHandlerAttached = true
      // Unregister all on quit
      app.on('will-quit', () => {
        globalShortcut.unregisterAll();
      });
    }
  }

  private reRegisterAll(): ShortcutAction[] {
    globalShortcut.unregisterAll()
    const failed: ShortcutAction[] = []

    // Ctrl+Space always listens globally
    if (!globalShortcut.register(this.shortcuts.toggleOverlay, () => {
      const anyVisible =
        (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible());

      if (anyVisible) {
        this.mainWindow.hide();
        // Unregister other shortcuts
        this.unregisterWindowShortcuts();
      } else {
        this.mainWindow.show();
        // Register other shortcuts
        this.registerWindowShortcuts();
      }
    })) {
      failed.push('toggleOverlay')
    }

    // Initially register window-specific shortcuts
    failed.push(...this.registerWindowShortcuts());

    return failed
  }

  // Register shortcuts only when windows are visible
  private registerWindowShortcuts(): ShortcutAction[] {
    const failed: ShortcutAction[] = []

    // F12: toggle DevTools for debugging
    globalShortcut.register('F12', () => {
      this.mainWindow?.webContents.toggleDevTools()
    })

    // Enter: open or submit in chat
    if (!globalShortcut.register(this.shortcuts.submitChat, () => {
      this.mainWindow?.webContents.send('shortcut:ctrl-enter');
      if (this.mainWindow?.isVisible()) {
        this.mainWindow?.focus()
      }
    })) {
      failed.push('submitChat')
    }

    // Ctrl+Alt+S: toggle session
    if (!globalShortcut.register(this.shortcuts.toggleSession, () => {
      this.mainWindow?.webContents.send('shortcut:toggle-session');
    })) {
      failed.push('toggleSession')
    }

    // Ctrl+Alt+V: toggle voice
    if (!globalShortcut.register(this.shortcuts.toggleVoice, () => {
      this.mainWindow?.webContents.send('shortcut:toggle-voice');
    })) {
      failed.push('toggleVoice')
    }

    // Escape: send ESC to state machine
    if (!globalShortcut.register(this.shortcuts.escape, () => {
      this.mainWindow?.webContents.send('shortcut:esc');
    })) {
      failed.push('escape')
    }

    return failed
  }

  // Unregister window-specific shortcuts
  private unregisterWindowShortcuts(): void {
    globalShortcut.unregister(this.shortcuts.submitChat);
    globalShortcut.unregister(this.shortcuts.toggleSession);
    globalShortcut.unregister(this.shortcuts.toggleVoice);
    globalShortcut.unregister(this.shortcuts.escape);
    globalShortcut.unregister('F12');
  }
}
