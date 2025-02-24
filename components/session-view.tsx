"use client"

import { useState, useEffect } from "react"
import { format, parseISO, addMinutes, formatDistanceToNow } from "date-fns"
import { 
  Play, 
  Clock, 
  Fish, 
  BarChart, 
  Brain, 
  Timer,
  AlertCircle,
  CheckCircle,
  Pause,
  FastForward
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TimeboxView } from "./timebox-view"
import { TaskActionModal } from "./task-action-modal"
import type { Session, SessionPlan, StoryBlock, TimeBox } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SessionViewProps {
  date: string
}

interface SessionMetrics {
  totalTasks: number
  totalFrogs: number
  totalDuration: number
  workDuration: number
  breakDuration: number
  averageWorkBlock: number
  longestWorkBlock: number
  totalBreaks: number
}

interface SessionStatus {
  isActive: boolean
  isPaused: boolean
  currentTimeBox?: TimeBox
  currentTaskIndex: number
  elapsedTime: number
  remainingTime: number
  startTime?: string
  pausedAt?: string
  totalPausedTime: number
  estimatedEndTime?: string
}

export function SessionView({ date }: SessionViewProps) {
  const [sessionPlan, setSessionPlan] = useState<SessionPlan>()
  const [session, setSession] = useState<Session>()
  const [metrics, setMetrics] = useState<SessionMetrics>()
  const [status, setStatus] = useState<SessionStatus>({
    isActive: false,
    isPaused: false,
    currentTaskIndex: 0,
    elapsedTime: 0,
    remainingTime: 0,
    totalPausedTime: 0
  })
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<string>()
  const [actionProgress, setActionProgress] = useState(0)

  // Load session and calculate block start times
  useEffect(() => {
    const storedSession = localStorage.getItem(`session-${date}`)
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession)
        
        // Calculate estimated start/end times for each block
        let currentTime = new Date(parsedSession.startTime || new Date())
        parsedSession.storyBlocks.forEach((block: StoryBlock) => {
          block.timeBoxes.forEach((box: TimeBox) => {
            box.estimatedStartTime = currentTime.toISOString()
            currentTime = addMinutes(currentTime, box.duration)
            box.estimatedEndTime = currentTime.toISOString()
          })
        })

        setSession({
          summary: {
            totalSessions: parsedSession.storyBlocks.length,
            startTime: parsedSession.startTime || new Date().toISOString(),
            endTime: parsedSession.endTime || currentTime.toISOString(),
            totalDuration: parsedSession.totalDuration
          },
          storyBlocks: parsedSession.storyBlocks,
          date,
          status: parsedSession.status || "planned"
        })
        setSessionPlan(parsedSession)
        calculateMetrics(parsedSession.storyBlocks)

        // Restore session state if it was active
        if (parsedSession.status === "active") {
          const savedStatus = localStorage.getItem(`session-status-${date}`)
          if (savedStatus) {
            const parsedStatus = JSON.parse(savedStatus)
            setStatus(parsedStatus)
          }
        }
      } catch (error) {
        console.error("Failed to parse session data:", error)
      }
    }
  }, [date])

  // Save session status when it changes
  useEffect(() => {
    if (status.isActive || status.isPaused) {
      localStorage.setItem(`session-status-${date}`, JSON.stringify(status))
    }
  }, [status, date])

  useEffect(() => {
    let timer: NodeJS.Timeout
    
    if (status.isActive && !status.isPaused && status.currentTimeBox) {
      timer = setInterval(() => {
        setStatus(prev => {
          const newElapsedTime = prev.elapsedTime + 1
          const newRemainingTime = Math.max(0, prev.remainingTime - 1)

          // If time box is complete
          if (newRemainingTime === 0) {
            // Find next time box
            let nextTimeBox: TimeBox | undefined
            let nextTaskIndex = prev.currentTaskIndex

            if (sessionPlan) {
              // Flatten all time boxes from all story blocks
              const allTimeBoxes = sessionPlan.storyBlocks.flatMap(block => block.timeBoxes)
              
              // Find next time box if not at the end
              if (prev.currentTaskIndex < allTimeBoxes.length - 1) {
                nextTaskIndex = prev.currentTaskIndex + 1
                nextTimeBox = allTimeBoxes[nextTaskIndex]
              }
            }

            // If there's a next time box, transition to it
            if (nextTimeBox) {
              return {
                ...prev,
                currentTimeBox: nextTimeBox,
                currentTaskIndex: nextTaskIndex,
                elapsedTime: 0,
                remainingTime: nextTimeBox.duration * 60,
                estimatedEndTime: nextTimeBox.estimatedEndTime
              }
            }
            
            // Otherwise, end the session
            return {
              ...prev,
              isActive: false,
              isPaused: false,
              currentTimeBox: undefined,
              elapsedTime: 0,
              remainingTime: 0
            }
          }

          // Continue current time box
          return {
            ...prev,
            elapsedTime: newElapsedTime,
            remainingTime: newRemainingTime
          }
        })
      }, 1000)
    }

    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [status.isActive, status.isPaused, sessionPlan])

  const calculateMetrics = (storyBlocks: StoryBlock[]) => {
    let totalTasks = 0
    let totalFrogs = 0
    let workDuration = 0
    let breakDuration = 0
    let workBlocks = 0
    let longestBlock = 0

    storyBlocks.forEach(block => {
      block.timeBoxes.forEach(box => {
        if (box.type === 'work') {
          workDuration += box.duration
          workBlocks++
          longestBlock = Math.max(longestBlock, box.duration)
          if (box.tasks) {
            totalTasks += box.tasks.length
            totalFrogs += box.tasks.filter(t => t.title.includes('FROG')).length
          }
        } else {
          breakDuration += box.duration
        }
      })
    })

    setMetrics({
      totalTasks,
      totalFrogs,
      totalDuration: workDuration + breakDuration,
      workDuration,
      breakDuration,
      averageWorkBlock: workBlocks > 0 ? Math.round(workDuration / workBlocks) : 0,
      longestWorkBlock: longestBlock,
      totalBreaks: Math.max(0, workBlocks - 1)
    })
  }

  const startSession = () => {
    if (!sessionPlan) return

    const startTime = new Date().toISOString()
    const firstTimeBox = sessionPlan.storyBlocks[0].timeBoxes[0]

    setStatus({
      isActive: true,
      isPaused: false,
      currentTimeBox: firstTimeBox,
      currentTaskIndex: 0,
      elapsedTime: 0,
      remainingTime: firstTimeBox.duration * 60,
      startTime,
      totalPausedTime: 0,
      estimatedEndTime: firstTimeBox.estimatedEndTime
    })

    // Update session in localStorage
    const updatedSession = {
      ...sessionPlan,
      status: "active",
      startTime
    }
    localStorage.setItem(`session-${date}`, JSON.stringify(updatedSession))
  }

  const handlePauseResume = () => {
    setStatus(prev => {
      if (prev.isPaused) {
        // Resuming - update total paused time
        const pausedDuration = prev.pausedAt ? 
          Math.floor((Date.now() - new Date(prev.pausedAt).getTime()) / 1000) : 0
        
        return {
          ...prev,
          isActive: true,
          isPaused: false,
          pausedAt: undefined,
          totalPausedTime: prev.totalPausedTime + pausedDuration
        }
      } else {
        // Pausing
        return {
          ...prev,
          isActive: false,
          isPaused: true,
          pausedAt: new Date().toISOString()
        }
      }
    })
  }

  const handleExtendTime = (minutes: number) => {
    setStatus(prev => ({
      ...prev,
      remainingTime: Math.max(0, prev.remainingTime + (minutes * 60))
    }))
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const isCurrentTimeBox = (box: TimeBox) => {
    if (!status.currentTimeBox) return false
    return box.type === status.currentTimeBox.type && 
           box.duration === status.currentTimeBox.duration &&
           box.estimatedStartTime === status.currentTimeBox.estimatedStartTime &&
           box.estimatedEndTime === status.currentTimeBox.estimatedEndTime
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</h1>
          <p className="text-muted-foreground">Your focused work session for today</p>
        </div>
        
        {!status.isActive && !status.isPaused && (
          <Button onClick={startSession} size="lg" className="gap-2">
            <Play className="h-5 w-5" />
            Start Session
          </Button>
        )}
      </div>

      {(status.isActive || status.isPaused) && (
        <Alert className="animate-in fade-in-50 slide-in-from-top-1">
          <Timer className="h-4 w-4" />
          <AlertTitle>Session {status.isPaused ? 'Paused' : 'in Progress'}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                Current: {status.currentTimeBox?.tasks?.[0]?.title || 'Break'}
                <span className="ml-2 text-muted-foreground">
                  ({formatTime(status.remainingTime)})
                </span>
                {status.totalPausedTime > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    +{Math.floor(status.totalPausedTime / 60)}m paused
                  </span>
                )}
              </div>
              <Progress 
                value={(status.elapsedTime / (status.currentTimeBox?.duration || 1) * 60) * 100} 
                className={cn(
                  "w-[200px] transition-opacity duration-500",
                  status.isPaused ? "opacity-50" : "opacity-100"
                )} 
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border bg-muted/50 p-1 gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleExtendTime(-1)}
                  className="h-7 px-2"
                >
                  -1m
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleExtendTime(1)}
                  className="h-7 px-2"
                >
                  +1m
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleExtendTime(5)}
                  className="h-7 px-2"
                >
                  +5m
                </Button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePauseResume}
                className="gap-2"
              >
                {status.isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTasks}</div>
              <p className="text-xs text-muted-foreground">
                {formatDuration(metrics.workDuration)} of focused work
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Priority Tasks</CardTitle>
              <Fish className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalFrogs}</div>
              <p className="text-xs text-muted-foreground">
                {((metrics.totalFrogs / metrics.totalTasks) * 100).toFixed(0)}% of total tasks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Focus Blocks</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(metrics.averageWorkBlock)}</div>
              <p className="text-xs text-muted-foreground">
                Average work block ({metrics.totalBreaks} breaks)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(metrics.totalDuration)}</div>
              <p className="text-xs text-muted-foreground">
                {((metrics.workDuration / metrics.totalDuration) * 100).toFixed(0)}% focused work
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {sessionPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Session Timeline</CardTitle>
            <CardDescription>
              Your scheduled work blocks and breaks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <TimeboxView 
                storyBlocks={sessionPlan.storyBlocks} 
                currentTimeBox={status.currentTimeBox}
                isCurrentTimeBox={isCurrentTimeBox}
                isPaused={status.isPaused}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <TaskActionModal
        open={isActionModalOpen}
        onOpenChange={setIsActionModalOpen}
        currentAction={currentAction}
        progress={actionProgress}
      />
    </div>
  )
} 