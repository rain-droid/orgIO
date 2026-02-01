declare module 'active-win' {
  interface ActiveWindow {
    title: string
    owner?: {
      name: string
      processId: number
      path?: string
    }
    platform: 'macos' | 'linux' | 'windows'
  }

  function activeWin(): Promise<ActiveWindow | undefined>
  export = activeWin
}
