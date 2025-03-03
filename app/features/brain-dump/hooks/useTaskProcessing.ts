// /features/brain-dump/hooks/useTaskProcessing.ts
// This hook encapsulates the logic to process a raw string of tasks into structured stories
// using the AI service provided by brainDumpService. It manages loading states, progress steps,
// error handling, and returns the processed stories.

import { useState } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import type { ProcessedStory } from "@/lib/types"

export function useTaskProcessing() {
  // State to store the stories returned after processing tasks.
  const [processedStories, setProcessedStories] = useState<ProcessedStory[]>([])
  // Flag indicating if the processing operation is active.
  const [isProcessing, setIsProcessing] = useState(false)
  // Descriptive text indicating the current step in the processing pipeline.
  const [processingStep, setProcessingStep] = useState<string>("")
  // Numeric progress indicator (0-100) for visual feedback.
  const [processingProgress, setProcessingProgress] = useState(0)
  // Error state to capture any issues during task processing.
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  /**
   * processTasks: Processes raw task input and returns structured stories.
   *
   * @param tasks - A string containing multiple tasks separated by newlines.
   * @param shouldRetry - (Optional) Flag to indicate if this is a retry attempt.
   * @returns The array of processed stories.
   *
   * This function splits the input into a list, performs validation,
   * calls the AI service, and updates the processing states accordingly.
   */
  const processTasks = async (tasks: string, shouldRetry = false) => {
    // Start processing: update state to reflect that task processing is underway.
    setIsProcessing(true)
    setProcessingStep("Analyzing tasks...")
    setProcessingProgress(20)
    setError(null)

    try {
      // Split the input into an array of tasks; filter out any empty lines.
      const taskList = tasks.split("\n").filter(task => task.trim())
      
      // Validate that at least one task is provided.
      if (taskList.length === 0) {
        throw new Error("Please enter at least one task")
      }
      
      // Update state before calling the AI service.
      setProcessingStep("Processing with AI...")
      setProcessingProgress(40)
      
      // Call the brainDumpService to process the task list.
      const data = await brainDumpService.processTasks(taskList)

      // After receiving data, update the progress and indicate that stories are being organized.
      setProcessingStep("Organizing stories...")
      setProcessingProgress(80)

      // Validate that the response contains a 'stories' array.
      if (!data.stories || !Array.isArray(data.stories)) {
        console.error('Invalid response structure:', data)
        throw new Error('Invalid response format: missing stories array')
      }

      // Ensure that every story has the required fields (i.e. title and a tasks array).
      const invalidStories = data.stories.filter((story: ProcessedStory) => {
        return !story.title || !story.tasks || !Array.isArray(story.tasks)
      })

      if (invalidStories.length > 0) {
        console.error('Invalid stories found:', invalidStories)
        throw new Error('Some stories are missing required fields')
      }

      // Update state with the processed stories.
      setProcessedStories(data.stories)
      
      // Finalize progress, setting the progress to complete.
      setProcessingProgress(100)
      setProcessingStep("Complete!")
      
      // Return the structured stories for further use.
      return data.stories
    } catch (error) {
      console.error("Failed to process tasks:", error)
      
      // Prepare default error information.
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorCode = 'UNKNOWN_ERROR'
      let errorDetails = error

      // Attempt to extract detailed error info if provided in a specific format.
      if (error instanceof Error && typeof error.message === 'string') {
        try {
          if (error.message.includes('Details:')) {
            // Split the error message into a user-friendly message and detailed part.
            const [message, details] = error.message.split('\n\nDetails:')
            try {
              // Attempt to parse the details as JSON.
              const parsedDetails = JSON.parse(details)
              errorDetails = parsedDetails
              // Further parse nested response details if available.
              if (parsedDetails.response) {
                try {
                  const parsedResponse = JSON.parse(parsedDetails.response)
                  errorDetails = {
                    ...parsedDetails,
                    response: parsedResponse
                  }
                } catch (e) {
                  // If parsing fails, retain the original response.
                }
              }
            } catch (e) {
              // If JSON parsing fails, trim the details text.
              errorDetails = details.trim()
            }
            // Update the main error message.
            errorMessage = message.trim()
          }
        } catch (e) {
          // If extraction fails, use the raw error message.
          errorDetails = error.message
        }
      }

      // Update the error state to reflect the failure.
      setError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      setProcessingStep("Error occurred")
      setProcessingProgress(0)
      
      // Re-throw the error so that callers can also handle it.
      throw error
    } finally {
      // After processing (success or error), delay for UI feedback and then reset processing state.
      setTimeout(() => {
        setIsProcessing(false)
        setProcessingProgress(0)
        setProcessingStep("")
      }, 1000)
    }
  }

  // Return hook state and actions for use by components.
  return {
    processTasks,
    processedStories,
    isProcessing,
    processingStep,
    processingProgress,
    error,
    setError,
  }
}
