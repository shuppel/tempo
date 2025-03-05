// /features/brain-dump/hooks/useBrainDump.ts
// This hook manages the state and processing logic for the Brain Dump feature.
// It handles free-form task input, processes tasks via AI services,
// creates workplans from processed tasks, and interacts with workplan rollover.
// It also notifies parent components when new processed stories become available.

import { useState, useEffect, useCallback, useMemo } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import { WorkPlanStorageService } from "@/app/features/workplan-manager/services/workplan-storage.service"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"
import { useRouter } from "next/navigation"
import { TaskRolloverService } from "@/app/features/task-rollover"
import { format } from "date-fns"

// Create a singleton instance of WorkPlanStorageService to persist workplan data.
const workplanStorage = new WorkPlanStorageService()

// Add interface for error details
interface ErrorDetails {
  status?: number;
  code?: string;
  message?: string;
  [key: string]: any;
}

export function useBrainDump(onTasksProcessed?: (stories: ProcessedStory[]) => void) {
  // Next.js router for page navigation after workplan creation.
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
  
  // --- Work Plan Creation State ---
  // Flags and values related to creating a work plan based on processed tasks.
  const [isCreatingWorkPlan, setIsCreatingWorkPlan] = useState(false)
  const [workPlanCreationStep, setWorkPlanCreationStep] = useState<string>("")
  const [workPlanCreationProgress, setWorkPlanCreationProgress] = useState(0)
  const [workPlanCreationError, setWorkPlanCreationError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  // Create the rollover service only once to manage archiving of previous work plans.
  const rolloverService = useMemo(() => new TaskRolloverService(), []);

  // Combine processing state from task processing and work plan creation.
  // When one of these is active, use its step, progress, and error state.
  const currentProcessingStep = isProcessing ? taskProcessingStep : isCreatingWorkPlan ? workPlanCreationStep : ""
  const currentProcessingProgress = isProcessing ? taskProcessingProgress : isCreatingWorkPlan ? workPlanCreationProgress : 0
  const currentError = taskProcessingError || workPlanCreationError

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

  // --- Work Plan Creation Function ---
  const handleCreateWorkPlan = async () => {
    setIsCreatingWorkPlan(true)
    setWorkPlanCreationError(null)
    setWorkPlanCreationStep("Preparing work plan data...")
    setWorkPlanCreationProgress(10)

    try {
      // Merge edited durations into stories, ensuring required fields
      const updatedStories = processedStories.map(story => ({
        ...story,
        estimatedDuration: editedDurations[story.title] || story.estimatedDuration,
        tasks: story.tasks.map(task => ({ ...task })), // Preserve task details
        projectType: story.projectType || 'Default Project',
        category: story.category || 'Development'
      }))

      // Pre-validate that there are valid stories and tasks
      if (updatedStories.length === 0 || updatedStories.some(story => !story.tasks || story.tasks.length === 0)) {
        throw new Error('No valid tasks found for work plan creation')
      }

      console.log('Stories for work plan creation:', JSON.stringify(updatedStories, null, 2))

      // Get the current time as the work plan start time
      const now = new Date()
      if (isNaN(now.getTime())) {
        throw new Error('Invalid current date/time')
      }
      const startTime = now.toISOString()
      setWorkPlanCreationProgress(20)
      setWorkPlanCreationStep("Creating work plan...")

      // Call service to create a work plan based on the updated stories
      let retryCount = 0
      const maxRetries = 3
      let lastError = null

      while (retryCount < maxRetries) {
        try {
          const workPlan = await brainDumpService.createWorkPlan(updatedStories, startTime)
          
          setWorkPlanCreationProgress(60)
          setWorkPlanCreationStep("Processing work plan data...")

          // Validate the work plan response
          if (!workPlan || typeof workPlan !== 'object') {
            throw new Error('Failed to create a valid work plan')
          }
          if (!workPlan.storyBlocks || !Array.isArray(workPlan.storyBlocks)) {
            throw new Error('Work plan missing required story blocks')
          }
          if (workPlan.storyBlocks.length === 0) {
            throw new Error('Work plan contains no story blocks')
          }

          // Validate the work plan duration from the plan
          const validTotalDuration = validateWorkPlanDuration(workPlan)
          console.log(`Validated work plan duration: ${validTotalDuration} minutes`)

          // Format today's date as YYYY-MM-DD for work plan storage and URL routing
          const formattedDateForURL = format(now, 'yyyy-MM-dd')

          // Calculate the work plan end time in milliseconds
          const endTime = new Date(now.getTime() + validTotalDuration * 60 * 1000).toISOString()

          // Validate the total duration
          if (validTotalDuration < 15) {
            throw new Error(`Work plan duration is too short: ${validTotalDuration} minutes`)
          }

          const maxDuration = 24 * 60 // 24 hours in minutes
          if (validTotalDuration > maxDuration) {
            throw new Error(`Work plan duration exceeds maximum allowed: ${validTotalDuration} minutes`)
          }

          // Calculate the work plan's end time
          const workPlanData = {
            ...workPlan,
            id: formattedDateForURL,
            startTime,
            endTime,
            totalDuration: validTotalDuration,
            status: 'pending',
            currentBlockIndex: 0,
            currentTaskIndex: 0,
            isActive: false,
            isPaused: false,
            isComplete: false,
            lastUpdated: new Date().toISOString()
          }

          setWorkPlanCreationProgress(80)
          setWorkPlanCreationStep("Saving work plan...")

          // Save the work plan data
          await workplanStorage.saveWorkPlan(workPlanData)

          // At this point, the work plan is considered complete
          setWorkPlanCreationProgress(100)
          setWorkPlanCreationStep("Work plan created successfully!")

          // Navigate to the new work plan page after a short delay
          setTimeout(() => {
            console.log(`Navigating to work plan page for date: ${formattedDateForURL}`)
            router.push(`/workplan/${formattedDateForURL}`)
          }, 500)

          return // Success - exit the retry loop

        } catch (error) {
          console.error(`Attempt ${retryCount + 1} failed:`, error)
          lastError = error

          // Extract error details
          let errorMessage = error instanceof Error ? error.message : 'Unknown error'
          let errorCode = 'UNKNOWN_ERROR'
          let errorDetails: ErrorDetails = {}

          if (error instanceof Error && error.cause) {
            const cause = error.cause as any
            errorCode = cause.code || errorCode
            errorDetails = cause.details || {}
          }

          // Check if this is a retryable error
          const isRetryableError = (
            // API errors
            errorCode === 'INVALID_CONTENT_TYPE' ||
            errorCode === 'RATE_LIMITED' ||
            // Status codes
            errorDetails.status === 429 ||
            errorDetails.status === 500 ||
            errorDetails.status === 503
          )

          if (!isRetryableError || retryCount >= maxRetries - 1) {
            // Set error state with detailed information
            setWorkPlanCreationError({
              message: errorMessage,
              code: errorCode,
              details: errorDetails
            })
            break
          }

          // Exponential backoff for retries
          retryCount++
          const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
          setWorkPlanCreationStep(`Retrying... (Attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          setWorkPlanCreationProgress(20) // Reset progress for new attempt
        }
      }

    } catch (error) {
      console.error("Failed to create work plan:", error)

      // Extract error information
      let errorMessage = error instanceof Error ? error.message : 'Failed to create work plan'
      let errorCode = 'WORKPLAN_ERROR'
      let errorDetails = error

      if (error instanceof Error && error.cause) {
        const cause = error.cause as any
        errorCode = cause.code || errorCode
        errorDetails = cause.details || errorDetails
      }

      // Set error state with detailed information
      setWorkPlanCreationError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      setWorkPlanCreationProgress(0)
      setWorkPlanCreationStep("Error creating work plan")
    } finally {
      // Reset work plan creation state after a brief delay
      setTimeout(() => {
        setIsCreatingWorkPlan(false)
        setWorkPlanCreationProgress(0)
        setWorkPlanCreationStep("")
      }, 1000)
    }
  }

  // --- Helper Function: validateWorkPlanDuration ---
  // Attempts to extract a valid work plan duration from the work plan.
  // Returns the total duration in minutes.
  // Throws an error if no valid duration can be determined.
  function validateWorkPlanDuration(workPlan: any): number {
    console.log('Validating work plan duration for plan:', workPlan)

    if (typeof workPlan.totalDuration === 'number' && workPlan.totalDuration > 0) {
      console.log(`Using provided totalDuration: ${workPlan.totalDuration}`)
      return workPlan.totalDuration
    }

    console.warn('Work plan missing valid totalDuration, calculating from story blocks')

    if (Array.isArray(workPlan.storyBlocks) && workPlan.storyBlocks.length > 0) {
      const calculatedDuration = workPlan.storyBlocks.reduce(
        (sum: number, block: { totalDuration?: number }) => sum + (block.totalDuration || 0),
        0
      )
      
      if (calculatedDuration > 0) {
        console.log(`Calculated duration from blocks: ${calculatedDuration}`)
        workPlan.totalDuration = calculatedDuration
        return calculatedDuration
      }
    }
    
    if (processedStories.length > 0) {
      const originalDuration = processedStories.reduce(
        (sum, story) => sum + (editedDurations[story.title] || story.estimatedDuration || 0),
        0
      )
      
      if (originalDuration > 0) {
        console.log(`Using original story durations as fallback: ${originalDuration}`)
        workPlan.totalDuration = originalDuration
        return originalDuration
      }
    }
    
    console.error('Could not determine valid work plan duration from any source')
    throw new Error('Unable to determine valid work plan duration')
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
    setWorkPlanCreationError(null)
    setTaskProcessingProgress(0)
    setWorkPlanCreationProgress(0)
    setTaskProcessingStep("")
    setWorkPlanCreationStep("")
    setIsProcessing(false)
    setIsCreatingWorkPlan(false)
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
    
    // Processing status (combining task and work plan processing).
    isProcessing,
    isCreatingWorkPlan,
    processingStep: currentProcessingStep,
    processingProgress: currentProcessingProgress,
    error: currentError,
    
    // Action handlers.
    processTasks,
    handleCreateWorkPlan,
    handleDurationChange,
    handleRetry,
  }
}
