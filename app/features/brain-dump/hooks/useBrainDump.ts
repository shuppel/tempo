// /features/brain-dump/hooks/useBrainDump.ts
// This hook manages the state and processing logic for the Brain Dump feature.
// It handles free-form task input, processes tasks via AI services,
// creates sessions from processed tasks, and interacts with session rollover.
// It also notifies parent components when new processed stories become available.

import { useState, useEffect, useCallback, useMemo } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import { SessionStorageService } from "@/app/features/session-manager"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"
import { useRouter } from "next/navigation"
import { TaskRolloverService } from "@/app/features/task-rollover"

// Create a singleton instance of SessionStorageService to persist session data.
const sessionStorage = new SessionStorageService()

export function useBrainDump(onTasksProcessed?: (stories: ProcessedStory[]) => void) {
  // Next.js router for page navigation after session creation.
  const router = useRouter()

  // State for user input: the free-form list of tasks as a string.
  const [tasks, setTasks] = useState<string>("")
  
  // State for processed stories returned by the AI service.
  const [processedStories, setProcessedStories] = useState<ProcessedStory[]>([])
  
  // State to hold user-edited durations keyed by story title.
  const [editedDurations, setEditedDurations] = useState<Record<string, number>>({})
  
  // Retry count is incremented when a retry action occurs.
  const [retryCount, setRetryCount] = useState(0)
  
  // A flag to determine whether to notify parent components of updated stories.
  const [shouldNotifyParent, setShouldNotifyParent] = useState(false)
  
  // Lock the task input after successful processing.
  const [isInputLocked, setIsInputLocked] = useState(false)
  
  // --- Task Processing State ---
  // Flags and values related to processing tasks (via the AI service).
  const [isProcessing, setIsProcessing] = useState(false)
  const [taskProcessingStep, setTaskProcessingStep] = useState<string>("")
  const [taskProcessingProgress, setTaskProcessingProgress] = useState(0)
  const [taskProcessingError, setTaskProcessingError] = useState<{ message: string; code?: string; details?: any } | null>(null)
  
  // --- Session Creation State ---
  // Flags and values related to creating a session based on processed tasks.
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [sessionCreationStep, setSessionCreationStep] = useState<string>("")
  const [sessionCreationProgress, setSessionCreationProgress] = useState(0)
  const [sessionCreationError, setSessionCreationError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  // Create the rollover service only once to manage archiving of previous sessions.
  const rolloverService = useMemo(() => new TaskRolloverService(), []);

  // Combine processing state from task processing and session creation.
  // When one of these is active, use its step, progress, and error state.
  const currentProcessingStep = isProcessing ? taskProcessingStep : isCreatingSession ? sessionCreationStep : ""
  const currentProcessingProgress = isProcessing ? taskProcessingProgress : isCreatingSession ? sessionCreationProgress : 0
  const currentError = taskProcessingError || sessionCreationError

  // Memoized callback to notify the parent component once new stories are available.
  const notifyParent = useCallback(() => {
    if (processedStories.length > 0 && onTasksProcessed) {
      onTasksProcessed(processedStories)
      setShouldNotifyParent(false)
    }
  }, [processedStories, onTasksProcessed])

  // Trigger parent notification when the flag is set.
  useEffect(() => {
    if (shouldNotifyParent) {
      notifyParent()
    }
  }, [shouldNotifyParent, notifyParent])

  // --- Task Processing Function ---
  // Processes the raw task input using the brainDumpService.
  // It splits tasks by newline, validates the input, calls the AI service,
  // verifies the response structure, and updates state accordingly.
  const processTasks = async (shouldRetry = false) => {
    // Increment retry count if needed.
    if (shouldRetry) {
      setRetryCount(prev => prev + 1)
    } else {
      setRetryCount(0)
    }

    // Set initial processing state.
    setIsProcessing(true)
    setTaskProcessingStep("Analyzing tasks...")
    setTaskProcessingProgress(20)
    setTaskProcessingError(null)

    try {
      // Split input into individual tasks and filter out empty lines.
      const taskList = tasks.split("\n").filter(task => task.trim())
      
      if (taskList.length === 0) {
        throw new Error("Please enter at least one task")
      }
      
      // Update state before calling AI service.
      setTaskProcessingStep("Processing with AI...")
      setTaskProcessingProgress(40)
      
      // Call the service to process tasks.
      const data = await brainDumpService.processTasks(taskList)

      // Update state for next step.
      setTaskProcessingStep("Organizing stories...")
      setTaskProcessingProgress(80)

      // Validate that the response has a valid stories array.
      if (!data.stories || !Array.isArray(data.stories)) {
        console.error('Invalid response structure:', data)
        throw new Error('Invalid response format: missing stories array')
      }

      // Validate each story object contains required fields.
      const invalidStories = data.stories.filter((story: ProcessedStory) => {
        return !story.title || !story.tasks || !Array.isArray(story.tasks)
      })

      if (invalidStories.length > 0) {
        console.error('Invalid stories found:', invalidStories)
        throw new Error('Some stories are missing required fields')
      }

      // Save the processed stories and initialize durations.
      setProcessedStories(data.stories)
      setShouldNotifyParent(true)
      setIsInputLocked(true) // Lock input after successful processing
      
      // Initialize edited durations with each story's estimated duration.
      const initialDurations: Record<string, number> = {}
      data.stories.forEach((story: ProcessedStory) => {
        initialDurations[story.title] = story.estimatedDuration
      })
      setEditedDurations(initialDurations)
      
      // Finalize processing state.
      setTaskProcessingProgress(100)
      setTaskProcessingStep("Complete!")
    } catch (error) {
      console.error("Failed to process tasks:", error)
      
      // Attempt to extract detailed error info.
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorCode = 'UNKNOWN_ERROR'
      let errorDetails = error

      if (error instanceof Error && typeof error.message === 'string') {
        try {
          if (error.message.includes('Details:')) {
            const [message, details] = error.message.split('\n\nDetails:')
            try {
              const parsedDetails = JSON.parse(details)
              errorDetails = parsedDetails
              if (parsedDetails.response) {
                try {
                  const parsedResponse = JSON.parse(parsedDetails.response)
                  errorDetails = {
                    ...parsedDetails,
                    response: parsedResponse
                  }
                } catch (e) {
                  // If JSON parsing fails, keep the original response.
                }
              }
            } catch (e) {
              errorDetails = details.trim()
            }
            errorMessage = message.trim()
          }
        } catch (e) {
          errorDetails = error.message
        }
      }

      // Set error state for task processing.
      setTaskProcessingError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      setTaskProcessingStep("Error occurred")
      setTaskProcessingProgress(0)
    } finally {
      // Delay resetting processing flags to allow UI feedback.
      setTimeout(() => {
        setIsProcessing(false)
        setTaskProcessingProgress(0)
        setTaskProcessingStep("")
      }, 1000)
    }
  }

  // --- Session Creation Function ---
  // Creates a session from the processed stories.
  // Applies user-edited durations, validates session data,
  // calculates start and end times, and triggers navigation to the new session.
  const handleCreateSession = async () => {
    setIsCreatingSession(true)
    setSessionCreationError(null)
    setSessionCreationStep("Preparing session data...")
    setSessionCreationProgress(10)

    try {
      // Merge edited durations into stories, ensuring required fields.
      const updatedStories = processedStories.map(story => ({
        ...story,
        estimatedDuration: editedDurations[story.title] || story.estimatedDuration,
        tasks: story.tasks.map(task => ({ ...task })), // Preserve task details
        projectType: story.projectType || 'Default Project',
        category: story.category || 'Development'
      }))

      // Pre-validate that there are valid stories and tasks.
      if (updatedStories.length === 0 || updatedStories.some(story => !story.tasks || story.tasks.length === 0)) {
        throw new Error('No valid tasks found for session creation')
      }

      console.log('Stories for session creation:', JSON.stringify(updatedStories, null, 2))

      // Get the current time as the session start time.
      const now = new Date()
      if (isNaN(now.getTime())) {
        throw new Error('Invalid current date/time')
      }
      const startTime = now.toISOString()
      setSessionCreationProgress(20)
      setSessionCreationStep("Creating session plan...")

      // Call service to create a session plan based on the updated stories.
      const sessionPlan = await brainDumpService.createSession(updatedStories, startTime)
      
      setSessionCreationProgress(60)
      setSessionCreationStep("Processing session data...")

      // Validate the session plan response.
      if (!sessionPlan || typeof sessionPlan !== 'object') {
        console.error('Invalid session plan:', sessionPlan)
        throw new Error('Failed to create a valid session plan')
      }
      if (!sessionPlan.storyBlocks || !Array.isArray(sessionPlan.storyBlocks)) {
        console.error('Session plan missing story blocks:', sessionPlan)
        throw new Error('Session plan missing required story blocks')
      }
      if (sessionPlan.storyBlocks.length === 0) {
        console.error('Session plan has empty story blocks array:', sessionPlan)
        throw new Error('Session plan contains no story blocks')
      }

      // Validate the session duration from the plan.
      const validTotalDuration = validateSessionDuration(sessionPlan)
      console.log(`Validated session duration: ${validTotalDuration} minutes`)

      // Format today's date as YYYY-MM-DD for session storage and URL routing.
      const today = now.toISOString().split('T')[0]

      // Calculate the session end time in milliseconds.
      const durationMs = Math.floor(validTotalDuration) * 60 * 1000
      
      // Validate that the duration is within acceptable bounds.
      if (durationMs <= 0) {
        console.error('Invalid duration (too small):', validTotalDuration)
        throw new Error(`Session duration is too short: ${validTotalDuration} minutes`)
      }
      if (durationMs > 24 * 60 * 60 * 1000) {
        console.error('Invalid duration (too large):', validTotalDuration)
        throw new Error(`Session duration exceeds maximum allowed: ${validTotalDuration} minutes`)
      }

      // Calculate the session's end time.
      const endTime = new Date(now.getTime() + durationMs)
      if (isNaN(endTime.getTime())) {
        console.error('End time calculation failed:', {
          now: now.toISOString(),
          durationMs,
          totalDuration: validTotalDuration
        })
        throw new Error('Failed to calculate a valid end time')
      }

      setSessionCreationProgress(80)
      setSessionCreationStep("Saving session...")

      // At this point, the session plan is considered complete.
      setSessionCreationProgress(100)
      setSessionCreationStep("Session created successfully!")

      // Clear the form state and unlock input for new entries.
      setTasks("")
      setProcessedStories([])
      setEditedDurations({})
      setIsInputLocked(false)

      // Archive any previous active session.
      try {
        const recentSession = await rolloverService.getMostRecentActiveSession();
        if (recentSession) {
          console.log(`[useBrainDump] Archiving previous session: ${recentSession.date}`);
          await rolloverService.archiveSession(recentSession.date);
        }
      } catch (archiveError) {
        // Log the error but don't interrupt session creation if archiving fails.
        console.error('[useBrainDump] Error archiving previous session:', archiveError);
      }

      // Navigate to the new session page after a short delay.
      const formattedDate = today
      console.log(`Navigating to session page for date: ${formattedDate}`)
      setTimeout(() => {
        // Ensure the date is URL-friendly.
        const formattedDateForURL = formattedDate.replace(/\//g, '-')
        router.push(`/session/${formattedDateForURL}`)
      }, 500)

    } catch (error) {
      console.error("Failed to create session:", error)
      
      // Extract detailed error information for session creation.
      let errorMessage = error instanceof Error ? error.message : 'Failed to create session'
      let errorCode = 'SESSION_ERROR'
      let errorDetails = error
      
      if (error instanceof Error) {
        if (error.message.includes('Details:')) {
          try {
            const [message, details] = error.message.split('\n\nDetails:')
            errorMessage = message.trim()
            try {
              errorDetails = JSON.parse(details.trim())
            } catch {
              errorDetails = details.trim()
            }
          } catch (e) {
            errorDetails = error.message
          }
        }
        
        // Specific error handling for work time or duration issues.
        if (error.message.includes('work time') && error.message.includes('break')) {
          errorCode = 'EXCESSIVE_WORK_TIME'
          errorMessage = 'Session contains too much consecutive work time without breaks. Try splitting large tasks or adding breaks.'
        } else if (error.message.includes('duration')) {
          errorCode = 'INVALID_DURATION'
          errorMessage = 'Invalid session duration. Please check your task durations.'
        }
      }
      
      setSessionCreationError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      
      setSessionCreationProgress(0)
      setSessionCreationStep("Error creating session")
    } finally {
      // Reset session creation state after a brief delay.
      setTimeout(() => {
        setIsCreatingSession(false)
        setSessionCreationProgress(0)
        setSessionCreationStep("")
      }, 1000)
    }
  }

  // --- Helper Function: validateSessionDuration ---
  // Attempts to extract a valid session duration from the session plan.
  // Checks for a provided totalDuration, then calculates it from story blocks,
  // or as a fallback from individual story estimated durations.
  function validateSessionDuration(sessionPlan: any): number {
    console.log('Validating session duration for plan:', sessionPlan)
    
    if (typeof sessionPlan.totalDuration === 'number' && sessionPlan.totalDuration > 0) {
      console.log(`Using provided totalDuration: ${sessionPlan.totalDuration}`)
      return sessionPlan.totalDuration
    }
    
    console.warn('Session plan missing valid totalDuration, calculating from story blocks')
    
    if (Array.isArray(sessionPlan.storyBlocks) && sessionPlan.storyBlocks.length > 0) {
      const calculatedDuration = sessionPlan.storyBlocks.reduce(
        (sum: number, block: { totalDuration?: number }) => sum + (block.totalDuration || 0),
        0
      )
      
      if (calculatedDuration > 0) {
        console.log(`Calculated duration from blocks: ${calculatedDuration}`)
        sessionPlan.totalDuration = calculatedDuration
        return calculatedDuration
      }
    }
    
    if (Array.isArray(sessionPlan.stories) && sessionPlan.stories.length > 0) {
      const durationFromStories = sessionPlan.stories.reduce(
        (sum: number, story: { estimatedDuration?: number }) => sum + (story.estimatedDuration || 0),
        0
      )
      
      if (durationFromStories > 0) {
        console.log(`Calculated duration from stories: ${durationFromStories}`)
        sessionPlan.totalDuration = durationFromStories
        return durationFromStories
      }
    }
    
    if (processedStories.length > 0) {
      const originalDuration = processedStories.reduce(
        (sum, story) => sum + (editedDurations[story.title] || story.estimatedDuration || 0),
        0
      )
      
      if (originalDuration > 0) {
        console.log(`Using original story durations as fallback: ${originalDuration}`)
        sessionPlan.totalDuration = originalDuration
        return originalDuration
      }
    }
    
    console.error('Could not determine valid session duration from any source')
    throw new Error('Unable to determine valid session duration')
  }

  // --- Duration Change Handler ---
  // Updates the duration for a given story, then re-calculates task durations proportionally.
  // Also ensures that the sum of task durations matches the new story duration.
  const handleDurationChange = (storyTitle: string, newDuration: number) => {
    setEditedDurations(prev => {
      const updated = {
        ...prev,
        [storyTitle]: newDuration
      }
      
      // Update processed stories with new duration and adjust each task's duration.
      const updatedStories = processedStories.map(story => {
        if (story.title === storyTitle) {
          const oldDuration = story.estimatedDuration
          const scaleFactor = newDuration / oldDuration

          // Scale each task duration proportionally, rounding to the nearest minute.
          const updatedTasks = story.tasks.map(task => ({
            ...task,
            duration: Math.max(1, Math.round(task.duration * scaleFactor))
          }))

          // Ensure the total task duration matches the new duration by distributing any difference.
          let totalTaskDuration = updatedTasks.reduce((sum, task) => sum + task.duration, 0)
          if (totalTaskDuration !== newDuration) {
            const diff = newDuration - totalTaskDuration
            const tasksToAdjust = [...updatedTasks]
              .sort((a, b) => b.duration - a.duration)
              .slice(0, Math.abs(diff))

            tasksToAdjust.forEach(task => {
              const taskIndex = updatedTasks.findIndex(t => t.title === task.title)
              if (taskIndex !== -1) {
                updatedTasks[taskIndex].duration += diff > 0 ? 1 : -1
                totalTaskDuration += diff > 0 ? 1 : -1
              }
            })

            if (totalTaskDuration !== newDuration) {
              const longestTask = updatedTasks.reduce((max, task) => 
                task.duration > max.duration ? task : max
              , updatedTasks[0])
              const taskIndex = updatedTasks.findIndex(t => t.title === longestTask.title)
              updatedTasks[taskIndex].duration += newDuration - totalTaskDuration
            }
          }

          return {
            ...story,
            estimatedDuration: newDuration,
            tasks: updatedTasks
          }
        }
        return story
      })

      setProcessedStories(updatedStories)
      setShouldNotifyParent(true)
      
      return updated
    })
  }

  // --- Retry Handler ---
  // Resets error states and unlocks input, allowing the user to reattempt task processing.
  const handleRetry = () => {
    setIsInputLocked(false) // Unlock input for editing.
    setProcessedStories([]) // Clear previously processed stories.
    setEditedDurations({}) // Reset duration adjustments.
    setTaskProcessingError(null)
    setSessionCreationError(null)
  }

  // --- Logging-Enhanced Setter for Task Input ---
  // Wraps the setTasks state updater with logging to track changes.
  const setTasksWithLogging = (newTasks: string | ((prev: string) => string)) => {
    console.log("[useBrainDump] Setting tasks:", {
      type: typeof newTasks === 'function' ? 'function' : 'string',
      length: typeof newTasks === 'string' ? newTasks.length : 'unknown',
      fromTaskRollover: typeof newTasks === 'string' && newTasks.includes('(From:')
    });
    
    setTasks(newTasks);
  };

  // Return hook state and actions to be consumed by the component.
  return {
    // State values.
    tasks,
    setTasks: setTasksWithLogging,
    processedStories,
    editedDurations,
    isInputLocked,
    retryCount,
    
    // Processing status (combining task and session processing).
    isProcessing,
    isCreatingSession,
    processingStep: currentProcessingStep,
    processingProgress: currentProcessingProgress,
    error: currentError,
    
    // Action handlers.
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry,
  }
}
