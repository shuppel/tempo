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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Previous Tasks Found</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                Did you finish everything you wanted to finish from the session on
                {recentSession && (
                  <span className="font-medium ml-1">
                    {format(parseISO(recentSession.date), "EEEE, MMMM d")}
                  </span>
                )}?

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-start gap-2 mt-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                      You have {incompleteTasks.length} incomplete tasks from your previous session.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      If you've completed them, please mark the session as done and debrief.
                      If not, you can carry them over to today.
                    </p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                console.log("[TaskRollover] Finish question canceled");
                setShowFinishQuestion(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinishedNo}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              No, I need to roll them over
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleFinishedYes}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Yes, go to debrief
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Task Rollover</DialogTitle>
            <DialogDescription>
              {recentSession ? (
                <span>
                  Select tasks from {format(parseISO(recentSession.date), "EEEE, MMMM d")} to add to today's plan
                </span>
              ) : (
                <span>Select tasks from your previous session</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col space-y-3 overflow-y-auto py-2 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                <span className="ml-3">Loading tasks...</span>
              </div>
            ) : incompleteTasks.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log("[TaskRollover] Selecting all tasks");
                      selectAllTasks();
                    }}
                    className="h-8"
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
                    className="h-8"
                  >
                    Deselect All
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} of {incompleteTasks.length} selected
                  </span>
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
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCheck className="h-12 w-12 text-green-500 mb-2" />
                <p className="text-center text-muted-foreground">
                  No incomplete tasks found
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} tasks will be added to your Brain Dump`
                : "No tasks selected"}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log("[TaskRollover] Cancel button clicked");
                  closeAndDiscard();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  console.log("[TaskRollover] Add to Brain Dump button clicked");
                  handleTaskRolloverComplete();
                }}
                disabled={selectedCount === 0}
              >
                Add to Brain Dump
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
  return (
    <div className="flex items-start gap-3 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 p-0 mt-1" 
        onClick={() => onToggle(index)}
      >
        {task.selected ? (
          <CheckSquare className="h-5 w-5 text-primary" />
        ) : (
          <Square className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="font-medium">
            {task.task.title}
          </h4>
          {task.task.isFrog && (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              FROG
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {task.task.duration ? formatDuration(task.task.duration) : "No duration"}
          </span>
          <span className="text-muted-foreground">•</span>
          <span>From: {task.storyTitle}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
          onClick={() => onComplete(index)}
          title="Mark as completed"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={() => onDelete(index)}
          title="Remove from list"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 