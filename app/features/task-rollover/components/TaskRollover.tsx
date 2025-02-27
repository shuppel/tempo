"use client";

/**
 * TaskRollover Component
 * 
 * This component provides the UI for managing task rollover from previous sessions.
 * It presents a dialog asking users if they've completed their previous tasks,
 * and allows them to select which incomplete tasks to carry over to the new session.
 * 
 * FIXED ISSUES:
 * - Hydration errors with invalid HTML: Fixed by ensuring proper HTML hierarchy
 *   (removed div elements from inside paragraph elements)
 * 
 * - Maximum update depth exceeded: Fixed by:
 *   1. Using refs to track component lifecycle and initialization
 *   2. Implementing controlled state updates with explicit checks
 *   3. Ensuring effects have proper dependencies and safeguards
 *   4. Adding clear logging for debugging state flow
 * 
 * - State update loops: Fixed by:
 *   1. Using refs to track one-time operations (hasAddedTasks)
 *   2. Adding guards to prevent redundant updates
 *   3. Carefully controlling dialog open/close behavior
 * 
 * COMPONENT LIFECYCLE:
 * 1. Component mounts: Checks once for incomplete tasks
 * 2. If tasks found: Shows confirmation dialog
 * 3. User chooses to roll over tasks: Shows selection dialog
 * 4. Task selection: Tasks are prepared for brain dump
 * 5. Completion: Selected tasks are sent to brain dump component
 */

import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock,
  CheckCircle,
  Trash2,
  ArrowRight,
  CheckCheck, 
  X,
  AlertCircle,
  Square,
  CheckSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/durationUtils";
import { useTaskRollover, IncompleteTask } from "../hooks/useTaskRollover";

export interface TaskRolloverProps {
  onCompletedTasksAdded?: (tasksText: string) => void;
}

