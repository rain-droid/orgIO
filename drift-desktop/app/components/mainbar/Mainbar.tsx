import { X, Command, CornerDownLeft, Space, Circle, GripHorizontal } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import { useUIActor } from '../../state/UIStateProvider'
import { useSelector } from '@xstate/react'

type DockPosition = 'top' | 'bottom'

export const Mainbar = ({
  dockPosition,
  onDockChange,
}: {
  dockPosition: DockPosition
  onDockChange: (position: DockPosition) => void
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const dragStateRef = useRef<{
    startY: number
    startWinY: number
    winWidth: number
    winHeight: number
  } | null>(null)

  const uiActor = useUIActor()
  const { send } = uiActor

  const { chatActive } = useSelector(uiActor, (s) => ({
    chatActive: s.matches('chat')
  }))

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000)
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      setRecordingTime(0)
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  const handleChatClick = () => {
    send({ type: 'OPEN_CHAT' })
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${secs}`
  }

  const handleRecordClick = () => {
    setIsRecording(!isRecording)
    // TODO: Integrate with Drift backend for recording/work tracking
  }

  const containerClass = 'glass rounded-full font-sans flex-none w-full h-full pl-5 pr-5'
  const layoutClass = 'flex items-center justify-between w-full h-full'
  const sectionClass = 'flex items-center gap-2'

  const updateWindowPosition = useCallback(async (y: number) => {
    const bounds = await window.api.invoke('window-get-bounds')
    const x = Math.round((window.screen.availWidth - bounds.width) / 2)
    await window.api.invoke('window-set-position', { x, y: Math.round(y) })
  }, [])

  const handleDragMove = useCallback(async (e: MouseEvent) => {
    if (!dragStateRef.current) return
    const { startY, startWinY, winHeight } = dragStateRef.current
    const deltaY = e.screenY - startY
    const padding = 12
    const maxY = window.screen.availHeight - winHeight - padding
    const nextY = Math.min(Math.max(startWinY + deltaY, padding), maxY)
    await updateWindowPosition(nextY)
  }, [updateWindowPosition])

  const handleDragEnd = useCallback(async (e: MouseEvent) => {
    if (!dragStateRef.current) return
    const { winHeight } = dragStateRef.current
    const padding = 12
    const snapTop = e.screenY < window.screen.availHeight / 2
    const targetY = snapTop ? padding : window.screen.availHeight - winHeight - padding
    await updateWindowPosition(targetY)
    onDockChange(snapTop ? 'top' : 'bottom')
    dragStateRef.current = null
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
  }, [handleDragMove, onDockChange, updateWindowPosition])

  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    const bounds = await window.api.invoke('window-get-bounds')
    dragStateRef.current = {
      startY: e.screenY,
      startWinY: bounds.y,
      winWidth: bounds.width,
      winHeight: bounds.height,
    }
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }, [handleDragEnd, handleDragMove])

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [handleDragEnd, handleDragMove])

  return (
    <div className={containerClass}>
      <div className={layoutClass}>
        {/* Left - Chat button */}
        <div className={sectionClass}>
          <Button
            variant={chatActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={handleChatClick}
          >
            <span>Chat</span>
            <Command />
            <CornerDownLeft />
          </Button>
        </div>

        {/* Middle - Hide */}
        <div className={sectionClass}>
          <Button variant="ghost" size="sm">
            <span>Hide</span>
            <Command />
            <Space />
          </Button>
        </div>

        {/* Recording indicator */}
        <div className={sectionClass}>
          <Button
            variant={isRecording ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleRecordClick}
          >
            <span>{formatTime(recordingTime)}</span>
            <Circle
              className={isRecording ? 'animate-pulse text-red-500 fill-red-500' : ''}
              size={12}
            />
          </Button>
        </div>

        {/* Drag Handle (top/bottom snap) */}
        <div className={sectionClass}>
          <div
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleDragStart}
            title={`Drag to dock ${dockPosition === 'top' ? 'bottom' : 'top'}`}
          >
            <GripHorizontal className="size-5 text-gray-800/70 hover:text-gray-900 transition-colors" />
          </div>
        </div>

        {/* Quit button */}
        <div className={sectionClass}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.api.send('quit-app')}
            title="Quit App"
          >
            <X />
          </Button>
        </div>
      </div>
    </div>
  )
}
