/**
 * useWorkPlan Hook
 *
 * This hook manages the state and interactions for a workplan, including:
 *
 * - Loading and updating the workplan data from a persistent storage service.
 * - Managing timer state for the active timebox (start, pause, resume, reset).
 * - Calculating workplan progress and determining whether a workplan is complete.
 * - Handling task and timebox status updates (e.g., marking tasks as complete).
 * - Navigating the user to the next available timebox or activity.
 *
 * The hook integrates with a WorkPlanStorageService to persist workplan data,
 * and it uses a minimal toast fallback for user notifications. It also leverages
 * Next.js navigation for page refreshes and redirections.
 *
 * Consumers of this hook receive the workplan object, loading and error states,
 * timer state (active timebox, remaining time, and running status), and a suite of
 * action methods for managing workplan interactions.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { 
  StoryBlock, 
  TimeBox, 
  TimeBoxTask, 
  TodoWorkPlan, 
  TimerState,
  TaskCategory,
  TimeBoxStatus,
  BaseStatus
} from '@/lib/types'
import { WorkPlanStorageService } from '../services/workplan-storage.service'

// Minimal toast implementation as a fallback. Replace with your actual toast component when available.
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

export interface UseWorkPlanProps {
  id?: string
  storageService?: WorkPlanStorageService
}

export interface UseWorkPlanReturn {
  workplan: TodoWorkPlan | null
  loading: boolean
  error: Error | null
  activeTimeBox: { storyId: string; timeBoxIndex: number } | null
  timeRemaining: number | null
  isTimerRunning: boolean
  isWorkPlanComplete: boolean
  completedPercentage: number
  hasIncompleteTasks: boolean
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

export const useWorkPlan = ({
  id,
  storageService: injectedStorageService,
}: UseWorkPlanProps): UseWorkPlanReturn => {
  const router = useRouter()
  const { toast } = useToastFallback()
  const storageService = useMemo(() => injectedStorageService || new WorkPlanStorageService(), [injectedStorageService])

  // State
  const [workplan, setWorkPlan] = useState<TodoWorkPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [activeTimeBox, setActiveTimeBox] = useState<{ storyId: string; timeBoxIndex: number } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  // Timer interval ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Computed values
  const isWorkPlanComplete = useMemo(() => {
    if (!workplan) return false
    return workplan.status === 'completed'
  }, [workplan])

  const completedPercentage = useMemo(() => {
    if (!workplan?.storyBlocks?.length) return 0;
    
    const totalWorkBoxes = workplan.storyBlocks.reduce((sum, story) => 
      sum + (story.timeBoxes?.filter(box => box.type === 'work')?.length || 0), 0);
      
    const completedWorkBoxes = workplan.storyBlocks.reduce((sum, story) => 
      sum + (story.timeBoxes?.filter(box => box.type === 'work' && box.status === 'completed')?.length || 0), 0);
      
    return totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0;
  }, [workplan]);

  const hasIncompleteTasks = useMemo(() => {
    if (!workplan?.storyBlocks?.length) return false;
    
    return workplan.storyBlocks.some(story => 
      story.timeBoxes?.some(box => 
        box.type === 'work' && box.status !== 'completed'
      ) ?? false
    );
  }, [workplan]);

  // Timer management
  const saveTimerState = useCallback(async () => {
    if (!id || !workplan) return;

    try {
      // Ensure all required fields are present and properly typed
      const updatedWorkplan: TodoWorkPlan = {
        ...workplan,
        id: workplan.id,
        status: workplan.status || 'planned',
        startTime: workplan.startTime || new Date().toISOString(),
        endTime: workplan.endTime || new Date().toISOString(),
        totalDuration: workplan.totalDuration || 0,
        lastUpdated: new Date().toISOString(),
        activeTimeBox,
        timeRemaining,
        isTimerRunning,
        storyBlocks: (workplan.storyBlocks || []).map(block => {
          const timeBoxes = block.timeBoxes || [];
          return {
            ...block,
            id: block.id || `story-${Date.now()}`,
            title: block.title || 'Untitled Story',
            timeBoxes: timeBoxes.map(timeBox => ({
              ...timeBox,
              type: timeBox.type || 'work',
              duration: timeBox.duration || 25,
              status: timeBox.status || 'todo',
              tasks: (timeBox.tasks || []).map(task => ({
                ...task,
                title: task.title || 'Untitled Task',
                duration: task.duration || timeBox.duration || 25,
                status: task.status || 'todo'
              }))
            })),
            progress: typeof block.progress === 'number' ? block.progress : 0,
            totalDuration: timeBoxes.reduce((sum, box) => sum + (box.duration || 0), 0),
            taskIds: block.taskIds || timeBoxes.flatMap(box => (box.tasks || []).map(task => task.title))
          };
        })
      };
      
      await storageService.saveWorkPlan(updatedWorkplan);
    } catch (error) {
      console.error('[useWorkPlan] Error saving timer state:', error)
      toast({
        title: 'Error',
        description: 'Failed to save timer state. Please try again.',
        variant: 'destructive'
      })
    }
  }, [id, workplan, activeTimeBox, timeRemaining, isTimerRunning, storageService, toast])

  // Load workplan data
  const loadWorkPlan = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const loadedWorkPlan = await storageService.getWorkPlan(id)
      
      if (!loadedWorkPlan) {
        setError(new Error('WorkPlan not found'))
        return
      }

      setWorkPlan(loadedWorkPlan)
      
      // Restore timer state if it exists
      if (loadedWorkPlan.activeTimeBox !== null) {
        setActiveTimeBox(loadedWorkPlan.activeTimeBox);
        setTimeRemaining(loadedWorkPlan.timeRemaining);
        setIsTimerRunning(loadedWorkPlan.isTimerRunning);
      }
      
      setError(null)
    } catch (error) {
      console.error('[useWorkPlan] Error loading workplan:', error)
      setError(error instanceof Error ? error : new Error('Failed to load workplan'))
    } finally {
      setLoading(false)
    }
  }, [id, storageService])

  // Timer interval cleanup
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Load workplan on mount and id change
  useEffect(() => {
    loadWorkPlan()
  }, [loadWorkPlan])

  // Save timer state when it changes
  useEffect(() => {
    saveTimerState()
  }, [saveTimerState])

  // Helper functions
  const calculateStoryProgress = useCallback((story: StoryBlock): number => {
    const workBoxes = story.timeBoxes.filter(box => box.type === 'work')
    const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
    return workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
  }, [])

  const findInProgressTimeBox = useCallback((currentWorkPlan: TodoWorkPlan) => {
    for (const story of currentWorkPlan.storyBlocks) {
      const timeBoxIndex = story.timeBoxes.findIndex(box => box.status === 'in-progress')
      if (timeBoxIndex !== -1) {
        return { storyId: story.id, timeBoxIndex }
      }
    }
    return null
  }, [])

  // Find the next available timebox (regardless of type) that is marked as 'todo'.
  const findNextTimeBox = useCallback(() => {
    if (!workplan) return null
    
    for (let i = 0; i < workplan.storyBlocks.length; i++) {
      const story = workplan.storyBlocks[i]
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const timeBox = story.timeBoxes[j]
        if (timeBox.status === 'todo') {
          return { storyId: story.id, timeBoxIndex: j }
        }
      }
    }
    
    return null
  }, [workplan])

  // Start a timebox: update status, initialize timer, and notify user.
  const startTimeBox = useCallback((storyId: string, timeBoxIndex: number, duration: number) => {
    if (!workplan) return
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    const updatedWorkPlan = { ...workplan }
    const storyIndex = updatedWorkPlan.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with id ${storyId} not found`)
      return
    }
    
    // Reset any in-progress timeboxes.
    updatedWorkPlan.storyBlocks.forEach(story => {
      story.timeBoxes.forEach(tb => {
        if (tb.status === 'in-progress') {
          tb.status = 'todo'
        }
      })
    })
    
    // Mark selected timebox as in-progress.
    updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'in-progress'
    
    setActiveTimeBox({ storyId, timeBoxIndex })
    setTimeRemaining(duration * 60) // Convert minutes to seconds.
    setIsTimerRunning(true)
    
    storageService.updateTimeBoxStatus(
      workplan.id,
      storyId,
      timeBoxIndex,
      'in-progress'
    )
    
    toast({
      title: "Timer Started",
      description: `Timer set for ${duration} minutes`,
    })
  }, [workplan, storageService, toast])

  // Complete a timebox: mark tasks as completed, update timer state, and update workplan progress.
  const completeTimeBox = useCallback((storyId: string, timeBoxIndex: number) => {
    if (!workplan) return
    
    // Stop any running timer.
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    const updatedWorkPlan = { ...workplan }
    const storyIndex = updatedWorkPlan.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with id ${storyId} not found`)
      return
    }
    
    // Mark all tasks in the timebox as completed.
    const tasks = updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].tasks
    if (tasks && tasks.length > 0) {
      tasks.forEach(task => {
        task.status = 'completed'
      })
    }
    
    // Set the timebox status to completed.
    updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'completed'
    
    // Reset timer state if this timebox was active.
    if (activeTimeBox?.storyId === storyId && activeTimeBox?.timeBoxIndex === timeBoxIndex) {
      setActiveTimeBox(null)
      setTimeRemaining(null)
      setIsTimerRunning(false)
    }
    
    // Update story progress.
    updatedWorkPlan.storyBlocks[storyIndex].progress = calculateStoryProgress(updatedWorkPlan.storyBlocks[storyIndex])
    
    // Update workplan in storage.
    storageService.updateTimeBoxStatus(
      workplan.id,
      storyId,
      timeBoxIndex,
      'completed'
    )
    
    // Find and suggest the next timebox.
    const nextTimeBox = findNextTimeBox()
    if (nextTimeBox) {
      const nextStoryIndex = updatedWorkPlan.storyBlocks.findIndex(story => story.id === nextTimeBox.storyId)
      if (nextStoryIndex !== -1) {
        const nextBoxType = updatedWorkPlan.storyBlocks[nextStoryIndex].timeBoxes[nextTimeBox.timeBoxIndex].type;
        const boxTypeLabel = nextBoxType === 'work' ? 'focus session' : 
                           (nextBoxType === 'short-break' || nextBoxType === 'long-break') ? 'break' : 
                           'debrief';
        
        toast({
          title: "Next up",
          description: `Would you like to start your next ${boxTypeLabel}?`,
          variant: "default",
          actionLabel: "Start",
          onAction: () => {
            const duration = updatedWorkPlan.storyBlocks[nextStoryIndex].timeBoxes[nextTimeBox.timeBoxIndex].duration
            startTimeBox(nextTimeBox.storyId, nextTimeBox.timeBoxIndex, duration)
          }
        })
      }
    }
  }, [workplan, activeTimeBox, findNextTimeBox, storageService, toast, startTimeBox])

  // Timer effect: decrements remaining time every second when running.
  useEffect(() => {
    if (!isTimerRunning || timeRemaining === null || timeRemaining <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      
      if (timeRemaining === 0 && isTimerRunning) {
        setIsTimerRunning(false)
        if (activeTimeBox) {
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
      return
    }

    if (timerIntervalRef.current) return // Prevent multiple timers.

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) return 0
        return prev - 1
      })
    }, 1000)
    
    timerIntervalRef.current = timer
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isTimerRunning, timeRemaining, activeTimeBox?.storyId, activeTimeBox?.timeBoxIndex, toast, completeTimeBox])

  // Undo the completion of a timebox.
  const undoCompleteTimeBox = useCallback((storyId: string, timeBoxIndex: number) => {
    if (!workplan) return
    
    const updatedWorkPlan = { ...workplan }
    const storyIndex = updatedWorkPlan.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with id ${storyId} not found`)
      return
    }
    
    const timeBox = updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex]
    
    if (timeBox.status !== 'completed') {
      console.error(`TimeBox at index ${timeBoxIndex} is not completed`)
      return
    }
    
    timeBox.status = 'todo'
    if (timeBox.tasks) {
      timeBox.tasks.forEach(task => {
        task.status = 'todo'
      })
    }
    
    updatedWorkPlan.storyBlocks[storyIndex].progress = calculateStoryProgress(updatedWorkPlan.storyBlocks[storyIndex])
    
    storageService.updateTimeBoxStatus(
      workplan.id,
      storyId,
      timeBoxIndex,
      'todo'
    )
    
    toast({
      title: "Timebox Reverted",
      description: "The timebox has been reverted to 'todo' status.",
    })
  }, [workplan, storageService, toast])

  // Handle task click to toggle task status and update workplan progress.
  const handleTaskClick = useCallback((storyId: string | undefined, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => {
    if (!workplan || !storyId) {
      console.error("Cannot toggle task status: workplan or storyId is undefined")
      return
    }

    console.log("TASK UPDATE - Checking if task status changed in props:", task.status);

    const updatedWorkPlan = { ...workplan }
    const storyIndex = updatedWorkPlan.storyBlocks.findIndex(story => story.id === storyId)
    
    if (storyIndex === -1) {
      console.error(`Story with ID ${storyId} not found`)
      return
    }

    const timeBox = updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex]
    if (!timeBox || !timeBox.tasks) {
      console.error(`TimeBox or tasks array not found at index ${timeBoxIndex}`)
      return
    }

    const currentTask = timeBox.tasks[taskIndex];
    
    if (currentTask.status === task.status) {
      console.log("Task status unchanged, no update needed");
      return;
    }
    
    console.log("Updating task status from", currentTask.status, "to", task.status);
    
    timeBox.tasks[taskIndex] = {
      ...timeBox.tasks[taskIndex],
      status: task.status
    };
    
    const allTasksCompleted = timeBox.tasks.every(t => t.status === 'completed')
    
    if (allTasksCompleted) {
      updatedWorkPlan.storyBlocks[storyIndex].timeBoxes[timeBoxIndex].status = 'completed'
      
      if (activeTimeBox?.storyId === storyId && activeTimeBox?.timeBoxIndex === timeBoxIndex) {
        setActiveTimeBox(null)
        setTimeRemaining(null)
        setIsTimerRunning(false)
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      }
      
      updatedWorkPlan.storyBlocks[storyIndex].progress = calculateStoryProgress(updatedWorkPlan.storyBlocks[storyIndex])
    }
    
    storageService.updateTaskStatus(
      workplan.id,
      storyId,
      timeBoxIndex,
      taskIndex,
      task.status === 'completed' ? 'completed' : 'todo'
    )
  }, [workplan, activeTimeBox, storageService])

  // Pause the timer.
  const pauseTimer = useCallback(() => {
    if (!isTimerRunning || !workplan || !activeTimeBox || timeRemaining === null) return
    
    setIsTimerRunning(false)
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    storageService.updateTimerState(
      workplan.id,
      activeTimeBox,
      timeRemaining,
      false
    )
    
    toast({
      title: "Timer Paused",
      description: "You can resume the timer when ready",
    })
  }, [workplan, activeTimeBox, isTimerRunning, timeRemaining, toast, storageService])

  // Resume the timer.
  const resumeTimer = useCallback(() => {
    if (isTimerRunning || !workplan || !activeTimeBox || timeRemaining === null || timeRemaining <= 0) return
    
    setIsTimerRunning(true)
    
    storageService.updateTimerState(
      workplan.id,
      activeTimeBox,
      timeRemaining,
      true
    )
    
    toast({
      title: "Timer Resumed",
      description: `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')} remaining`,
    })
  }, [workplan, activeTimeBox, isTimerRunning, timeRemaining, toast, storageService])

  // Reset the timer.
  const resetTimer = useCallback(() => {
    if (!workplan || !activeTimeBox) return
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    const storyIndex = workplan.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId)
    
    if (storyIndex !== -1) {
      const duration = workplan.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex].duration
      const newTimeRemaining = duration * 60
      setTimeRemaining(newTimeRemaining)
      setIsTimerRunning(false)
      
      storageService.updateTimerState(
        workplan.id,
        activeTimeBox,
        newTimeRemaining,
        false
      )
      
      toast({
        title: "Timer Reset",
        description: `Timer reset to ${duration} minutes`,
      })
    }
  }, [workplan, activeTimeBox, toast, storageService])

  // Update the time remaining value and persist timer state.
  const updateTimeRemaining = useCallback((newTime: number) => {
    if (!workplan || !activeTimeBox) return;
    
    setTimeRemaining(newTime);
    
    storageService.updateTimerState(
      workplan.id,
      activeTimeBox,
      newTime,
      isTimerRunning
    );
    
    const minutes = Math.floor(newTime / 60);
    const seconds = newTime % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    toast({
      title: "Timer Adjusted",
      description: `Time updated to ${formattedTime}`,
    });
  }, [workplan, activeTimeBox, isTimerRunning, storageService, toast]);

  // Check if a timebox is the currently active one.
  const isCurrentTimeBox = useCallback((timeBox: TimeBox) => {
    if (!activeTimeBox || !workplan) return false
    
    const storyIndex = workplan.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId)
    if (storyIndex === -1) return false
    
    const activeBox = workplan.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex]
    
    return activeBox === timeBox
  }, [activeTimeBox, workplan])

  // For backward compatibility: find the next available work timebox.
  const findNextWorkTimeBox = useCallback(() => {
    if (!workplan) return null
    
    for (let i = 0; i < workplan.storyBlocks.length; i++) {
      const story = workplan.storyBlocks[i]
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const timeBox = story.timeBoxes[j]
        if (timeBox.type === 'work' && timeBox.status === 'todo') {
          return { storyId: story.id, timeBoxIndex: j }
        }
      }
    }
    
    return null
  }, [workplan])

  return {
    workplan,
    loading,
    error,
    activeTimeBox,
    timeRemaining,
    isTimerRunning,
    isWorkPlanComplete,
    completedPercentage,
    hasIncompleteTasks,
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
