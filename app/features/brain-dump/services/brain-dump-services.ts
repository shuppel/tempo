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

const createSession = async (stories: ProcessedStory[], startTime: string) => {
  const response = await fetch("/api/tasks/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stories,
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
      throw new Error(`${data.error}${errorDetails}`)
    }
    // If it's a raw error message
    throw new Error(data.error || 'Failed to create session')
  }

  return data
}

export const brainDumpService = {
  processTasks,
  createSession
} as const