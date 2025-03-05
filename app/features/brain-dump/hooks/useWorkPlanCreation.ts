// /features/brain-dump/hooks/useWorkPlanCreation.ts
import { useState } from "react"
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services"
import type { ProcessedStory, WorkPlan } from "@/lib/types"
import { useRouter } from "next/navigation"

export function useWorkPlanCreation() {
  const router = useRouter()
  const [isCreatingWorkPlan, setIsCreatingWorkPlan] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null)

  const createWorkPlan = async (stories: ProcessedStory[]) => {
    setIsCreatingWorkPlan(true)
    setError(null)
    setProcessingStep("Creating work plan...")
    setProcessingProgress(0)

    try {
      const startTime = new Date().toISOString()
      setProcessingProgress(50)
      
      const result = await brainDumpService.createWorkPlan(stories, startTime)
      
      setProcessingProgress(100)
      setProcessingStep("Work plan created successfully!")
      
      // Navigate to the newly created work plan page
      const today = new Date().toISOString().split('T')[0]
      console.log(`[useWorkPlanCreation] Navigating to work plan page for date: ${today}`)
      
      // Add a small delay to ensure the work plan is saved before navigation
      setTimeout(() => {
        // Make sure the date is in the correct format (YYYY-MM-DD)
        const formattedDateForURL = today.replace(/\//g, '-')
        router.push(`/workplan/${formattedDateForURL}`)
      }, 500)
      
      return result
    } catch (error) {
      console.error("Failed to create work plan:", error)
      
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorDetails = error instanceof Error ? error.cause : error
      
      // If the error has a structured response
      if (error instanceof Error && error.cause && typeof error.cause === 'object') {
        errorDetails = error.cause
      }

      setError({
        message: errorMessage,
        code: "WORKPLAN_ERROR",
        details: errorDetails
      })
      
      setProcessingProgress(0)
      setProcessingStep("Error creating work plan")
      throw error
    } finally {
      setTimeout(() => {
        setIsCreatingWorkPlan(false)
        setProcessingProgress(0)
        setProcessingStep("")
      }, 1000)
    }
  }

  return {
    createWorkPlan,
    isCreatingWorkPlan,
    processingStep,
    processingProgress,
    error,
    setError,
  }
} 