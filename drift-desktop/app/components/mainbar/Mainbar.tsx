import { X, Command, CornerDownLeft, Space, Eye, EyeOff, Circle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { Button } from '../ui/button'
import { useUIActor } from '../../state/UIStateProvider'
import { useSelector } from '@xstate/react'

export const Mainbar = () => {
  const [isInvisible, setIsInvisible] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const uiActor = useUIActor()
  const { send } = uiActor

  const { chatActive } = useSelector(uiActor, (s) => ({
    chatActive: s.matches('chat')
  }))

  // Sync initial invisibility state from main process
  useEffect(() => {
    const updateState = (state: boolean) => setIsInvisible(state)
    window.api.invoke('get-invisibility-state').then(updateState).catch(() => {})
    window.api.receive('invisibility-state-changed', updateState)
    return () => window.api.removeAllListeners('invisibility-state-changed')
  }, [])

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

  const handleInvisibilityToggle = () => {
    setIsInvisible((prevState) => !prevState)
    window.api.send('toggle-invisibility')
  }

  return (
    <div className="pl-3 pr-3 glass rounded-[8px] font-sans flex-none w-[33.333vw] h-[40px] max-w-[33.333vw] max-h-[40px]">
      <div className="flex items-center justify-between w-full h-full">
        {/* Left - Record, Chat, Hide aligned together */}
        <div className="flex items-center gap-1 flex-1 justify-start">
          <Button
            variant={isRecording ? 'destructive' : 'ghost'}
            size="xs"
            onClick={handleRecordClick}
          >
            <Circle
              className={isRecording ? 'animate-pulse text-red-500 fill-red-500' : ''}
              size={12}
            />
            <span>{formatTime(recordingTime)}</span>
          </Button>
          <Button
            variant={chatActive ? 'secondary' : 'ghost'}
            size="xs"
            onClick={handleChatClick}
          >
            <span>Chat</span>
            <Command />
            <CornerDownLeft />
          </Button>
          <Button variant="ghost" size="xs">
            <span>Hide</span>
            <Command />
            <Space />
          </Button>
        </div>

        {/* Right - Invisibility Toggle and Quit */}
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleInvisibilityToggle}
            title={isInvisible ? 'Enable invisibility' : 'Disable invisibility'}
          >
            {isInvisible ? <Eye /> : <EyeOff />}
          </Button>
          <Button
            variant="ghost"
            size="xs"
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
