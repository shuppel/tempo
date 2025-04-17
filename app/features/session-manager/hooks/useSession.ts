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
  undoCompleteTimeBox: (storyId: string, timeBoxIndex: number) => void
  findNextWorkTimeBox: () => { storyId: string; timeBoxIndex: number } | null
  findNextTimeBox: () => { storyId: string; timeBoxIndex: number } | null
  isCurrentTimeBox: (timeBox: TimeBox) => boolean
  updateTimeRemaining: (newTime: number) => void
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
  const findNextTimeBox = useCallback(() => {
    if (!session) return null
    
    for (let i = 0; i < session.storyBlocks.length; i++) {
      const story = session.storyBlocks[i]
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const timeBox = story.timeBoxes[j]
        if (timeBox.status === 'todo') {
          return { storyId: story.id, timeBoxIndex: j }
        }
      }
    }
    
    return null
  }, [session])

  // For backward compatibility - finds only work timeboxes
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

  // Undo the completion of a timebox
  const undoCompleteTimeBox = useCallback((storyId: string, timeBoxIndex: number) => {
    if (!session) return
    
    const updatedSession = { ...session }
    const storyIndex = updatedSession.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with ID ${storyId} not found`)
      return
    }
    
    // Get the timebox
    const timeBox = updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex]
    
    // Only allow undoing completed timeboxes
    if (timeBox.status !== 'completed') {
      console.warn('Cannot undo a timebox that is not completed')
      return
    }
    
    // Revert timebox to todo status
    timeBox.status = 'todo'
    
    // Reset tasks to todo status (optional - you might want to keep their completion status)
    const tasks = timeBox.tasks
    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        task.status = 'todo'
      })
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
      'todo' as TimeBoxStatus
    )
    
    toast({
      title: "Timebox Reverted",
      description: "The timebox has been reverted to 'todo' status.",
    })
  }, [session, updateSession, storageService, toast])

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
    const timeBox = updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex]
    timeBox.status = 'completed'
    
    // Calculate and store actual duration if we have a start time
    if (timeBox.startTime) {
      const startTime = new Date(timeBox.startTime)
      const endTime = new Date()
      const rawActualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000) // in minutes
      
      // Use the exact elapsed time, even if it's 0
      timeBox.actualDuration = rawActualDuration; 
      
      console.log(`TimeBox completed - Type: ${timeBox.type}, ID: ${storyId}-${timeBoxIndex}`)
      console.log(`  Start Time: ${timeBox.startTime}`)
      console.log(`  End Time: ${endTime.toISOString()}`)
      console.log(`  Actual Duration: ${timeBox.actualDuration}min (planned: ${timeBox.duration}min)`)
      console.log(`  Time saved: ${timeBox.duration - timeBox.actualDuration}min`)
      
      // Save the actual duration to storage
      if (session.date) {
        storageService.saveActualDuration(
          session.date,
          storyId,
          timeBoxIndex,
          timeBox.actualDuration
        ).then(result => {
          if (!result) {
            console.error("Failed to save actual duration to storage");
          } else {
            console.log(`Successfully saved actual duration to storage: ${timeBox.actualDuration}min`);
          }
        });
      }
    } else {
      // Handle missing startTime by creating a synthetic one
      console.warn(`TimeBox has no startTime record! Type: ${timeBox.type}, ID: ${storyId}-${timeBoxIndex}`)
      
      // For synthetic cases, use a more conservative approach
      if (timeBox.type === 'work') {
        // For focus sessions, use a more realistic synthetic duration
        timeBox.actualDuration = Math.max(1, Math.floor(timeBox.duration * 0.8));
        
        console.log(`Using synthetic duration for focus session: ${timeBox.actualDuration}min (80% of planned ${timeBox.duration}min)`);
      } else {
        // For breaks, use something close to the planned duration
        const variation = -Math.floor(Math.random() * 2); // -0 to -1 minutes
        timeBox.actualDuration = Math.max(1, timeBox.duration + variation);
        
        console.log(`Using synthetic duration for break: ${timeBox.actualDuration}min (${variation}min from planned ${timeBox.duration}min)`);
      }
      
      // Set startTime based on actualDuration
      timeBox.startTime = new Date(new Date().getTime() - (timeBox.actualDuration * 60000)).toISOString();
      
      console.log(`  Synthetic Duration: ${timeBox.actualDuration}min (planned: ${timeBox.duration}min)`)
      console.log(`  Time saved: ${timeBox.duration - timeBox.actualDuration}min`)
      
      // Save the synthetic duration to storage
      if (session.date) {
        storageService.saveActualDuration(
          session.date,
          storyId,
          timeBoxIndex,
          timeBox.actualDuration
        ).then(result => {
          if (!result) {
            console.error("Failed to save synthetic duration to storage");
          } else {
            console.log(`Successfully saved synthetic duration to storage: ${timeBox.actualDuration}min`);
          }
        });
      }
    }
    
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
    const nextTimeBox = findNextTimeBox()
    if (nextTimeBox) {
      // Get the type of the next timebox for better user guidance
      const nextStoryIndex = updatedSession.storyBlocks.findIndex(story => story.id === nextTimeBox.storyId)
      if (nextStoryIndex !== -1) {
        const nextBoxType = updatedSession.storyBlocks[nextStoryIndex].timeBoxes[nextTimeBox.timeBoxIndex].type;
        const boxTypeLabel = nextBoxType === 'work' ? 'focus session' : 
                            (nextBoxType === 'short-break' || nextBoxType === 'long-break') ? 'break' : 
                            nextBoxType === 'debrief' ? 'debrief session' : 'next activity';
        
        toast({
          title: "Timebox Completed",
          description: `Your next ${boxTypeLabel} is ready to start. Check the highlighted button.`,
          actionLabel: "Go to Next",
          onAction: () => {
            // We don't auto-start the next task, just help the user find it
            // Scroll to the element might be implemented here if needed
          }
        })
      }
    } else {
      toast({
        title: "Timebox Completed",
        description: "All timeboxes have been completed!",
      })
    }
  }, [session, activeTimeBox, updateSession, findNextTimeBox, storageService, toast])

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
      // Handle the special case for session-debrief
      if (storyId === "session-debrief") {
        console.log(`Starting debrief timer for ${duration} minutes`);
        
        // Set timer state without attempting to update non-existent timeBox
        setActiveTimeBox({ storyId, timeBoxIndex })
        setTimeRemaining(duration * 60) // Convert minutes to seconds
        setIsTimerRunning(true)
        
        toast({
          title: "Debrief Started",
          description: `Timer set for ${duration} minutes to reflect on your session.`,
        })
        
        return
      }
      
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
    const timeBox = updatedSession.storyBlocks[storyIndex].timeBoxes[timeBoxIndex];
    timeBox.status = 'in-progress'
    
    // Record start time for actual duration tracking
    timeBox.startTime = new Date().toISOString()
    console.log(`Starting TimeBox - Type: ${timeBox.type}, ID: ${storyId}-${timeBoxIndex}, Start Time: ${timeBox.startTime}`)
    
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

    console.log("TASK UPDATE - Checking if task status changed in props:", task.status);

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

    // Get the current task
    const currentTask = timeBox.tasks[taskIndex];
    
    // Only proceed if the status has actually changed
    if (currentTask.status === task.status) {
      console.log("Task status unchanged, no update needed");
      return;
    }
    
    console.log("Updating task status from", currentTask.status, "to", task.status);
    
    // Update the task with the new status
    timeBox.tasks[taskIndex] = {
      ...timeBox.tasks[taskIndex],
      status: task.status
    };
    
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
      // Convert any status to either 'todo' or 'completed' for API compatibility
      (task.status === 'completed' ? 'completed' : 'todo') as 'todo' | 'completed'
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

  // Update time remaining - new function for time adjustment
  const updateTimeRemaining = useCallback((newTime: number) => {
    if (!activeTimeBox || !session) return;
    
    // Update the time remaining
    setTimeRemaining(newTime);
    
    // Persist the updated timer state
    if (session.date) {
      storageService.saveTimerState(
        session.date,
        activeTimeBox,
        newTime,
        isTimerRunning
      );
    }
    
    // Optionally notify the user
    const minutes = Math.floor(newTime / 60);
    const seconds = newTime % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    toast({
      title: "Timer Adjusted",
      description: `Time updated to ${formattedTime}`,
    });
  }, [activeTimeBox, session, isTimerRunning, storageService, toast]);

  // Check if a timebox is the current active one
  const isCurrentTimeBox = useCallback((timeBox: TimeBox) => {
    if (!activeTimeBox || !session) return false
    
    const storyIndex = session.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId)
    if (storyIndex === -1) return false
    
    const activeBox = session.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex]
    
    // Compare objects to see if they're the same instance
    return activeBox === timeBox
  }, [activeTimeBox, session])

  // Start timer interval for countdown
  const startTimerInterval = useCallback(() => {
    // Clear existing timer if any
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current)
    }
    
    // Create new timer
    timerIdRef.current = setInterval(() => {
      setTimeRemaining(prevTime => {
        if (prevTime === null || prevTime <= 0) {
          // Stop the timer if time is up
          if (timerIdRef.current) {
            clearInterval(timerIdRef.current)
            timerIdRef.current = null
          }
          setIsTimerRunning(false)
          return 0
        }
        return prevTime - 1
      })
    }, 1000)
  }, [])

  // Effect to handle starting/stopping timer based on isTimerRunning state
  useEffect(() => {
    if (isTimerRunning && timeRemaining !== null && timeRemaining > 0) {
      startTimerInterval()
    } else if (!isTimerRunning && timerIdRef.current) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    
    // Save timer state whenever it changes
    if (session && session.date && activeTimeBox) {
      storageService.saveTimerState(
        session.date,
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      )
    }
    
    // Cleanup timer on unmount
    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current)
        timerIdRef.current = null
      }
    }
  }, [isTimerRunning, timeRemaining, session, activeTimeBox, startTimerInterval, storageService])

  // Ensure startTime is set for the activeTimeBox whenever it changes
  useEffect(() => {
    if (!session || !activeTimeBox) return;
    
    const updatedSession = { ...session };
    const storyIndex = updatedSession.storyBlocks.findIndex(
      story => story.id === activeTimeBox.storyId
    );
    
    if (storyIndex === -1) return;
    
    const timeBox = updatedSession.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex];
    
    // Make sure startTime is set for all timeboxes when active
    if (timeBox && !timeBox.startTime && timeBox.status === 'in-progress') {
      console.log(`Setting missing startTime for active TimeBox - Type: ${timeBox.type}, ID: ${activeTimeBox.storyId}-${activeTimeBox.timeBoxIndex}`);
      timeBox.startTime = new Date().toISOString();
      updateSession(updatedSession);
    }
  }, [session, activeTimeBox, updateSession]);

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
    undoCompleteTimeBox,
    findNextWorkTimeBox,
    findNextTimeBox,
    isCurrentTimeBox,
    updateTimeRemaining
  }
} 