export function TaskRollover({ onCompletedTasksAdded }: TaskRolloverProps) {
  // Reference to track if we've handled task addition to prevent infinite loops
  const hasAddedTasks = useRef(false);
  
  // Reference to track initialization
  const didInitialize = useRef(false);
  
  // Manually track if we should show the finish question to avoid state update loops
  const [showFinishQuestion, setShowFinishQuestion] = useState(false);
  
  const {
    isOpen,
    setIsOpen,
    hasIncompleteTasks,
    isLoading,
    recentSession,
    incompleteTasks,
    selectedCount,
    brainDumpText,
    toggleTaskSelection,
    selectAllTasks,
    deselectAllTasks,
    completeTask,
    deleteTask,
    finishRollover,
    closeAndDiscard,
    debriefPreviousSession,
    checkForIncompleteTasks
  } = useTaskRollover();

  // One-time initialization effect (with no dependencies)
  useEffect(() => {
    // Only run this once
    if (didInitialize.current) return;
    
    didInitialize.current = true;
    console.log("[TaskRollover] Component initialized");
    
    // Let the browser paint before checking
    const timeoutId = setTimeout(() => {
      checkForIncompleteTasks().then(() => {
        console.log("[TaskRollover] Initial check complete", { hasIncompleteTasks });
      });
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Show the finish question dialog if we have incomplete tasks
  useEffect(() => {
    // Skip if already initialized or if loading
    if (isLoading) return;
    
    // Only show question if there are actually incomplete tasks
    if (hasIncompleteTasks && incompleteTasks.length > 0 && !showFinishQuestion && !isOpen) {
      console.log("[TaskRollover] Showing finish question");
      setShowFinishQuestion(true);
    }
  }, [hasIncompleteTasks, incompleteTasks.length, isLoading, isOpen, showFinishQuestion]);

  // Handle adding tasks to Brain Dump when rollover is finished
  // This runs only once when dialog closes with tasks
  useEffect(() => {
    // Only run this block when dialog has just closed (isOpen changed to false)
    // AND we have tasks to add AND we haven't already added them
    if (
      !isOpen && 
      brainDumpText && 
      brainDumpText.trim() !== "" && 
      onCompletedTasksAdded && 
      !hasAddedTasks.current
    ) {
      console.log("[TaskRollover] Adding tasks to Brain Dump");
      try {
        // Prevent repeated calls
        hasAddedTasks.current = true;
        onCompletedTasksAdded(brainDumpText);
      } catch (error) {
        console.error("Error adding tasks to Brain Dump:", error);
      }
    }
    
    // If dialog opens, reset the flag
    if (isOpen) {
      hasAddedTasks.current = false;
    }
  }, [isOpen, brainDumpText, onCompletedTasksAdded]);

  // Handle "Did you finish everything?" dialog responses
  const handleFinishedYes = () => {
    console.log("[TaskRollover] User finished tasks, going to debrief");
    setShowFinishQuestion(false);
    debriefPreviousSession();
  };

  const handleFinishedNo = () => {
    console.log("[TaskRollover] User needs rollover, opening dialog");
    setShowFinishQuestion(false);
    setIsOpen(true);
  };

  const handleTaskRolloverComplete = () => {
    console.log("[TaskRollover] Completing task rollover");
    try {
      // If the dialog isn't open, don't do anything
      if (!isOpen) return;
      
      finishRollover();
    } catch (error) {
      console.error("Error completing task rollover:", error);
    }
  };

  return (
    <>
      {/* "Did you finish everything?" question dialog */}
      <AlertDialog 
        open={showFinishQuestion} 
        onOpenChange={(open) => {
          if (!open) {
            console.log("[TaskRollover] Finish question dialog closed");
            setShowFinishQuestion(false);
          }
        }}
      >
        <AlertDialogContent className="border-0 rounded-md max-w-xl dark:border dark:border-gray-700">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">Previous Tasks Pending</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-gray-600 dark:text-gray-300">
              <div className="space-y-4">
                <p className="leading-relaxed">
                  You have incomplete tasks from your session on
                  {recentSession && (
                    <span className="font-medium ml-1 text-gray-900 dark:text-white">
                      {format(parseISO(recentSession.date), "EEEE, MMMM d")}
                    </span>
                  )}.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                    Session Review Required
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Would you like to complete these tasks in your previous session, or transfer them to your current plan?
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-3 pt-2">
            <AlertDialogCancel 
              className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              onClick={() => {
                console.log("[TaskRollover] Finish question canceled");
                setShowFinishQuestion(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinishedYes}
              className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Complete in Previous Session
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleFinishedNo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Transfer to Current Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Rollover Management Dialog */}
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          console.log("[TaskRollover] Dialog open change:", open);
          // Set the internal state directly, don't rely on cascading effects
          setIsOpen(open);
          
          // If dialog is closing with no selection action, treat as "cancel"
          if (!open && !hasAddedTasks.current) {
            console.log("[TaskRollover] Dialog closed without selecting tasks");
            closeAndDiscard();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col rounded-md border-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <DialogTitle className="text-xl font-semibold tracking-tight">Task Transfer</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-300 pt-1.5">
              {recentSession ? (
                <span>
                  Select tasks from your <span className="font-medium text-gray-800 dark:text-gray-200">{format(parseISO(recentSession.date), "MMMM d")}</span> session to transfer to today's plan
                </span>
              ) : (
                <span>Select tasks from your previous session</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col px-6 py-4 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin h-6 w-6 border-3 border-gray-300 border-t-gray-800 dark:border-gray-600 dark:border-t-gray-300 rounded-full"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading tasks...</span>
              </div>
            ) : incompleteTasks.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedCount} of {incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log("[TaskRollover] Selecting all tasks");
                        selectAllTasks();
                      }}
                      className="h-8 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log("[TaskRollover] Deselecting all tasks");
                        deselectAllTasks();
                      }}
                      className="h-8 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {incompleteTasks.map((item, index) => (
                    <TaskItem
                      key={`${item.storyId}-${item.timeBoxIndex}-${item.taskIndex}`}
                      task={item}
                      index={index}
                      onToggle={toggleTaskSelection}
                      onComplete={completeTask}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <CheckCheck className="h-10 w-10 mb-3" />
                <p className="text-center">
                  No incomplete tasks found in your previous session
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount > 0
                ? `${selectedCount} task${selectedCount !== 1 ? 's' : ''} will be transferred to your current plan`
                : "No tasks selected"}
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  console.log("[TaskRollover] Cancel button clicked");
                  closeAndDiscard();
                }}
              >
                Cancel
              </Button>
              <Button 
                className={`${selectedCount > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'} text-white`}
                onClick={() => {
                  console.log("[TaskRollover] Add to Brain Dump button clicked");
                  handleTaskRolloverComplete();
                }}
                disabled={selectedCount === 0}
              >
                Transfer Tasks
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TaskItemProps {
  task: IncompleteTask;
  index: number;
  onToggle: (index: number) => void;
  onComplete: (index: number) => Promise<void>;
  onDelete: (index: number) => void;
}

function TaskItem({ task, index, onToggle, onComplete, onDelete }: TaskItemProps) {
  const [isCompletingTask, setIsCompletingTask] = useState(false);

  const handleComplete = async () => {
    setIsCompletingTask(true);
    try {
      await onComplete(index);
    } finally {
      setIsCompletingTask(false);
    }
  };

  return (
    <div className="flex items-start gap-3 border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="mt-0.5">
        <button 
          type="button"
          className={cn(
            "h-5 w-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
            task.selected 
              ? "bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400" 
              : "border-gray-300 dark:border-gray-600"
          )}
          onClick={() => onToggle(index)}
          aria-label={task.selected ? "Deselect task" : "Select task"}
        >
          {task.selected && (
            <CheckSquare className="h-4 w-4" />
          )}
        </button>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
            {task.task.title}
          </h4>
          {task.task.isFrog && (
            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 font-normal text-xs">
              Priority
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.task.duration ? formatDuration(task.task.duration) : "No duration"}
          </span>
          <span className="text-gray-400 dark:text-gray-500">•</span>
          <span>Category: {task.storyTitle}</span>
        </div>
      </div>
      
      <div className="flex gap-1 ml-2">
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 bg-transparent hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={handleComplete}
          disabled={isCompletingTask}
          aria-label="Mark as completed"
          title="Mark as completed"
        >
          {isCompletingTask ? (
            <div className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-red-600 bg-transparent hover:bg-gray-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-800 transition-colors"
          onClick={() => onDelete(index)}
          aria-label="Remove from list"
          title="Remove from list"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
} 