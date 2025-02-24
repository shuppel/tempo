"use client"

import { useEffect, useState } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface TimerProps {
  duration: number
  isRunning: boolean
  onToggle: () => void
}

export function Timer({ duration, isRunning, onToggle }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration * 60)
  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1)
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, timeLeft])

  useEffect(() => {
    if (timeLeft === 0) {
      onToggle()
      // Play notification sound or show notification here
    }
  }, [timeLeft, onToggle])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onToggle} className="h-8 w-8">
        {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="w-[100px]">
        <div className="text-xs font-medium">{formatTime(timeLeft)}</div>
        <Progress value={progress} className="h-1" />
      </div>
    </div>
  )
}

