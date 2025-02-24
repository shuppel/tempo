// /features/brain-dump/services/brain-dump-services.ts
import type { ProcessedStory } from "@/lib/types"
import { isApiError } from "../types"

const processTasks = async (taskList: string[]) => {
  const response = await fetch("/api/tasks/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskList })
  })

  const data = await response.json()
  
  if (!response.ok) {
    // If the response contains error details, throw them
    if (isApiError(data)) {
      const errorDetails = data.details 
        ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
        : ''
      throw new Error(`${data.error}${errorDetails}`)
    }
    // If it's a raw error message
    throw new Error(data.error || 'Failed to process tasks')
  }

  return data
}

// Helper function to modify stories based on error types
const modifyStoriesForRetry = (stories: ProcessedStory[], error: any): ProcessedStory[] => {
  // Create a deep copy to avoid mutating the original data
  const modifiedStories = JSON.parse(JSON.stringify(stories)) as ProcessedStory[]
  
  // Error handling strategies
  if (error?.details?.block && error?.details?.consecutiveWorkTime > error?.details?.maxAllowed) {
    // Handle "Too much work time without a substantial break" error
    console.log(`Modifying stories to handle excessive work time in block: ${error.details.block}`)
    
    // Find the story block with the issue
    const storyToModify = modifiedStories.find(story => story.title === error.details.block)
    if (storyToModify) {
      // If this story has multiple tasks and total duration > 90 minutes, 
      // modify task durations to be shorter
      const totalDuration = storyToModify.estimatedDuration
      if (totalDuration > 90 && storyToModify.tasks.length > 1) {
        // Add a suggestion to split this story
        console.log(`Adjusting task durations for story "${storyToModify.title}" with current duration ${totalDuration}`)
        
        // Cap individual tasks to 60 minutes max
        storyToModify.tasks.forEach(task => {
          if (task.duration > 60) {
            console.log(`Reducing task "${task.title}" from ${task.duration} to 60 minutes`)
            task.duration = 60
          }
        })
        
        // Recalculate story duration
        storyToModify.estimatedDuration = storyToModify.tasks.reduce(
          (sum, task) => sum + task.duration, 0
        )
      }
    }
  }
  
  return modifiedStories
}

const createSession = async (stories: ProcessedStory[], startTime: string, maxRetries = 5) => {
  let currentStories = [...stories]
  let retryCount = 0
  let lastError = null
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to create session (attempt ${retryCount + 1}/${maxRetries})`)
      
      const response = await fetch("/api/tasks/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stories: currentStories,
          startTime
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // If the response contains error details, throw them
        if (isApiError(data)) {
          const errorDetails = data.details 
            ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
            : ''
          throw new Error(`${data.error}${errorDetails}`, { cause: data })
        }
        // If it's a raw error message
        throw new Error(data.error || 'Failed to create session', { cause: data })
      }

      // Success! Return the data
      return data
    } catch (error) {
      console.error(`Session creation attempt ${retryCount + 1} failed:`, error)
      lastError = error
      
      // Don't retry on the last attempt
      if (retryCount >= maxRetries - 1) {
        console.error(`Maximum retry limit (${maxRetries}) reached. Giving up.`)
        break
      }
      
      // Modify stories based on the error
      currentStories = modifyStoriesForRetry(currentStories, 
        error instanceof Error ? error.cause || error : error)
      
      retryCount++
      
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // If we've exhausted all retries, throw the last error
  if (lastError) {
    if (lastError instanceof Error) {
      throw lastError
    } else {
      throw new Error('Failed to create session after multiple attempts', { cause: lastError })
    }
  }
  
  throw new Error('Failed to create session due to unknown error')
}

export const brainDumpService = {
  processTasks,
  createSession
} as const