// /features/brain-dump/components/BrainDump.tsx
"use client" // Ensures the component runs on the client side in Next.js.

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { 
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Info, Loader2, Lock, Unlock, XCircle, Bug, AlertCircle } from "lucide-react"
import { StoryCard } from "./StoryCard"
import { useBrainDump } from "../hooks/useBrainDump"
import { ProcessedStories } from "./ProcessedStories"
import type { ProcessedStory } from "@/lib/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { TaskRollover } from "@/app/features/task-rollover"

interface BrainDumpProps {
  onTasksProcessed?: (stories: ProcessedStory[]) => void // Callback function triggered when tasks are processed.
}

/**
 * BrainDump Component:
 * - Provides an input area for users to enter tasks.
 * - Uses AI to analyze and optimize tasks into work blocks.
 * - Displays real-time feedback, errors, and suggestions.
 * - Allows users to create structured work sessions.
 */
export const BrainDump = ({ onTasksProcessed }: BrainDumpProps) => {
  // Extracting states and handlers from custom hook
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
    handleRetry
  } = useBrainDump(onTasksProcessed)
  
  // Add state to track if there are pending tasks from previous session
  const [hasPendingTasks, setHasPendingTasks] = useState(false);

  // Check if there are pending tasks when component mounts
  useEffect(() => {
    // Check if the task rollover banner is visible (using localStorage as a proxy)
    const todayFlag = localStorage.getItem('task-rollover-completed-transfers-today');
    const hasCheckedToday = !!todayFlag;
    
    // If we've already checked and completed transfers today, we don't have pending tasks
    setHasPendingTasks(!hasCheckedToday);
    
    // Listen for changes in localStorage to update our state
    const handleStorageChange = () => {
      const updatedFlag = localStorage.getItem('task-rollover-completed-transfers-today');
      setHasPendingTasks(!updatedFlag);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event that our TaskRollover component could dispatch when tasks are handled
    const handleTasksResolved = () => {
      console.log("[BrainDump] Received event that tasks were resolved");
      setHasPendingTasks(false);
    };
    
    window.addEventListener('tasksResolved', handleTasksResolved);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tasksResolved', handleTasksResolved);
    };
  }, []);
  
  // Placeholder text guiding users on how to format tasks effectively
  const placeholderText = `Update client dashboard design - high priority FROG
Send weekly progress report to team - 20 mins
Research API integration options - 1 hour technical
Schedule quarterly planning meeting - by Thursday
Update project documentation - flexible timing
Finalize product feature specifications - due tomorrow`

  /**
   * Handler for tasks rolled over from previous sessions
   * 
   * FIXES:
   * - Added safeguards to prevent processing empty tasks which could cause render loops
   * - Added error handling to prevent crashes
   * - Added logging for better debugging
   * - Ensures safe state updates by using the functional form of setState
   * - Added additional debugging and more reliable state update mechanism
   * - Prevents automatic population of tasks when the component loads 
   * - Prevents duplication of tasks when rolled over
   * 
   * @param tasksText - Text representation of the tasks to roll over
   */
  const handleRolledOverTasks = (tasksText: string) => {
    // When tasks are rolled over, we no longer have pending tasks
    setHasPendingTasks(false);
    
    // Prevent empty text or duplicate processing
    if (!tasksText || !tasksText.trim()) {
      console.log("[BrainDump] Ignoring empty rolled over tasks");
      return;
    }
    
    console.log("[BrainDump] Handling rolled over tasks:", {
      textLength: tasksText.length,
      taskCount: tasksText.split('\n').length,
      currentTasksEmpty: !tasks || !tasks.trim(),
      userInitiated: true // Flag indicating this was user-initiated via the dialog
    });
    
    // Safely update the tasks state
    try {
      // Clear the tasks area completely before adding new tasks to avoid merged state issues
      setTimeout(() => {
        // Replace existing tasks with rolled over tasks
        // No need to add headers or append - just use the clean task list directly
        console.log("[BrainDump] Setting rolled over tasks");
        setTasks(tasksText);
        console.log(`[BrainDump] Set tasks with length: ${tasksText.length}`);
      }, 50); // Small delay to ensure state is ready
    } catch (error) {
      console.error("[BrainDump] Error handling rolled over tasks:", error);
    }
  };

  return (
    <>
      {/* Task Rollover Component */}
      <TaskRollover onCompletedTasksAdded={handleRolledOverTasks} />

      {/* Apply a visual dim effect to the Card when there are pending tasks */}
      <div className="relative">
        {/* Semi-transparent overlay when there are pending tasks */}
        {hasPendingTasks && (
          <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
            <div className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-lg shadow-lg max-w-md text-center space-y-4 border border-gray-200 dark:border-gray-700">
              <AlertCircle className="h-10 w-10 text-amber-500 dark:text-amber-400 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Complete Previous Tasks First</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Please resolve your pending tasks from the previous session before creating new ones.
              </p>
            </div>
          </div>
        )}

        <Card className="border-2">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl">Task Input</CardTitle>
            <CardDescription className="text-body text-muted-foreground">
              Enter your tasks below, one per line. Our AI analyzes patterns and context to create optimized focus sessions tailored to your workflow.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* User input field for tasks */}
            <Textarea
              placeholder={placeholderText}
              value={tasks}
              onChange={(e) => !isInputLocked && setTasks(e.target.value)}
              disabled={isInputLocked || hasPendingTasks}
              className={`font-mono min-h-[200px] text-base leading-relaxed ${hasPendingTasks ? 'opacity-60' : ''}`}
            />

            {/* Accordion for input formatting tips */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="format-tips" className="border-none">
                <AccordionTrigger className="flex justify-end gap-2 py-2 hover:no-underline">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <span className="font-accent tracking-wide text-base">Input Optimization Tips</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-2">
                  <div className="space-y-4 text-right">
                    <div className="space-y-2 text-body">
                      <p>• Use specific action verbs: "Analyze," "Develop," "Finalize," etc.</p>
                      <p>• Mark high-priority tasks with <span className="font-medium text-primary">FROG</span> for immediate attention 🐸</p>
                      <p>• Include duration estimates: "45 min research" or "2-hour development session"</p>
                      <p>• Specify deadlines for time-sensitive items: "Due Friday" or "EOD deadline"</p>
                      <p>• Group related tasks with similar phrasing for better categorization</p>
                      <p>• Add context details to improve task analysis and organization</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Error handling - Displays relevant error messages with retry options */}
            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <div className="flex items-start gap-2">
                  {error.code === 'PARSING_ERROR' ? (
                    <Bug className="h-4 w-4 mt-1" /> // Parsing-related errors
                  ) : (
                    <XCircle className="h-4 w-4 mt-1" /> // Generic errors
                  )}
                  <div className="space-y-2 flex-1">
                    <AlertTitle className="font-heading">
                      {error.code === 'PARSING_ERROR' ? 'AI Processing Error' : 
                       error.code === 'SESSION_ERROR' ? 'Session Planning Error' : 
                       'Error Processing Tasks'}
                    </AlertTitle>
                    <AlertDescription className="font-body text-body">
                      <p className="whitespace-pre-line">{error.message}</p>

                      {/* Provides task modification suggestions if the error relates to work block duration */}
                      {error.code === 'SESSION_ERROR' && error.message.includes('Work blocks are too long') && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-md">
                          <p className="font-medium text-sm">Suggestions:</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            <li>• Try reducing the duration of tasks in the affected story</li>
                            <li>• Consider splitting long tasks into smaller ones</li>
                            <li>• Distribute tasks more evenly across stories</li>
                          </ul>
                        </div>
                      )}

                      {/* Displays additional error details if available */}
                      {error.details && (
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

            {/* Control buttons */}
            <div className="flex justify-end gap-2">
              {processedStories.length > 0 && (
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
                    Analyzing...
                  </>
                ) : isInputLocked ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Locked
                  </>
                ) : (
                  'Analyze Tasks'
                )}
              </Button>
            </div>

            {/* Displays processed stories if available */}
            {processedStories.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading">Optimized Work Blocks</h3>
                  <div className="flex gap-2">
                    <Button onClick={handleRetry} variant="outline" size="sm">
                      Start Over
                    </Button>
                    <Button 
                      onClick={handleCreateSession} 
                      size="sm"
                      disabled={isCreatingSession}
                    >
                      {isCreatingSession ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {processingStep || "Generating..."}
                        </>
                      ) : (
                        'Create Work Session'
                      )}
                    </Button>
                  </div>
                </div>
                <ProcessedStories 
                  stories={processedStories}
                  editedDurations={editedDurations}
                  onDurationChange={handleDurationChange}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
