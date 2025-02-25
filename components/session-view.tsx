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
import type { SessionPlan, StoryBlock, TimeBox, TimeBoxTask } from "@/lib/types"
import { sessionStorage, type StoredSession } from "@/lib/sessionStorage"
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
  const [sessionPlan, setSessionPlan] = useState<StoredSession>()
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
    const storedSession = sessionStorage.getSession(date)
    if (storedSession) {
      // Calculate estimated start/end times for each block
      let currentTime = new Date(storedSession.startTime || new Date())
      const updatedStoryBlocks = storedSession.storyBlocks.map(block => {
        const updatedTimeBoxes = block.timeBoxes.map(box => {
          const startTime = currentTime.toISOString();
          currentTime = addMinutes(currentTime, box.duration);
          const endTime = currentTime.toISOString();
          
          return {
            ...box,
            estimatedStartTime: box.estimatedStartTime || startTime,
            estimatedEndTime: box.estimatedEndTime || endTime
          };
        });
        
        return {
          ...block,
          timeBoxes: updatedTimeBoxes
        };
      });
      
      const updatedSession = {
        ...storedSession,
        storyBlocks: updatedStoryBlocks
      };
      
      setSessionPlan(updatedSession);
      
      // Check for active session status
      if (updatedSession.status === "in-progress") {
        // Find the current active time box
        let foundCurrentBox = false;
        
        for (const story of updatedSession.storyBlocks) {
          for (let i = 0; i < story.timeBoxes.length; i++) {
            const box = story.timeBoxes[i];
            if (box.status === "in-progress") {
              foundCurrentBox = true;
              setStatus({
                isActive: true,
                isPaused: false,
                currentTimeBox: box,
                currentTaskIndex: 0,
                elapsedTime: 0, // Will need to calculate from start time
                remainingTime: box.duration * 60,
                startTime: updatedSession.startTime,
                totalPausedTime: 0,
                estimatedEndTime: box.estimatedEndTime
              });
              break;
            }
          }
          if (foundCurrentBox) break;
        }
      }
      
      // Calculate metrics
      calculateMetrics(updatedStoryBlocks);
    }
  }, [date]);

  // Timer effect for active sessions
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (status.isActive && !status.isPaused && status.currentTimeBox) {
      timer = setInterval(() => {
        setStatus(prev => {
          // Update elapsed and remaining time
          const newElapsedTime = prev.elapsedTime + 1;
          const newRemainingTime = Math.max(0, (prev.currentTimeBox?.duration || 0) * 60 - newElapsedTime);
          
          // Check if time box is complete
          if (newRemainingTime <= 0 && sessionPlan) {
            // Handle timebox completion
            handleTimeBoxComplete();
            return prev; // handleTimeBoxComplete will update the status
          }
          
          return {
            ...prev,
            elapsedTime: newElapsedTime,
            remainingTime: newRemainingTime
          };
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status.isActive, status.isPaused, status.currentTimeBox, sessionPlan]);

  // Calculate session metrics
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
            totalFrogs += box.tasks.filter(t => t.isFrog).length
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

  // Start session
  const startSession = () => {
    if (!sessionPlan) return

    // Find the first work time box
    let firstStoryIndex = 0;
    let firstTimeBoxIndex = 0;
    let foundFirstBox = false;
    
    for (let i = 0; i < sessionPlan.storyBlocks.length; i++) {
      const story = sessionPlan.storyBlocks[i];
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const box = story.timeBoxes[j];
        if (box.type === 'work') {
          firstStoryIndex = i;
          firstTimeBoxIndex = j;
          foundFirstBox = true;
          break;
        }
      }
      if (foundFirstBox) break;
    }
    
    if (!foundFirstBox) return; // No work boxes found
    
    const firstTimeBox = sessionPlan.storyBlocks[firstStoryIndex].timeBoxes[firstTimeBoxIndex];
    const startTime = new Date().toISOString();

    // Update the status in the UI
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
    });

    // Update the status in storage - mark the first time box as in-progress
    sessionStorage.updateTimeBoxStatus(
      date, 
      sessionPlan.storyBlocks[firstStoryIndex].id, 
      firstTimeBoxIndex, 
      "in-progress"
    );
    
    // Update session in localStorage
    const updatedSession = {
      ...sessionPlan,
      status: "in-progress" as const,
      startTime
    };
    
    sessionStorage.saveSession(date, updatedSession);
    setSessionPlan(updatedSession);
  }

  // Handle timebox completion
  const handleTimeBoxComplete = () => {
    if (!sessionPlan || !status.currentTimeBox) return;
    
    // Find the current time box in the session
    let currentStoryIndex = -1;
    let currentTimeBoxIndex = -1;
    let foundCurrentBox = false;
    
    for (let i = 0; i < sessionPlan.storyBlocks.length; i++) {
      const story = sessionPlan.storyBlocks[i];
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const box = story.timeBoxes[j];
        if (isCurrentTimeBox(box)) {
          currentStoryIndex = i;
          currentTimeBoxIndex = j;
          foundCurrentBox = true;
          break;
        }
      }
      if (foundCurrentBox) break;
    }
    
    if (currentStoryIndex === -1 || currentTimeBoxIndex === -1) return;
    
    // Mark current time box as completed
    sessionStorage.updateTimeBoxStatus(
      date, 
      sessionPlan.storyBlocks[currentStoryIndex].id, 
      currentTimeBoxIndex, 
      "completed"
    );
    
    // Find the next time box to activate
    let nextStoryIndex = currentStoryIndex;
    let nextTimeBoxIndex = currentTimeBoxIndex + 1;
    
    // Check if we need to move to the next story
    if (nextTimeBoxIndex >= sessionPlan.storyBlocks[currentStoryIndex].timeBoxes.length) {
      nextStoryIndex++;
      nextTimeBoxIndex = 0;
    }
    
    // Check if we've reached the end of the session
    if (nextStoryIndex >= sessionPlan.storyBlocks.length) {
      // Session is complete
      const updatedSession = {
        ...sessionPlan,
        status: "completed" as const,
        endTime: new Date().toISOString()
      };
      
      sessionStorage.saveSession(date, updatedSession);
      setSessionPlan(updatedSession);
      
      setStatus({
        isActive: false,
        isPaused: false,
        currentTaskIndex: 0,
        elapsedTime: 0,
        remainingTime: 0,
        totalPausedTime: 0
      });
      
      return;
    }
    
    // Activate the next time box
    const nextTimeBox = sessionPlan.storyBlocks[nextStoryIndex].timeBoxes[nextTimeBoxIndex];
    
    sessionStorage.updateTimeBoxStatus(
      date, 
      sessionPlan.storyBlocks[nextStoryIndex].id, 
      nextTimeBoxIndex, 
      "in-progress"
    );
    
    // Refresh the session plan from storage to get the updated progress
    const refreshedSession = sessionStorage.getSession(date);
    if (refreshedSession) {
      setSessionPlan(refreshedSession);
      calculateMetrics(refreshedSession.storyBlocks);
    }
    
    // Update UI status
    setStatus({
      isActive: true,
      isPaused: false,
      currentTimeBox: nextTimeBox,
      currentTaskIndex: 0,
      elapsedTime: 0,
      remainingTime: nextTimeBox.duration * 60,
      startTime: status.startTime,
      totalPausedTime: status.totalPausedTime,
      estimatedEndTime: nextTimeBox.estimatedEndTime
    });
  }

  // Handle marking a task as completed
  const handleTaskComplete = (storyId: string, timeBoxIndex: number, taskIndex: number) => {
    if (!sessionPlan) return;
    
    sessionStorage.updateTaskStatus(
      date,
      storyId,
      timeBoxIndex,
      taskIndex,
      "completed"
    );
    
    // Refresh the session plan from storage
    const refreshedSession = sessionStorage.getSession(date);
    if (refreshedSession) {
      setSessionPlan(refreshedSession);
      calculateMetrics(refreshedSession.storyBlocks);
    }
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

  // Handle task click to mark as completed
  const handleTaskClick = (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => {
    // Toggle the task completion status
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    
    sessionStorage.updateTaskStatus(
      date,
      storyId,
      timeBoxIndex,
      taskIndex,
      newStatus
    );
    
    // Refresh the session plan from storage
    const refreshedSession = sessionStorage.getSession(date);
    if (refreshedSession) {
      setSessionPlan(refreshedSession);
      calculateMetrics(refreshedSession.storyBlocks);
    }
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

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Session Plan</CardTitle>
            <CardDescription>
              Your scheduled tasks and breaks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {sessionPlan ? (
                <TimeboxView 
                  storyBlocks={sessionPlan.storyBlocks}
                  currentTimeBox={status.currentTimeBox}
                  isCurrentTimeBox={isCurrentTimeBox}
                  isPaused={status.isPaused}
                  onTaskClick={handleTaskClick}
                />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  Loading session details...
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <TaskActionModal
        open={isActionModalOpen}
        onOpenChange={setIsActionModalOpen}
        currentAction={currentAction}
        progress={actionProgress}
      />
    </div>
  )
} 