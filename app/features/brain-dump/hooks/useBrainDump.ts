// /features/brain-dump/hooks/useBrainDump.ts
import { useState, useEffect, useCallback } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import { SessionStorageService } from "@/app/features/session-manager"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"
import { useRouter } from "next/navigation"

// Create a singleton instance of SessionStorageService
const sessionStorage = new SessionStorageService()

export function useBrainDump(onTasksProcessed?: (stories: ProcessedStory[]) => void) {
  const router = useRouter()
  const [tasks, setTasks] = useState<string>("")
  const [processedStories, setProcessedStories] = useState<ProcessedStory[]>([])
  const [editedDurations, setEditedDurations] = useState<Record<string, number>>({})
  const [retryCount, setRetryCount] = useState(0)
  const [shouldNotifyParent, setShouldNotifyParent] = useState(false)
  const [isInputLocked, setIsInputLocked] = useState(false)
  
  // Task processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [taskProcessingStep, setTaskProcessingStep] = useState<string>("")
  const [taskProcessingProgress, setTaskProcessingProgress] = useState(0)
  const [taskProcessingError, setTaskProcessingError] = useState<{ message: string; code?: string; details?: any } | null>(null)
  
  // Session creation state
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [sessionCreationStep, setSessionCreationStep] = useState<string>("")
  const [sessionCreationProgress, setSessionCreationProgress] = useState(0)
  const [sessionCreationError, setSessionCreationError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  // Combined processing info
  const currentProcessingStep = isProcessing ? taskProcessingStep : isCreatingSession ? sessionCreationStep : ""
  const currentProcessingProgress = isProcessing ? taskProcessingProgress : isCreatingSession ? sessionCreationProgress : 0
  const currentError = taskProcessingError || sessionCreationError

  // Memoize the callback to prevent unnecessary re-renders
  const notifyParent = useCallback(() => {
    if (processedStories.length > 0 && onTasksProcessed) {
      onTasksProcessed(processedStories)
      setShouldNotifyParent(false)
    }
  }, [processedStories, onTasksProcessed])

  useEffect(() => {
    if (shouldNotifyParent) {
      notifyParent()
    }
  }, [shouldNotifyParent, notifyParent])

  const processTasks = async (shouldRetry = false) => {
    if (shouldRetry) {
      setRetryCount(prev => prev + 1)
    } else {
      setRetryCount(0)
    }

    setIsProcessing(true)
    setTaskProcessingStep("Analyzing tasks...")
    setTaskProcessingProgress(20)
    setTaskProcessingError(null)

    try {
      const taskList = tasks.split("\n").filter(task => task.trim())
      
      if (taskList.length === 0) {
        throw new Error("Please enter at least one task")
      }
      
      setTaskProcessingStep("Processing with AI...")
      setTaskProcessingProgress(40)
      
      const data = await brainDumpService.processTasks(taskList)

      setTaskProcessingStep("Organizing stories...")
      setTaskProcessingProgress(80)

      // Validate the response structure
      if (!data.stories || !Array.isArray(data.stories)) {
        console.error('Invalid response structure:', data)
        throw new Error('Invalid response format: missing stories array')
      }

      // Validate each story has the required fields
      const invalidStories = data.stories.filter((story: ProcessedStory) => {
        return !story.title || !story.tasks || !Array.isArray(story.tasks)
      })

      if (invalidStories.length > 0) {
        console.error('Invalid stories found:', invalidStories)
        throw new Error('Some stories are missing required fields')
      }

      setProcessedStories(data.stories)
      setShouldNotifyParent(true)
      setIsInputLocked(true) // Lock input after successful processing
      
      // Initialize edited durations
      const initialDurations: Record<string, number> = {}
      data.stories.forEach((story: ProcessedStory) => {
        initialDurations[story.title] = story.estimatedDuration
      })
      setEditedDurations(initialDurations)
      
      setTaskProcessingProgress(100)
      setTaskProcessingStep("Complete!")
    } catch (error) {
      console.error("Failed to process tasks:", error)
      
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorCode = 'UNKNOWN_ERROR'
      let errorDetails = error

      // Error handling logic
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
                  // Keep the original response if parsing fails
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

      setTaskProcessingError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      setTaskProcessingStep("Error occurred")
      setTaskProcessingProgress(0)
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setTaskProcessingProgress(0)
        setTaskProcessingStep("")
      }, 1000)
    }
  }

  const handleCreateSession = async () => {
    setIsCreatingSession(true)
    setSessionCreationError(null)
    setSessionCreationStep("Preparing session data...")
    setSessionCreationProgress(10)

    try {
      // Apply edited durations to stories while preserving all fields
      const updatedStories = processedStories.map(story => ({
        ...story,
        estimatedDuration: editedDurations[story.title] || story.estimatedDuration,
        tasks: story.tasks.map(task => ({ ...task })),
        projectType: story.projectType || 'Default Project',
        category: story.category || 'Development'
      }))

      // Pre-validation: Check if we have any stories with tasks
      if (updatedStories.length === 0 || updatedStories.some(story => !story.tasks || story.tasks.length === 0)) {
        throw new Error('No valid tasks found for session creation')
      }

      // Log the stories being sent for debugging
      console.log('Stories for session creation:', JSON.stringify(updatedStories, null, 2))

      // Get current time and ensure it's valid
      const now = new Date()
      if (isNaN(now.getTime())) {
        throw new Error('Invalid current date/time')
      }

      const startTime = now.toISOString()
      setSessionCreationProgress(20)
      setSessionCreationStep("Creating session plan...")

      // Call service to create session
      const sessionPlan = await brainDumpService.createSession(updatedStories, startTime)
      
      setSessionCreationProgress(60)
      setSessionCreationStep("Processing session data...")

      // Validate session plan
      if (!sessionPlan || typeof sessionPlan !== 'object') {
        console.error('Invalid session plan:', sessionPlan)
        throw new Error('Failed to create a valid session plan')
      }

      // Check required properties
      if (!sessionPlan.storyBlocks || !Array.isArray(sessionPlan.storyBlocks)) {
        console.error('Session plan missing story blocks:', sessionPlan)
        throw new Error('Session plan missing required story blocks')
      }

      if (sessionPlan.storyBlocks.length === 0) {
        console.error('Session plan has empty story blocks array:', sessionPlan)
        throw new Error('Session plan contains no story blocks')
      }

      // Ensure we have a valid total duration
      const validTotalDuration = validateSessionDuration(sessionPlan)
      console.log(`Validated session duration: ${validTotalDuration} minutes`)

      // Format today's date as YYYY-MM-DD for the session key
      const today = now.toISOString().split('T')[0]

      // Calculate end time with duration validation
      const durationMs = Math.floor(validTotalDuration) * 60 * 1000
      
      // Validate duration range (between 1 minute and 24 hours)
      if (durationMs <= 0) {
        console.error('Invalid duration (too small):', validTotalDuration)
        throw new Error(`Session duration is too short: ${validTotalDuration} minutes`)
      }
      
      if (durationMs > 24 * 60 * 60 * 1000) {
        console.error('Invalid duration (too large):', validTotalDuration)
        throw new Error(`Session duration exceeds maximum allowed: ${validTotalDuration} minutes`)
      }

      // Calculate end time
      const endTime = new Date(now.getTime() + durationMs)
      
      // Validate end time
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

      // Session is now saved by the brain dump service
      setSessionCreationProgress(100)
      setSessionCreationStep("Session created successfully!")

      // Clear the form
      setTasks("")
      setProcessedStories([])
      setEditedDurations({})
      setIsInputLocked(false)

      // Navigate to the newly created session page
      const formattedDate = today
      console.log(`Navigating to session page for date: ${formattedDate}`)
      
      // Add a small delay to ensure the session is saved before navigation
      setTimeout(() => {
        // Make sure the date is in the correct format (YYYY-MM-DD)
        const formattedDateForURL = formattedDate.replace(/\//g, '-')
        router.push(`/session/${formattedDateForURL}`)
      }, 500)

    } catch (error) {
      console.error("Failed to create session:", error)
      
      // Detailed error handling
      let errorMessage = error instanceof Error ? error.message : 'Failed to create session'
      let errorCode = 'SESSION_ERROR'
      let errorDetails = error
      
      // Try to extract more details if available
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
            // If parsing fails, use the original error message
            errorDetails = error.message
          }
        }
        
        // Check for specific error messages
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
      setTimeout(() => {
        setIsCreatingSession(false)
        setSessionCreationProgress(0)
        setSessionCreationStep("")
      }, 1000)
    }
  }

  // Helper function to validate and extract session duration
  function validateSessionDuration(sessionPlan: any): number {
    console.log('Validating session duration for plan:', sessionPlan)
    
    // Check if totalDuration is directly available and valid
    if (typeof sessionPlan.totalDuration === 'number' && sessionPlan.totalDuration > 0) {
      console.log(`Using provided totalDuration: ${sessionPlan.totalDuration}`)
      return sessionPlan.totalDuration
    }
    
    console.warn('Session plan missing valid totalDuration, calculating from story blocks')
    
    // Calculate from story blocks if available
    if (Array.isArray(sessionPlan.storyBlocks) && sessionPlan.storyBlocks.length > 0) {
      const calculatedDuration = sessionPlan.storyBlocks.reduce(
        (sum: number, block: { totalDuration?: number }) => sum + (block.totalDuration || 0),
        0
      )
      
      if (calculatedDuration > 0) {
        console.log(`Calculated duration from blocks: ${calculatedDuration}`)
        
        // Update the session plan with the calculated value
        sessionPlan.totalDuration = calculatedDuration
        
        return calculatedDuration
      }
    }
    
    // If we can't calculate from blocks, try using the sum of story estimatedDurations
    if (Array.isArray(sessionPlan.stories) && sessionPlan.stories.length > 0) {
      const durationFromStories = sessionPlan.stories.reduce(
        (sum: number, story: { estimatedDuration?: number }) => sum + (story.estimatedDuration || 0),
        0
      )
      
      if (durationFromStories > 0) {
        console.log(`Calculated duration from stories: ${durationFromStories}`)
        
        // Update the session plan
        sessionPlan.totalDuration = durationFromStories
        
        return durationFromStories
      }
    }
    
    // Last resort: check if we have the original stories with durations
    if (processedStories.length > 0) {
      const originalDuration = processedStories.reduce(
        (sum, story) => sum + (editedDurations[story.title] || story.estimatedDuration || 0),
        0
      )
      
      if (originalDuration > 0) {
        console.log(`Using original story durations as fallback: ${originalDuration}`)
        
        // Update the session plan
        sessionPlan.totalDuration = originalDuration
        
        return originalDuration
      }
    }
    
    // If all else fails, throw an error
    console.error('Could not determine valid session duration from any source')
    throw new Error('Unable to determine valid session duration')
  }

  const handleDurationChange = (storyTitle: string, newDuration: number) => {
    setEditedDurations(prev => {
      const updated = {
        ...prev,
        [storyTitle]: newDuration
      }
      
      // Update stories with new durations while preserving all fields
      const updatedStories = processedStories.map(story => {
        if (story.title === storyTitle) {
          const oldDuration = story.estimatedDuration
          const scaleFactor = newDuration / oldDuration

          // Scale task durations proportionally and round to nearest minute
          const updatedTasks = story.tasks.map(task => ({
            ...task,
            duration: Math.max(1, Math.round(task.duration * scaleFactor))
          }))

          // Calculate total after initial scaling
          let totalTaskDuration = updatedTasks.reduce((sum, task) => sum + task.duration, 0)
          
          // Distribute any remaining difference across tasks evenly
          if (totalTaskDuration !== newDuration) {
            const diff = newDuration - totalTaskDuration
            const tasksToAdjust = [...updatedTasks]
              .sort((a, b) => b.duration - a.duration) // Sort by duration descending
              .slice(0, Math.abs(diff)) // Take as many tasks as we need to adjust

            // Add or subtract 1 minute from each task until we reach the target
            tasksToAdjust.forEach(task => {
              const taskIndex = updatedTasks.findIndex(t => t.title === task.title)
              if (taskIndex !== -1) {
                updatedTasks[taskIndex].duration += diff > 0 ? 1 : -1
                totalTaskDuration += diff > 0 ? 1 : -1
              }
            })

            // If we still have a difference, adjust the longest task
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

  const handleRetry = () => {
    setIsInputLocked(false) // Unlock input on retry
    setProcessedStories([]) // Clear processed stories
    setEditedDurations({}) // Reset durations
    setTaskProcessingError(null)
    setSessionCreationError(null)
  }

  return {
    // State
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    retryCount,
    
    // Processing status
    isProcessing,
    isCreatingSession,
    processingStep: currentProcessingStep,
    processingProgress: currentProcessingProgress,
    error: currentError,
    
    // Actions
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry,
  }
}