import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { StoryBlock, TimeBox, TimeBoxTask, Session, TimeBoxStatus } from '@/lib/types'
import { SessionStorageService } from '../services/session-storage.service'

// This is a minimal toast implementation since we don't have access to the actual toast component
// Replace with your actual toast implementation when available
const useToastFallback = () => {
  const toast = useCallback((props: {
    title: string;
    description: string;
    variant?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    console.log(`[Toast] ${props.title}: ${props.description}`);
    if (props.actionLabel && props.onAction && window.confirm(`${props.title}\n${props.description}\n\nDo you want to ${props.actionLabel}?`)) {
      props.onAction();
    }
  }, []);

  return { toast };
};

export interface UseSessionProps {
  id?: string
  storageService?: SessionStorageService
}

export interface UseSessionReturn {
  session: Session | null
  loading: boolean
  error: Error | null
  activeTimeBox: { storyId: string; timeBoxIndex: number } | null
  timeRemaining: number | null
  isTimerRunning: boolean
  isSessionComplete: boolean
  completedPercentage: number
  handleTaskClick: (storyId: string | undefined, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => void
  startTimeBox: (storyId: string, timeBoxIndex: number, duration: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  completeTimeBox: (storyId: string, timeBoxIndex: number) => void
  findNextWorkTimeBox: () => { storyId: string; timeBoxIndex: number } | null
  isCurrentTimeBox: (timeBox: TimeBox) => boolean
}

export const useSession = ({
  id,
  storageService = new SessionStorageService(),
}: UseSessionProps): UseSessionReturn => {
  const { toast } = useToastFallback()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  // Timer state
  const [activeTimeBox, setActiveTimeBox] = useState<{ storyId: string; timeBoxIndex: number } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  // Use ref instead of state for timer ID to prevent re-renders
  const timerIdRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate session progress
  const completedPercentage = useMemo(() => {
    if (!session) return 0
    
    const allWorkTimeBoxes = session.storyBlocks.flatMap(story => 
      story.timeBoxes
        .map((timeBox, index) => ({ timeBox, storyId: story.id, index }))
        .filter(item => item.timeBox.type === 'work')
    )
    
    const totalWorkBoxes = allWorkTimeBoxes.length
    const completedWorkBoxes = allWorkTimeBoxes.filter(item => item.timeBox.status === 'completed').length
    
    return totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
  }, [session])

  const isSessionComplete = useMemo(() => {
    return completedPercentage === 100
  }, [completedPercentage])

  // Update session in storage
  const updateSession = useCallback(async (updatedSession: Session): Promise<void> => {
    try {
      if (!updatedSession.date) return
      
      // Call the service to save the updated session
      await storageService.saveSession(updatedSession.date, updatedSession)
      setSession(updatedSession)
      
      // Refresh the page if needed
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update session'))
      toast({
        title: "Error",
        description: "Failed to update session",
        variant: "destructive",
      })
    }
  }, [storageService, router, toast])

  // Find the next available work timebox
  const findNextWorkTimeBox = useCallback(() => {
    if (!session) return null
    
    for (let i = 0; i < session.storyBlocks.length; i++) {
      const story = session.storyBlocks[i]
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const timeBox = story.timeBoxes[j]
        if (timeBox.type === 'work' && timeBox.status === 'todo') {
          return { storyId: story.id, timeBoxIndex: j }
        }
      }
    }
    
    return null
  }, [session])

  // Helper to calculate story progress
  const calculateStoryProgress = (story: StoryBlock): number => {
    const workTimeBoxes = story.timeBoxes.filter(tb => tb.type === 'work')
    if (workTimeBoxes.length === 0) return 0
    
    const completedTimeBoxes = workTimeBoxes.filter(tb => tb.status === 'completed')
    return Math.round((completedTimeBoxes.length / workTimeBoxes.length) * 100)
  }

  // Helper to find an in-progress timebox
  const findInProgressTimeBox = (currentSession: Session) => {
    for (let i = 0; i < currentSession.storyBlocks.length; i++) {
      const story = currentSession.storyBlocks[i]
      for (let j = 0; j < story.timeBoxes.length; j++) {
        if (story.timeBoxes[j].status === 'in-progress') {
          return { storyId: story.id, timeBoxIndex: j }
        }
      }
    }
    return null
  }

  // Complete a timebox
  const completeTimeBox = useCallback((storyId: string, timeBoxIndex: number) => {
    if (!session) return
    
    // Stop the timer if it's running
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    const updatedSession = { ...session }
    const storyIndex = updatedSession.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with ID ${storyId} not found`)
      return
    }
    
    // Mark all tasks as completed
    const tasks = updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].tasks
    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        task.status = 'completed'
      })
    }
    
    // Set the timebox to completed
    updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'completed'
    
    // Reset timer state if this was the active timebox
    if (activeTimeBox?.storyId === storyId && activeTimeBox?.timeBoxIndex === timeBoxIndex) {
      setActiveTimeBox(null)
      setTimeRemaining(null)
      setIsTimerRunning(false)
    }
    
    // Update story progress
    updatedSession.storyBlocks[storyIndex].progress = calculateStoryProgress(updatedSession.storyBlocks[storyIndex])
    
    // Update session in storage
    updateSession(updatedSession)
    
    // Call the API to update the timebox status
    storageService.updateTimeBoxStatus(
      session.date,
      storyId,
      timeBoxIndex,
      'completed' as TimeBoxStatus
    )
    
    // Find next timebox to suggest
    const nextTimeBox = findNextWorkTimeBox()
    if (nextTimeBox) {
      toast({
        title: "Timebox Completed",
        description: "Would you like to start the next timebox?",
        actionLabel: "Start Next",
        onAction: () => {
          const nextStoryIndex = updatedSession.storyBlocks.findIndex(story => story.id === nextTimeBox.storyId)
          if (nextStoryIndex !== -1) {
            const duration = updatedSession.storyBlocks[nextStoryIndex].timeBoxes[nextTimeBox.timeBoxIndex].duration
            startTimeBox(nextTimeBox.storyId, nextTimeBox.timeBoxIndex, duration)
          }
        }
      })
    } else {
      toast({
        title: "Timebox Completed",
        description: "All timeboxes have been completed!",
      })
    }
  }, [session, activeTimeBox, updateSession, findNextWorkTimeBox, storageService, toast])

  // Start a timebox
  const startTimeBox = useCallback((storyId: string, timeBoxIndex: number, duration: number) => {
    if (!session) return
    
    // Clear any existing timers
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    const updatedSession = { ...session }
    const storyIndex = updatedSession.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with ID ${storyId} not found`)
      return
    }
    
    // Reset any previously in-progress timeboxes
    updatedSession.storyBlocks.forEach(story => {
      story.timeBoxes.forEach(tb => {
        if (tb.status === 'in-progress') {
          tb.status = 'todo'
        }
      })
    })
    
    // Set the selected timebox to in-progress
    updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'in-progress'
    
    // Set timer state
    setActiveTimeBox({ storyId, timeBoxIndex })
    setTimeRemaining(duration * 60) // Convert minutes to seconds
    setIsTimerRunning(true)
    
    // Update session in storage
    updateSession(updatedSession)
    
    // Call the API to update the timebox status
    storageService.updateTimeBoxStatus(
      session.date,
      storyId,
      timeBoxIndex,
      'in-progress' as TimeBoxStatus
    )
    
    toast({
      title: "Timebox Started",
      description: `Timer set for ${duration} minutes`,
    })
  }, [session, updateSession, toast, storageService])

  // Handle task click
  const handleTaskClick = useCallback((storyId: string | undefined, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => {
    if (!session || !storyId) {
      console.error("Cannot toggle task status: session or storyId is undefined")
      return
    }

    const updatedSession = { ...session }
    const storyIndex = updatedSession.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with ID ${storyId} not found`)
      return
    }

    // Validate that the timeBox and its tasks array exist
    const timeBox = updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex]
    if (!timeBox || !timeBox.tasks) {
      console.error(`TimeBox or tasks array not found at index ${timeBoxIndex}`)
      return
    }

    // Toggle task status
    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    timeBox.tasks[taskIndex].status = newStatus
    
    // Check if all tasks are completed in this timebox
    const allTasksCompleted = timeBox.tasks.every(t => t.status === 'completed')
    
    // Auto-complete timebox if all tasks are completed
    if (allTasksCompleted) {
      updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'completed'
      
      // If this is the active timebox, reset timer state
      if (activeTimeBox?.storyId === storyId && activeTimeBox?.timeBoxIndex === timeBoxIndex) {
        setActiveTimeBox(null)
        setTimeRemaining(null)
        setIsTimerRunning(false)
        if (timerIdRef.current) clearInterval(timerIdRef.current)
      }
      
      // Update story progress
      updatedSession.storyBlocks[storyIndex].progress = calculateStoryProgress(updatedSession.storyBlocks[storyIndex])
    }
    
    // Update session in storage
    updateSession(updatedSession)
    
    // Call server-side action to update task status
    storageService.updateTaskStatus(
      session.date,
        storyId,
        timeBoxIndex,
        taskIndex,
        newStatus
      )
  }, [session, activeTimeBox, updateSession, storageService])

  // Pause the timer
  const pauseTimer = useCallback(() => {
    if (!isTimerRunning || !session || !activeTimeBox || timeRemaining === null) return
    
    setIsTimerRunning(false)
    
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    // Persist the paused timer state
    if (session.date) {
      storageService.saveTimerState(
        session.date,
        activeTimeBox,
        timeRemaining,
        false
      )
    }
    
    toast({
      title: "Timer Paused",
      description: "You can resume the timer when ready",
    })
  }, [session, activeTimeBox, isTimerRunning, timeRemaining, toast, storageService])

  // Resume the timer
  const resumeTimer = useCallback(() => {
    if (isTimerRunning || !activeTimeBox || timeRemaining === null || timeRemaining <= 0) return
    
    setIsTimerRunning(true)
    
    // Persist the resumed timer state
    if (session?.date) {
      storageService.saveTimerState(
        session.date,
        activeTimeBox,
        timeRemaining,
        true
      )
    }
    
    toast({
      title: "Timer Resumed",
      description: `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')} remaining`,
    })
  }, [activeTimeBox, isTimerRunning, timeRemaining, toast, session, storageService])

  // Reset the timer
  const resetTimer = useCallback(() => {
    if (!session || !activeTimeBox) return
    
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    const storyIndex = session.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId)
    
    if (storyIndex !== -1) {
      const duration = session.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex].duration
      const newTimeRemaining = duration * 60
      setTimeRemaining(newTimeRemaining)
      setIsTimerRunning(false)
      
      // Persist the reset timer state
      if (session.date) {
        storageService.saveTimerState(
          session.date,
          activeTimeBox,
          newTimeRemaining,
          false
        )
      }
      
      toast({
        title: "Timer Reset",
        description: `Timer reset to ${duration} minutes`,
      })
    }
  }, [session, activeTimeBox, toast, storageService])

  // Check if a timebox is the current active one
  const isCurrentTimeBox = useCallback((timeBox: TimeBox) => {
    if (!activeTimeBox || !session) return false
    
    const storyIndex = session.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId)
    if (storyIndex === -1) return false
    
    const activeBox = session.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex]
    
    // Compare objects to see if they're the same instance
    return activeBox === timeBox
  }, [activeTimeBox, session])

  // Timer effect
  useEffect(() => {
    // Clean up any existing timer before setting a new one
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    if (isTimerRunning && timeRemaining !== null && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            if (timerIdRef.current) {
              clearInterval(timerIdRef.current)
              timerIdRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      // Store the timer ID in the ref, not state
      timerIdRef.current = timer
      
      return () => {
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current)
          timerIdRef.current = null
        }
      }
    } else if (timeRemaining === 0 && isTimerRunning) {
      // Timer finished - only run this once when it hits zero
      setIsTimerRunning(false)
      
      if (activeTimeBox) {
        // Alert user that time is up
        toast({
          title: "Time's up!",
          description: "The current timebox has ended. Would you like to mark it as complete?",
          variant: "default",
          actionLabel: "Complete",
          onAction: () => {
            if (activeTimeBox) {
              completeTimeBox(activeTimeBox.storyId, activeTimeBox.timeBoxIndex)
            }
          }
        })
      }
    }
  }, [isTimerRunning, timeRemaining, activeTimeBox, toast, completeTimeBox])

  // Save timer state when it changes
  useEffect(() => {
    if (session?.date && (activeTimeBox !== null || timeRemaining !== null || isTimerRunning)) {
      storageService.saveTimerState(
        session.date,
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      )
    }
  }, [session?.date, activeTimeBox, timeRemaining, isTimerRunning, storageService])

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      try {
        const loadedSession = await storageService.getSession(id)
        if (loadedSession) {
          setSession(loadedSession)
          
          // Load timer state from storage first
          const timerState = storageService.getTimerState(id)
          
          if (timerState && timerState.activeTimeBox) {
            // Use persisted timer state if available
            setActiveTimeBox(timerState.activeTimeBox)
            setTimeRemaining(timerState.timeRemaining)
            setIsTimerRunning(timerState.isTimerRunning)
          } else {
            // Fall back to finding in-progress timebox
            const inProgressTimeBox = findInProgressTimeBox(loadedSession)
            if (inProgressTimeBox) {
              setActiveTimeBox(inProgressTimeBox)
              // Set time remaining based on the stored remaining time or default to full duration
              const storyIndex = loadedSession.storyBlocks.findIndex(s => s.id === inProgressTimeBox.storyId)
              if (storyIndex !== -1) {
                const timeBox = loadedSession.storyBlocks[storyIndex].timeBoxes[inProgressTimeBox.timeBoxIndex]
                setTimeRemaining((timeBox as any).remainingTime || timeBox.duration * 60)
              }
            }
          }
        }
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load session'))
        setLoading(false)
      }
    }

    loadSession()
  }, [id, storageService])

  // Persist timer state when user leaves the page
  useEffect(() => {
    // Function to run before page unload
    const handleBeforeUnload = () => {
      // Save current timer state if session exists
      if (session?.date) {
        // Calculate the exact remaining time for accurate persistence
        let exactTimeRemaining = timeRemaining
        
        // If timer is running, adjust the time for accuracy
        if (isTimerRunning && timerIdRef.current) {
          // We can't depend on exact calculations during unload, so we just save what we know
          storageService.saveTimerState(
            session.date,
            activeTimeBox,
            exactTimeRemaining,
            isTimerRunning
          )
        }
      }
    }

    // Add event listener for when the page is about to be unloaded
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Add event listener for when user navigates within the app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && session?.date) {
        storageService.saveTimerState(
          session.date,
          activeTimeBox,
          timeRemaining,
          isTimerRunning
        )
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Also save timer state on component unmount
      if (session?.date) {
        storageService.saveTimerState(
          session.date,
          activeTimeBox,
          timeRemaining,
          isTimerRunning
        )
      }
    }
  }, [session, activeTimeBox, timeRemaining, isTimerRunning, storageService])

  return {
    session,
    loading,
    error,
    activeTimeBox,
    timeRemaining,
    isTimerRunning,
    isSessionComplete,
    completedPercentage,
    handleTaskClick,
    startTimeBox,
    pauseTimer,
    resumeTimer,
    resetTimer,
    completeTimeBox,
    findNextWorkTimeBox,
    isCurrentTimeBox
  }
} 