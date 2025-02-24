// /features/brain-dump/services/brain-dump-service.ts
import type { ProcessedStory } from "@/lib/types"

export async function processTasks(taskList: string[]) {
  const response = await fetch("/api/tasks/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskList })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to process tasks')
  }

  return data
}

export async function createSession(stories: ProcessedStory[], startTime: string) {
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
    throw new Error(data.error || 'Failed to create session')
  }

  return data
}