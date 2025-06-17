// /features/brain-dump/types.ts
// Re-export types from lib/types to avoid direct imports from components
import type {
  ProcessedStory as BaseProcessedStory,
  ProcessedTask as BaseProcessedTask,
  DifficultyLevel,
} from "@/lib/types";

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ErrorDetails {
  message: string;
  code?: string;
  stack?: string;
  details?: unknown;
  cause?: unknown;
  response?: Record<string, unknown>;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as ApiError).error === "string"
  );
}

// Extend the ProcessedTask type to include difficulty
export interface ProcessedTask extends BaseProcessedTask {
  difficulty?: DifficultyLevel;
}

// Extend the ProcessedStory type to use our extended ProcessedTask
export interface ProcessedStory extends Omit<BaseProcessedStory, "tasks"> {
  tasks: ProcessedTask[];
}
