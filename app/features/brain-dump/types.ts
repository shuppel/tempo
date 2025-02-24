// /features/brain-dump/types.ts
// Re-export types from lib/types to avoid direct imports from components
export type { ProcessedStory, ProcessedTask } from "@/lib/types"

export interface ApiError {
  error: string
  code: string
  details?: unknown
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    'code' in error &&
    typeof (error as any).error === 'string' &&
    typeof (error as any).code === 'string'
  )
}