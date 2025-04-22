// /features/brain-dump/hooks/useTaskProcessing.ts
import { useState } from "react";
import { brainDumpService } from "@/app/features/brain-dump/services/brain-dump-services";
import type { ProcessedStory } from "@/lib/types";
import type { ErrorDetails } from "../types";

export function useTaskProcessing() {
  const [processedStories, setProcessedStories] = useState<ProcessedStory[]>(
    [],
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<ErrorDetails | null>(null);

  const processTasks = async (tasks: string) => {
    setIsProcessing(true);
    setProcessingStep("Analyzing tasks...");
    setProcessingProgress(20);
    setError(null);

    try {
      const taskList = tasks.split("\n").filter((task) => task.trim());

      if (taskList.length === 0) {
        throw new Error("Please enter at least one task");
      }

      setProcessingStep("Processing with AI...");
      setProcessingProgress(40);

      const data = await brainDumpService.processTasks(taskList);

      setProcessingStep("Organizing stories...");
      setProcessingProgress(80);

      // Validate the response structure
      if (!data.stories || !Array.isArray(data.stories)) {
        console.error("Invalid response structure:", data);
        throw new Error("Invalid response format: missing stories array");
      }

      // Validate each story has the required fields
      const invalidStories = data.stories.filter((story: ProcessedStory) => {
        return !story.title || !story.tasks || !Array.isArray(story.tasks);
      });

      if (invalidStories.length > 0) {
        console.error("Invalid stories found:", invalidStories);
        throw new Error("Some stories are missing required fields");
      }

      setProcessedStories(data.stories);

      setProcessingProgress(100);
      setProcessingStep("Complete!");

      return data.stories;
    } catch (error) {
      console.error("Failed to process tasks:", error);

      let errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      const errorCode = "UNKNOWN_ERROR";
      let errorDetails = error;

      // Error handling logic
      if (error instanceof Error && typeof error.message === "string") {
        try {
          if (error.message.includes("Details:")) {
            const [message, details] = error.message.split("\n\nDetails:");
            try {
              const parsedDetails = JSON.parse(details);
              errorDetails = parsedDetails;
              if (parsedDetails.response) {
                try {
                  const parsedResponse = JSON.parse(parsedDetails.response);
                  errorDetails = {
                    ...parsedDetails,
                    response: parsedResponse,
                  };
                } catch {
                  // Keep the original response if parsing fails
                }
              }
            } catch {
              errorDetails = details.trim();
            }
            errorMessage = message.trim();
          }
        } catch {
          errorDetails = error.message;
        }
      }

      setError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
      });
      setProcessingStep("Error occurred");
      setProcessingProgress(0);
      throw error;
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
        setProcessingStep("");
      }, 1000);
    }
  };

  return {
    processTasks,
    processedStories,
    isProcessing,
    processingStep,
    processingProgress,
    error,
    setError,
  };
}
