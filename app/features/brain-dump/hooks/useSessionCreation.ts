// /features/brain-dump/hooks/useSessionCreation.ts
import { useState } from "react"
import { brainDumpService } from "../services/brain-dump-services"
import type { ProcessedStory } from "@/lib/types"

export function useSessionCreation() {
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  const createSession = async (stories: ProcessedStory[]) => {
    setIsCreatingSession(true)
    setError(null)
    setProcessingStep("Creating session...")
    setProcessingProgress(0)

    try {
      const startTime = new Date().toISOString()
      setProcessingProgress(50)
      
      const result = await brainDumpService.createSession(stories, startTime)
      
      setProcessingProgress(100)
      setProcessingStep("Session created successfully!")
      
      return result
    } catch (error) {
      console.error("Failed to create session:", error)
      
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorDetails = error instanceof Error ? error.cause : error
      
      // If the error has a structured response
      if (error instanceof Error && error.cause && typeof error.cause === 'object') {
        errorDetails = error.cause
      }

      setError({
        message: errorMessage,
        code: "SESSION_ERROR",
        details: errorDetails
      })
      
      setProcessingProgress(0)
      setProcessingStep("Error creating session")
      throw error
    } finally {
      setTimeout(() => {
        setIsCreatingSession(false)
        setProcessingProgress(0)
        setProcessingStep("")
      }, 1000)
    }
  }

  return {
    createSession,
    isCreatingSession,
    processingStep,
    processingProgress,
    error,
    setError,
  }
}