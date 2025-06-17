// /features/brain-dump/components/BrainDump.tsx
"use client"; // Ensures the component runs on the client side in Next.js.

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Lock,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  Clock,
  InfoIcon,
  TimerOff,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { useBrainDump } from "../hooks/useBrainDump";
import { ProcessedStories } from "./ProcessedStories";
import type { ProcessedStory } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BrainDumpProps {
  onTasksProcessed?: (stories: ProcessedStory[]) => void;
}

/**
 * BrainDump Component:
 * - Provides an input area for users to enter tasks.
 * - Uses AI to analyze and optimize tasks into work blocks.
 * - Displays real-time feedback, errors, and suggestions.
 * - Allows users to create structured work sessions.
 */
export const BrainDump = ({ onTasksProcessed }: BrainDumpProps) => {
  const [showTips, setShowTips] = useState(false);
  const {
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    isProcessing,
    isCreatingSession,
    processingStep,
    error,
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry,
  } = useBrainDump(onTasksProcessed);

  const taskProcessingError = isProcessing ? error : null;
  const sessionCreationError = isCreatingSession ? null : error;
  const sessionCreationStep = processingStep;

  const handleProcessTasks = useCallback(() => {
    processTasks(false);
  }, [processTasks]);

  const analyzeButtonContent = useMemo(() => {
    if (isProcessing) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing
        </>
      );
    } else if (isInputLocked) {
      return (
        <>
          <Lock className="mr-2 h-4 w-4" />
          Locked
        </>
      );
    } else {
      return "Analyze";
    }
  }, [isProcessing, isInputLocked]);

  const MemoizedHelpCircle = useMemo(
    () => <HelpCircle className="h-4 w-4" />,
    [],
  );

  // Helper function to parse and format error details
  const formatErrorDetails = (
    error: import("../types").ErrorDetails | null | undefined,
  ):
    | {
        totalHours: number;
        maxHours: number;
        suggestion: string;
      }
    | {
        missingTasks: string[];
        scheduledCount: number;
        originalCount: number;
      }
    | Record<string, unknown>
    | null => {
    if (!error || !error.details) return null;

    try {
      if (error.code === "DURATION_EXCEEDED") {
        const details = error.details as Record<string, unknown>;
        return {
          totalHours: Math.round(Number(details.totalDuration || 0) / 60),
          maxHours: Math.round(Number(details.maxDuration || 0) / 60),
          suggestion: String(details.suggestion || ""),
        };
      }

      if (error.code === "MISSING_TASKS") {
        const details = error.details as Record<string, unknown>;
        return {
          missingTasks: Array.isArray(details.missingTasks)
            ? (details.missingTasks as string[])
            : [],
          scheduledCount: Number(details.scheduledCount || 0),
          originalCount: Number(details.originalCount || 0),
        };
      }

      // Generic fallback for other error types
      const generic = error.details as Record<string, unknown>;
      if (generic && Object.keys(generic).length > 0) {
        return generic;
      }
      return null;
    } catch (e) {
      console.error("Error parsing error details:", e);
      return null;
    }
  };

  return (
    <Card className="border bg-card">
      <CardContent className="p-4 space-y-4">
        <div className="relative">
          <Textarea
            placeholder={`task .init\nUpdate client dashboard design 🐸\nSend weekly progress report - 20m\nResearch API integration - 1h\nSchedule team meeting - by Thursday\nUpdate project docs\nFinalize product specs - EOD`.replace(
              /"/g,
              "&quot;",
            )}
            value={tasks}
            onChange={(e) => setTasks(e.target.value)}
            disabled={isInputLocked}
            className="min-h-[150px] font-mono text-base"
          />
          <div className="absolute top-2 right-2">
            <TooltipProvider>
              <Tooltip open={showTips} onOpenChange={setShowTips}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {MemoizedHelpCircle}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-xs text-sm"
                >
                  <div className="space-y-2">
                    <p>Effective task entry tips:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Use clear, actionable verbs</li>
                      <li>Estimate time: &quot;30m design review&quot;</li>
                      <li>Prioritize with 🐸 FROG for critical tasks</li>
                      <li>Add context: deadlines, project names</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      <Link
                        href="/docs/task-optimization"
                        className="underline"
                      >
                        Learn more about task optimization
                      </Link>
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <span>Analyze to optimize</span>
          </div>
          <Button
            onClick={handleProcessTasks}
            disabled={!tasks.trim() || isProcessing || isInputLocked}
            className="w-32"
          >
            {analyzeButtonContent}
          </Button>
        </div>

        {taskProcessingError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 shadow-sm">
            <div className="bg-destructive/10 px-4 py-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h4 className="font-medium text-destructive">
                Error analyzing tasks
              </h4>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm">{taskProcessingError.message}</p>

              <div className="flex items-center justify-end mt-3 pt-2 border-t border-border/30">
                <Button
                  onClick={() => handleRetry()}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Try again</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {processedStories.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Work Blocks</h3>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" size="sm">
                  Reset
                </Button>
                <Button
                  onClick={handleCreateSession}
                  size="sm"
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {sessionCreationStep || "Creating"}
                    </>
                  ) : (
                    "Create Session"
                  )}
                </Button>
              </div>
            </div>

            {sessionCreationError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 shadow-sm overflow-hidden">
                <div className="bg-destructive/10 px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h4 className="font-medium text-destructive">
                    Session creation failed
                  </h4>
                </div>

                <div className="p-4 space-y-3">
                  <p className="text-sm">{sessionCreationError.message}</p>

                  {sessionCreationError.code === "DURATION_EXCEEDED" && (
                    <div className="mt-3 bg-background/50 rounded-md p-3 border border-border/50">
                      <div className="flex items-start gap-2">
                        <TimerOff className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">
                            Duration Limit Exceeded
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(() => {
                              const details =
                                formatErrorDetails(sessionCreationError);
                              if (
                                details &&
                                typeof details === "object" &&
                                "suggestion" in details &&
                                typeof details.suggestion === "string"
                              ) {
                                return (
                                  details.suggestion ||
                                  "Consider breaking this into multiple shorter sessions."
                                );
                              }
                              return "Consider breaking this into multiple shorter sessions.";
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {sessionCreationError.code === "MISSING_TASKS" && (
                    <div className="mt-3 rounded-md border border-border/50 overflow-hidden">
                      <div className="bg-background/80 p-3">
                        <div className="flex items-center gap-2">
                          <InfoIcon className="h-4 w-4 text-amber-500" />
                          <p className="text-sm font-medium">
                            Tasks Not Scheduled
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const details =
                              formatErrorDetails(sessionCreationError);
                            if (
                              details &&
                              "scheduledCount" in details &&
                              "originalCount" in details
                            ) {
                              return `Scheduled ${details.scheduledCount} of ${details.originalCount} tasks.`;
                            }
                            return "Some tasks could not be scheduled.";
                          })()}
                        </p>
                      </div>

                      {(() => {
                        const details =
                          formatErrorDetails(sessionCreationError);
                        if (
                          details &&
                          "missingTasks" in details &&
                          Array.isArray(details.missingTasks) &&
                          details.missingTasks.length > 0
                        ) {
                          return (
                            <div className="px-3 py-2 max-h-32 overflow-y-auto bg-background/40 border-t border-border/30">
                              <p className="text-xs font-medium mb-1">
                                Missing Tasks:
                              </p>
                              <ul className="text-xs space-y-1 ml-5 list-disc">
                                {details.missingTasks.map(
                                  (task: string, i: number) => (
                                    <li
                                      key={i}
                                      className="text-muted-foreground"
                                    >
                                      {String(task)}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {sessionCreationError.code === "EXCESSIVE_WORK_TIME" && (
                    <div className="mt-3 bg-background/50 rounded-md p-3 border border-border/50">
                      <div className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">
                            Excessive Work Time
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Try adding more breaks between your work sessions.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <LifeBuoy className="h-3.5 w-3.5 mr-1" />
                      <span>
                        Need help?{" "}
                        <a href="/docs/troubleshooting" className="underline">
                          Troubleshooting guide
                        </a>
                      </span>
                    </div>
                    <Button
                      onClick={() => handleCreateSession()}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Try again</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <ProcessedStories
              stories={processedStories}
              editedDurations={editedDurations}
              onDurationChange={handleDurationChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
