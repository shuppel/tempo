// /features/brain-dump/components/BrainDumpForm.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Info, Loader2, Lock, Unlock, XCircle, Bug } from "lucide-react";
import { ProcessedStories } from "./ProcessedStories";
import { useBrainDump } from "../hooks/useBrainDump";
import type { ProcessedStory } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";

interface BrainDumpFormProps {
  onTasksProcessed?: (stories: ProcessedStory[]) => void;
}

export const BrainDumpForm = ({ onTasksProcessed }: BrainDumpFormProps) => {
  const {
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    isProcessing,
    isCreatingSession,
    processingStep,
    processingProgress,
    error,
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry,
  } = useBrainDump(onTasksProcessed);

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Brain Dump</h2>
          <p className="text-sm text-muted-foreground">
            Enter your tasks, one per line. Just brain dump everything you need
            to do...
          </p>
        </div>
        <div className="w-[48px] shrink-0">
          {isProcessing ? (
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
            <div className="w-[48px] h-[48px] flex items-center justify-center">
              {isInputLocked && (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <div className="flex items-start gap-2">
              {error.code === "PARSING_ERROR" ? (
                <Bug className="h-4 w-4 mt-1" />
              ) : (
                <XCircle className="h-4 w-4 mt-1" />
              )}
              <div className="space-y-2 flex-1">
                <AlertTitle>
                  {error.code === "PARSING_ERROR"
                    ? "AI Processing Error"
                    : "Error Processing Tasks"}
                </AlertTitle>
                <AlertDescription>
                  <p>{error.message}</p>
                  {typeof error.details === "string" ||
                  typeof error.details === "object" ? (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">
                        Technical Details:
                      </div>
                      <pre
                        className="text-xs bg-destructive/10 p-2 rounded-md overflow-auto max-h-32"
                        dangerouslySetInnerHTML={{
                          __html: escapeHtml(
                            String(
                              typeof error.details === "string"
                                ? error.details
                                : JSON.stringify(error.details, null, 2),
                            ),
                          ),
                        }}
                      />
                    </div>
                  ) : null}
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

        <Alert>
          <div className="flex w-full justify-end items-start gap-2">
            <Info className="h-4 w-4" />
            <div className="text-right">
              <AlertTitle>Input Format Tips</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>
                    • Start with action verbs:{" "}
                    {escapeHtml('"Create", "Review", "Update", etc.')}
                  </li>
                  <li>
                    • Add time estimates (optional):{" "}
                    {escapeHtml('"2 hours of work on Project X"')}
                  </li>
                  <li>
                    • Mark priorities: Add{" "}
                    <span className="font-medium text-primary">FROG</span> to
                    indicate high-priority tasks
                  </li>
                  <li>
                    • Add deadlines (optional):{" "}
                    {escapeHtml('"Complete by Friday" or "Due: 3pm"')}
                  </li>
                  <li>
                    • Group related tasks: Use similar prefixes for related
                    items
                  </li>
                  <li>
                    • Be specific:{" "}
                    {escapeHtml(
                      '"Review Q1 metrics report" vs "Review report"',
                    )}
                  </li>
                </ul>
                <div className="mt-2 text-sm font-medium">Examples:</div>
                <pre
                  className="mt-1 text-sm bg-muted p-2 rounded-md"
                  dangerouslySetInnerHTML={{
                    __html: escapeHtml(
                      `Create landing page mockup for client FROG\nReview Q1 metrics report - 30 mins\nUpdate team documentation - flexible\nComplete project proposal by EOD\nDaily standup and team sync`,
                    ),
                  }}
                />
              </AlertDescription>
            </div>
          </div>
        </Alert>

        <div className="relative">
          <Textarea
            className={`min-h-[200px] font-mono ${isInputLocked ? "opacity-50" : ""}`}
            placeholder={`Task 1
Task 2 FROG
Task 3 - flexible
Task 4 - due by 5pm`}
            value={tasks}
            onChange={(e) => !isInputLocked && setTasks(e.target.value)}
            disabled={isInputLocked}
          />
          {isInputLocked && (
            <div className="absolute inset-0 bg-background/5 backdrop-blur-[1px] rounded-md flex items-center justify-center">
              <div className="bg-background/90 px-4 py-2 rounded-md shadow-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Input locked</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {isInputLocked && (
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
              "Process Tasks"
            )}
          </Button>
        </div>

        <ProcessedStories
          stories={processedStories}
          editedDurations={editedDurations}
          isCreatingSession={isCreatingSession}
          onDurationChange={handleDurationChange}
          onRetry={handleRetry}
          onCreateSession={handleCreateSession}
        />
      </div>
    </>
  );
};
