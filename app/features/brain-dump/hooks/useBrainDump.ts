// /features/brain-dump/hooks/useBrainDump.ts
import { useState, useEffect, useCallback } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"

export function useBrainDump(onTasksProcessed?: (stories: ProcessedStory[]) => void) {
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
    setSessionCreationStep("Creating session...")
    setSessionCreationProgress(0)

    try {
      // Apply edited durations to stories while preserving all fields
      const updatedStories = processedStories.map(story => ({
        ...story,
        estimatedDuration: editedDurations[story.title] || story.estimatedDuration,
        tasks: story.tasks.map(task => ({ ...task })),
        project: story.project || 'Default Project',
        category: story.category || 'Development'
      }))

      // Log the stories being sent for debugging
      console.log('Sending stories to create session:', JSON.stringify(updatedStories, null, 2))

      const startTime = new Date().toISOString()
      setSessionCreationProgress(20)
      setSessionCreationStep("Preparing session plan...")
      
      try {
        // Update the UI to show retry attempts
        const handleRetryAttempt = (attempt: number, maxRetries: number) => {
          setSessionCreationStep(`Attempt ${attempt}/${maxRetries}: Optimizing session plan...`)
          setSessionCreationProgress(20 + Math.min(60, attempt * 15)) // Progress increases with each attempt
        }
        
        // Listen for console logs from brainDumpService to update UI
        const originalConsoleLog = console.log
        console.log = (...args) => {
          originalConsoleLog(...args)
          const message = args.join(' ')
          if (message.includes('Attempting to create session (attempt ')) {
            const match = message.match(/attempt (\d+)\/(\d+)/)
            if (match && match.length >= 3) {
              const attempt = parseInt(match[1])
              const maxRetries = parseInt(match[2])
              handleRetryAttempt(attempt, maxRetries)
            }
          }
        }
        
        const result = await brainDumpService.createSession(updatedStories, startTime)
        
        // Restore original console.log
        console.log = originalConsoleLog
        
        setSessionCreationProgress(100)
        setSessionCreationStep("Session created successfully!")
        
        // Use window.location for a full page navigation to avoid hydration issues
        if (result?.sessionUrl) {
          window.location.href = result.sessionUrl
        }
      } catch (error) {
        console.error("Failed to create session:", error)
        
        let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        let errorDetails = error instanceof Error ? error.cause : error
        
        // Provide more helpful error messages for specific error types
        if (error instanceof Error && error.message.includes('Too much work time without a substantial break')) {
          errorMessage = 'Session planning failed: Work blocks are too long without breaks'
          if (error.cause && typeof error.cause === 'object') {
            const details = error.cause as any
            if (details.details?.block) {
              errorMessage += `\n\nThe story "${details.details.block}" has ${details.details.consecutiveWorkTime} minutes of work without a break (maximum is ${details.details.maxAllowed} minutes).`
              errorMessage += '\n\nTry reducing the duration of some tasks or splitting them into smaller tasks.'
            }
          }
        }

        setSessionCreationError({
          message: errorMessage,
          code: "SESSION_ERROR",
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
    } catch (error) {
      console.error("Error preparing session data:", error)
      
      setSessionCreationError({
        message: "Failed to prepare session data",
        code: "PREPARATION_ERROR",
        details: error
      })
      
      setSessionCreationProgress(0)
      setSessionCreationStep("Error preparing session")
      
      setTimeout(() => {
        setIsCreatingSession(false)
        setSessionCreationProgress(0)
        setSessionCreationStep("")
      }, 1000)
    }
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