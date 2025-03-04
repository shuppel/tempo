// /features/brain-dump/components/BrainDumpForm.tsx
// This component allows users to quickly dump their tasks as free-form text,
// then processes these tasks for further scheduling. It provides real-time
// feedback on the processing state, error messages, and options to adjust or retry.

import React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Info, Loader2, Lock, Unlock, XCircle, Bug } from "lucide-react"
import { ProcessedStories } from "@/app/features/brain-dump"
import { useBrainDump } from "../hooks/useBrainDump"
import type { ProcessedStory } from "@/lib/types"

interface BrainDumpFormProps {
  // Optional callback that will be called when tasks are processed
  onTasksProcessed?: (stories: ProcessedStory[]) => void
}

export const BrainDumpForm = ({ onTasksProcessed }: BrainDumpFormProps) => {
  // Retrieve state and event handlers from our custom brain dump hook.
  // This hook handles task input, processing state, errors, and actions like retrying
  // or creating a work plan based on processed stories.
  const {
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    isProcessing,
    isCreatingWorkPlan,
    processingStep,
    processingProgress,
    error,
    processTasks,
    handleCreateWorkPlan,
    handleDurationChange,
    handleRetry
  } = useBrainDump(onTasksProcessed)

  return (
    <>
      {/* Header Section: Title, description, and processing indicator */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Brain Dump</h2>
          <p className="text-sm text-muted-foreground">
            Enter your tasks, one per line. Just brain dump everything you need to do...
          </p>
        </div>
        <div className="w-[48px] shrink-0">
          {isProcessing ? (
            // When processing tasks, show a circular progress indicator and the current step.
            <div className="relative">
              <CircularProgress 
                progress={processingProgress} 
                size={48}
                className="bg-background rounded-full shadow-sm"
              />
              <div className="absolute top-full mt-1 right-0 text-xs text-muted-foreground whitespace-nowrap">
                {processingStep}
              </div>
            </div>
          ) : (
            // When not processing, display a lock icon if the input is locked.
            <div className="w-[48px] h-[48px] flex items-center justify-center">
              {isInputLocked && <Lock className="h-5 w-5 text-muted-foreground" />}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Error Alert: Shown when processing encounters an error */}
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <div className="flex items-start gap-2">
              {/* Use different icons based on the error type */}
              {error.code === 'PARSING_ERROR' ? (
                <Bug className="h-4 w-4 mt-1" />
              ) : (
                <XCircle className="h-4 w-4 mt-1" />
              )}
              <div className="space-y-2 flex-1">
                <AlertTitle>
                  {error.code === 'PARSING_ERROR' ? 'AI Processing Error' : 'Error Processing Tasks'}
                </AlertTitle>
                <AlertDescription>
                  <p>{error.message}</p>
                  {error.details && (
                    // Show technical details to help with debugging, if available.
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Technical Details:</div>
                      <pre className="text-xs bg-destructive/10 p-2 rounded-md overflow-auto max-h-32">
                        {typeof error.details === 'string' 
                          ? error.details 
                          : JSON.stringify(error.details, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                  {/* Button to retry processing tasks */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={handleRetry}
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Alert: Display input format tips to help users enter well-structured tasks */}
        <Alert>
          <div className="flex w-full justify-end items-start gap-2">
            <Info className="h-4 w-4" />
            <div className="text-right">
              <AlertTitle>Input Format Tips</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Start with action verbs: "Create", "Review", "Update", etc.</li>
                  <li>• Add time estimates (optional): "2 hours of work on Project X"</li>
                  <li>• Mark priorities: Add <span className="font-medium text-primary">FROG</span> to indicate high-priority tasks</li>
                  <li>• Add deadlines (optional): "Complete by Friday" or "Due: 3pm"</li>
                  <li>• Group related tasks: Use similar prefixes for related items</li>
                  <li>• Be specific: "Review Q1 metrics report" vs "Review report"</li>
                </ul>
                <div className="mt-2 text-sm font-medium">Examples:</div>
                <pre className="mt-1 text-sm bg-muted p-2 rounded-md">
                  Create landing page mockup for client FROG{"\n"}
                  Review Q1 metrics report - 30 mins{"\n"}
                  Update team documentation - flexible{"\n"}
                  Complete project proposal by EOD{"\n"}
                  Daily standup and team sync
                </pre>
              </AlertDescription>
            </div>
          </div>
        </Alert>

        {/* Task Input Area */}
        <div className="relative">
          <Textarea
            className={`min-h-[200px] font-mono ${isInputLocked ? 'opacity-50' : ''}`}
            placeholder={`Task 1
Task 2 FROG
Task 3 - flexible
Task 4 - due by 5pm`}
            value={tasks}
            // Only update tasks if input is not locked.
            onChange={(e) => !isInputLocked && setTasks(e.target.value)}
            disabled={isInputLocked}
          />
          {/* If input is locked, display an overlay indicating the locked state */}
          {isInputLocked && (
            <div className="absolute inset-0 bg-background/5 backdrop-blur-[1px] rounded-md flex items-center justify-center">
              <div className="bg-background/90 px-4 py-2 rounded-md shadow-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Input locked</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons: Clear/Unlock or Process Tasks */}
        <div className="flex justify-end gap-2">
          {processedStories.length > 0 && (
            // When there are processed stories, allow users to clear them and unlock the input.
            <Button 
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              Clear & Unlock
            </Button>
          )}
          <Button 
            onClick={() => processTasks(false)}
            disabled={!tasks.trim() || isProcessing || isInputLocked}
            className="w-32"
          >
            {/* Show different button content based on processing state */}
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : isInputLocked ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Locked
              </>
            ) : (
              'Process Tasks'
            )}
          </Button>
        </div>

        {/* Render the ProcessedStories component which:
              - Displays the processed tasks/stories.
              - Allows users to adjust task durations.
              - Provides actions to retry or create a work plan. */}
        <ProcessedStories 
          stories={processedStories}
          editedDurations={editedDurations}
          isCreatingWorkPlan={isCreatingWorkPlan}
          onDurationChange={handleDurationChange}
          onRetry={handleRetry}
          onCreateWorkPlan={handleCreateWorkPlan}
        />
      </div>
    </>
  )
}
