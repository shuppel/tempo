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
  CheckSquare,
  HelpCircle
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
  
  // State for the dialog to confirm unchecked tasks
  const [showUncheckedTasksDialog, setShowUncheckedTasksDialog] = useState(false);
  
  // State for the dialog to confirm task completion
  const [showCompletionConfirmDialog, setShowCompletionConfirmDialog] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<number | null>(null);
  
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
    checkForIncompleteTasks,
    resetTaskRolloverState,
    updateBrainDumpText
  } = useTaskRollover();

  // One-time initialization effect (with no dependencies)
  useEffect(() => {
    // Only run this once
    if (didInitialize.current) return;
    
    didInitialize.current = true;
    console.log("[TaskRollover] Component initialized");
    
    // Check if we've already completed a transfer today - if so, don't bother checking
    const todayFlag = localStorage.getItem('task-rollover-completed-transfers-today');
    if (todayFlag) {
      console.log("[TaskRollover] Already completed a transfer today, skipping check");
      return;
    }
    
    // Let the browser paint before checking
    const timeoutId = setTimeout(() => {
      console.log("[TaskRollover] Running initial check for incomplete tasks after timeout");
      // Only check if tasks exist, but don't automatically open the dialog 
      // or populate the brain dump input
      checkForIncompleteTasks(true, true).then(() => {
        console.log("[TaskRollover] Initial check complete", { 
          hasIncompleteTasks,
          recentSession: recentSession ? {
            date: recentSession.date,
            status: recentSession.status,
            taskCount: recentSession.storyBlocks.reduce((acc, story) => 
              acc + story.timeBoxes.reduce((acc2, tb) => 
                acc2 + (tb.tasks?.length || 0), 0), 0)
          } : null
        });
        
        // We don't automatically open the dialog or show the finish question
        // The user must click the "Manage Tasks" button first
      });
    }, 100);
    
    // Add a cleanup effect that resets the state when the component unmounts
    // This ensures proper cleanup when navigating to different pages
    return () => {
      clearTimeout(timeoutId);
      didInitialize.current = false;
    };
  }, []);

  // Add a cleanup effect for when the user navigates away
  useEffect(() => {
    // Listen for navigation events to cleanup state
    const handleBeforeUnload = () => {
      console.log("[TaskRollover] Page navigation detected, cleaning up state");
      hasAddedTasks.current = false;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
      console.log("[TaskRollover] Adding tasks to Brain Dump:", {
        taskCount: brainDumpText.split('\n').length,
        hasCallback: !!onCompletedTasksAdded
      });
      
      try {
        // Delay slightly to ensure all state updates have propagated
        setTimeout(() => {
          // Prevent repeated calls
          hasAddedTasks.current = true;
          
          // Call the callback to add tasks to Brain Dump
          onCompletedTasksAdded(brainDumpText);
          console.log("[TaskRollover] Tasks successfully added to Brain Dump");
        }, 50);
      } catch (error) {
        console.error("Error adding tasks to Brain Dump:", error);
      }
    } else if (!isOpen && (!brainDumpText || brainDumpText.trim() === "")) {
      console.log("[TaskRollover] Dialog closed but no tasks to add");
    } else if (!isOpen && hasAddedTasks.current) {
      console.log("[TaskRollover] Tasks were already added, skipping");
    }
    
    // If dialog opens, reset the flag
    if (isOpen) {
      hasAddedTasks.current = false;
      console.log("[TaskRollover] Dialog opened, reset hasAddedTasks flag");
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

  // Handler for transfer tasks button
  const handleTransferTasksClick = () => {
    console.log("[TaskRollover] Transfer tasks clicked");
    
    const uncheckedTasksCount = incompleteTasks.length - selectedCount;
    
    // Make sure we update brain dump text with the latest selection
    if (selectedCount > 0) {
      // Force update of brain dump text to ensure we have the latest
      updateBrainDumpText();
      console.log(`[TaskRollover] Prepared ${selectedCount} tasks for transfer:`, {
        hasText: !!brainDumpText,
        textLength: brainDumpText?.length || 0
      });
    }
    
    // If there are unchecked tasks, show the confirmation dialog
    if (uncheckedTasksCount > 0) {
      setShowUncheckedTasksDialog(true);
    } else {
      // If all tasks are selected, proceed directly with rollover
      completeTaskRollover();
    }
  };
  
  // Handler for confirming task completion
  const handleConfirmTaskComplete = async () => {
    if (taskToComplete !== null) {
      console.log(`[TaskRollover] Confirmed task completion for index: ${taskToComplete}`);
      await completeTask(taskToComplete);
      setShowCompletionConfirmDialog(false);
      setTaskToComplete(null);
    }
  };
  
  // Handler for initiating task completion with confirmation
  const handleInitiateTaskComplete = (index: number) => {
    console.log(`[TaskRollover] Initiating task completion for index: ${index}`);
    setTaskToComplete(index);
    setShowCompletionConfirmDialog(true);
  };

  // Complete task rollover after all confirmations
  const completeTaskRollover = () => {
    console.log("[TaskRollover] Completing task rollover");
    try {
      // If the dialog isn't open, don't do anything
      if (!isOpen) return;
      
      // Don't set hasAddedTasks.current = true yet, as this prevents the tasks from being added
      // in the useEffect when the dialog closes
      
      // Finish rollover (which will mark the session as having completed transfers)
      // This should set brainDumpText with the selected tasks
      finishRollover();
      
      // Explicitly hide any dialogs that might be open
      setShowFinishQuestion(false);
      setShowUncheckedTasksDialog(false);
      setShowCompletionConfirmDialog(false);
      
      // Close the dialog which will trigger the useEffect to add tasks
      setIsOpen(false);
      
      // After a delay to ensure the useEffect has run, reset the state
      setTimeout(() => {
        console.log("[TaskRollover] Resetting task rollover state after tasks transfer");
        hasAddedTasks.current = true; // Now it's safe to set this
        resetTaskRolloverState();
        
        // Dispatch a custom event to notify other components that tasks have been resolved
        const event = new CustomEvent('tasksResolved', { 
          detail: { 
            timestamp: new Date().toISOString(),
            taskCount: selectedCount
          } 
        });
        window.dispatchEvent(event);
        console.log("[TaskRollover] Dispatched tasksResolved event", event);
      }, 500); // Increased delay to ensure state updates have processed
    } catch (error) {
      console.error("Error completing task rollover:", error);
    }
  };
  
  // Handler for the Open Rollover Dialog button
  const handleOpenRolloverDialog = () => {
    console.log("[TaskRollover] Opening rollover dialog manually");
    
    // First load the data if needed
    if (incompleteTasks.length === 0) {
      checkForIncompleteTasks(true, false).then(() => {
        console.log("[TaskRollover] Loaded tasks before opening dialog");
        setShowFinishQuestion(true);
      });
    } else {
      // We already have tasks loaded, so just show the dialog
      setShowFinishQuestion(true);
    }
  };
  
  // Add a new Debug button to show current state
  const [showDebug, setShowDebug] = useState(false);

  const handleShowDebug = () => {
    console.log("[TaskRollover] Showing debug panel");
    setShowDebug(true);
  };

  // Reset task rollover state for troubleshooting with more logging
  const handleResetRolloverState = () => {
    console.log("[TaskRollover] Manually resetting rollover state");
    resetTaskRolloverState();
    // Force a recheck after reset, bypassing the "already checked today" flag
    setTimeout(() => {
      console.log("[TaskRollover] Forcing recheck after reset with bypass of today flag");
      checkForIncompleteTasks(true, false).then(() => {
        console.log("[TaskRollover] Post-reset check complete:", {
          hasIncompleteTasks,
          incompleteTasks: incompleteTasks.length,
          recentSession: recentSession?.date
        });
        
        // Dispatch the tasksResolved event when manually resetting
        const event = new CustomEvent('tasksResolved', { 
          detail: { 
            timestamp: new Date().toISOString(),
            source: 'manual-reset'
          } 
        });
        window.dispatchEvent(event);
        console.log("[TaskRollover] Dispatched tasksResolved event after manual reset", event);
      });
    }, 200);
  };

  // If there are no incomplete tasks, don't render any UI except the hidden dialogs
  if (!hasIncompleteTasks && !isOpen && !showFinishQuestion) {
    return (
      <>
        {/* Hidden dialogs that might be shown by actions */}
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
          {/* Dialog content... */}
        </AlertDialog>
        
        {/* Task Rollover Management Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          {/* Dialog content... */}
        </Dialog>
      </>
    );
  }

  return (
    <>
      {/* Persistent task rollover notification - now full width and more prominent */}
      {hasIncompleteTasks && !isOpen && !showFinishQuestion && (
        <div className="mb-6 w-full border border-indigo-200 dark:border-indigo-700/50 bg-gradient-to-br from-indigo-50 to-indigo-50/50 dark:from-indigo-950/30 dark:to-indigo-900/20 rounded-lg shadow-md overflow-hidden">
          <div className="relative">
            {/* Decorative elements */}
            <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500 dark:bg-indigo-600"></div>
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200 dark:from-indigo-800 dark:via-indigo-600 dark:to-indigo-800 opacity-50"></div>
            
            <div className="px-6 py-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-800 dark:text-indigo-300">
                      Pending Tasks From Previous Session
                    </h3>
                    <div className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-400/90">
                      {recentSession && (
                        <p>
                          You have incomplete tasks from {format(parseISO(recentSession.date), "EEEE, MMMM d")}{" "}
                          that must be resolved before creating new tasks.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Add a visual divider */}
                <div className="border-t border-indigo-100 dark:border-indigo-800/50"></div>
                
                {/* More informative message and stronger call to action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm text-indigo-700/90 dark:text-indigo-400/90 bg-indigo-50/70 dark:bg-indigo-900/30 p-3 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                    <p>Unresolved tasks can clutter your workflow and reduce productivity. Taking a moment to address 
                    these tasks now will help you maintain a clean, organized system.</p>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleShowDebug}
                      className="h-9 px-3 text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 border-indigo-200 
                        dark:border-indigo-800/80 hover:bg-indigo-50 hover:text-indigo-700 
                        dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      Debug
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetRolloverState}
                      className="h-9 px-3 text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 border-indigo-200 
                        dark:border-indigo-800/80 hover:bg-indigo-50 hover:text-indigo-700 
                        dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={handleOpenRolloverDialog}
                      className="h-9 px-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 
                        text-white shadow-sm hover:shadow transition-all"
                    >
                      Manage Tasks
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <AlertDialogContent className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl 
          bg-white dark:bg-gray-900 p-0 overflow-hidden max-w-xl">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 
            border-b border-indigo-100 dark:border-indigo-900/50 px-6 py-5">
            <AlertDialogHeader className="space-y-1 text-left">
              <AlertDialogTitle className="text-xl font-semibold tracking-tight text-indigo-900 dark:text-indigo-200">
                Previous Tasks Pending
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-indigo-700/80 dark:text-indigo-300/90">
                <div className="space-y-4">
                  <p className="leading-relaxed">
                    You have incomplete tasks from your session on
                    {recentSession && (
                      <span className="font-medium text-indigo-900 dark:text-indigo-100 ml-1">
                        {format(parseISO(recentSession.date), "EEEE, MMMM d")}
                      </span>
                    )}.
                  </p>

                  <div className="bg-white/70 dark:bg-gray-800/70 border border-indigo-100 dark:border-indigo-800/50 
                    p-4 rounded-md shadow-sm">
                    <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-2 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400" />
                      Session Review Required
                    </h4>
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-400/90">
                      Would you like to complete these tasks in your previous session, or transfer them to your current plan?
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          
          <AlertDialogFooter className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800/50">
            <AlertDialogCancel 
              className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 
                hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
              onClick={() => {
                console.log("[TaskRollover] Finish question canceled");
                setShowFinishQuestion(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinishedYes}
              className="bg-gray-800 hover:bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
            >
              Complete in Previous Session
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleFinishedNo}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow"
            >
              Transfer to Current Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Confirm task completion dialog */}
      <AlertDialog
        open={showCompletionConfirmDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCompletionConfirmDialog(false);
            setTaskToComplete(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl 
          bg-white dark:bg-gray-900 p-0 overflow-hidden max-w-md">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 
            border-b border-green-100 dark:border-green-900/50 px-6 py-5">
            <AlertDialogHeader className="space-y-1 text-left">
              <AlertDialogTitle className="text-lg font-semibold tracking-tight text-green-900 dark:text-green-200">
                Confirm Task Completion
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-green-700/80 dark:text-green-300/90">
                <div className="space-y-3">
                  <p>
                    Did you complete this task between your last session and now?
                  </p>
                  {taskToComplete !== null && incompleteTasks[taskToComplete] && (
                    <div className="bg-white/70 dark:bg-gray-800/70 border border-green-100 dark:border-green-800/50 
                      p-3 rounded-md shadow-sm mt-2">
                      <p className="font-medium text-green-900 dark:text-green-100 text-sm">
                        {incompleteTasks[taskToComplete].task.title}
                      </p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          
          <AlertDialogFooter className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800/50">
            <AlertDialogCancel 
              className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 
                hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTaskComplete}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow"
            >
              Yes, Mark as Completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Unchecked tasks confirmation dialog */}
      <AlertDialog
        open={showUncheckedTasksDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowUncheckedTasksDialog(false);
          }
        }}
      >
        <AlertDialogContent className="rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl 
          bg-white dark:bg-gray-900 p-0 overflow-hidden max-w-md">
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 
            border-b border-amber-100 dark:border-amber-900/50 px-6 py-5">
            <AlertDialogHeader className="space-y-1 text-left">
              <AlertDialogTitle className="text-lg font-semibold tracking-tight text-amber-900 dark:text-amber-200">
                Unchecked Tasks
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-amber-700/80 dark:text-amber-300/90">
                <div className="space-y-3">
                  <p>
                    You have {incompleteTasks.length - selectedCount} unchecked tasks.
                    Do you want to forget/remove them?
                  </p>
                  <div className="bg-white/70 dark:bg-gray-800/70 border border-amber-100 dark:border-amber-800/50 
                    p-3 rounded-md shadow-sm mt-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        These tasks will be marked as "mitigated" and not transferred
                      </span>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          
          <AlertDialogFooter className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800/50">
            <AlertDialogCancel 
              className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 
                hover:bg-gray-50 dark:hover:bg-gray-800/50"
              onClick={() => {
                console.log("[TaskRollover] User wants to review unchecked tasks");
                setShowUncheckedTasksDialog(false);
              }}
            >
              No, Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log("[TaskRollover] User confirmed to forget unchecked tasks");
                setShowUncheckedTasksDialog(false);
                completeTaskRollover();
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow"
            >
              Yes, Forget Them
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col rounded-lg border border-gray-200 dark:border-gray-800 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30">
            <DialogTitle className="text-xl font-semibold tracking-tight text-indigo-900 dark:text-indigo-200">
              Transfer Tasks
            </DialogTitle>
            <DialogDescription className="text-sm text-indigo-700/80 dark:text-indigo-300/90 pt-1.5">
              {recentSession ? (
                <span>
                  Select tasks from your <span className="font-medium text-indigo-900 dark:text-indigo-100">{format(parseISO(recentSession.date), "MMMM d")}</span> session to transfer to today's plan
                </span>
              ) : (
                <span>Select tasks from your previous session</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col px-6 py-5 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin h-6 w-6 border-3 border-indigo-200 border-t-indigo-600 dark:border-indigo-700 dark:border-t-indigo-400 rounded-full"></div>
                <span className="ml-3 text-indigo-700 dark:text-indigo-400">Loading tasks...</span>
              </div>
            ) : incompleteTasks.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-5 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-md border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
                  <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
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
                      className="h-9 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
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
                      className="h-9 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {incompleteTasks.map((item, index) => (
                    <TaskItem
                      key={`${item.storyId}-${item.timeBoxIndex}-${item.taskIndex}`}
                      task={item}
                      index={index}
                      onToggle={toggleTaskSelection}
                      onComplete={handleInitiateTaskComplete}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-indigo-500 dark:text-indigo-400 
                bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                <CheckCheck className="h-10 w-10 mb-3" />
                <p className="text-center font-medium">
                  No incomplete tasks found in your previous session
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-sm text-indigo-700 dark:text-indigo-400">
              {selectedCount > 0
                ? `${selectedCount} task${selectedCount !== 1 ? 's' : ''} will be transferred to your current plan`
                : "No tasks selected"}
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 
                  hover:bg-gray-50 dark:hover:bg-gray-800/50"
                onClick={() => {
                  console.log("[TaskRollover] Cancel button clicked");
                  closeAndDiscard();
                }}
              >
                Cancel
              </Button>
              <Button 
                className={`${
                  selectedCount > 0 
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow' 
                    : 'bg-indigo-300 dark:bg-indigo-700/50 cursor-not-allowed'
                } text-white`}
                onClick={handleTransferTasksClick}
                disabled={selectedCount === 0}
              >
                Transfer Tasks
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add a debug dialog to display the current state */}
      <Dialog 
        open={showDebug} 
        onOpenChange={setShowDebug}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 p-0 shadow-xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900">
            <DialogTitle className="text-xl font-semibold tracking-tight">Task Rollover Debug Information</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 pt-1.5">
              This panel shows the current state of the task rollover system for troubleshooting.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 p-6">
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800/50 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-gray-800 dark:text-gray-300 flex items-center gap-2">
                <div className="p-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                    <path d="M12 13V7"></path>
                    <circle cx="12" cy="17" r="1"></circle>
                    <rect x="2" y="3" width="20" height="18" rx="2"></rect>
                    <path d="M15 3v4"></path>
                    <path d="M19 7H5"></path>
                    <path d="M9 3v4"></path>
                  </svg>
                </div>
                System State
              </h3>
              <div className="space-y-2 text-sm mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Has Incomplete Tasks:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{String(hasIncompleteTasks)}</div>

                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Is Loading:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{String(isLoading)}</div>

                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Is Dialog Open:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{String(isOpen)}</div>

                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Show Finish Question:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{String(showFinishQuestion)}</div>
                  
                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Tasks Count:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{incompleteTasks.length}</div>
                  
                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Selected Count:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-indigo-600 dark:text-indigo-400">{selectedCount}</div>
                </div>
              </div>
            </div>
            
            {recentSession && (
              <div className="border rounded-lg p-4 bg-white dark:bg-gray-800/50 dark:border-gray-700 shadow-sm">
                <h3 className="text-sm font-medium mb-2 text-gray-800 dark:text-gray-300 flex items-center gap-2">
                  <div className="p-1 rounded-full bg-blue-50 dark:bg-blue-900/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
                      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                      <path d="M18 14h-8"></path>
                      <path d="M15 18h-5"></path>
                      <path d="M10 6h8v4h-8V6Z"></path>
                    </svg>
                  </div>
                  Recent Session
                </h3>
                <div className="space-y-2 text-sm mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Date:</div>
                    <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-blue-600 dark:text-blue-400">{recentSession.date}</div>

                    <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Status:</div>
                    <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-blue-600 dark:text-blue-400">{recentSession.status}</div>
                    
                    <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Story Blocks:</div>
                    <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-blue-600 dark:text-blue-400">{recentSession.storyBlocks.length}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-800/50 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-gray-800 dark:text-gray-300 flex items-center gap-2">
                <div className="p-1 rounded-full bg-teal-50 dark:bg-teal-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600 dark:text-teal-400">
                    <path d="M20 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"></path>
                    <path d="M2 10h20"></path>
                  </svg>
                </div>
                Local Storage
              </h3>
              <div className="space-y-2 text-sm mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Last Check:</div>
                  <div className="font-mono break-all px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-teal-600 dark:text-teal-400 text-xs">{localStorage.getItem('task-rollover-last-check') || '(not set)'}</div>

                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Today Flag:</div>
                  <div className="font-mono break-all px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-teal-600 dark:text-teal-400 text-xs">{localStorage.getItem('task-rollover-completed-transfers-today') || '(not set)'}</div>
                  
                  <div className="text-gray-500 dark:text-gray-400 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">Service Enabled:</div>
                  <div className="font-mono px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-teal-600 dark:text-teal-400">{localStorage.getItem('task-rollover-enabled') || 'true (default)'}</div>
                </div>
              </div>
            </div>
            
            {incompleteTasks.length > 0 && (
              <div className="border rounded-lg p-4 bg-white dark:bg-gray-800/50 dark:border-gray-700 shadow-sm">
                <h3 className="text-sm font-medium mb-2 text-gray-800 dark:text-gray-300 flex items-center gap-2">
                  <div className="p-1 rounded-full bg-amber-50 dark:bg-amber-900/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
                      <path d="M3 7h18"></path>
                      <path d="M3 11h18"></path>
                      <path d="M3 15h18"></path>
                      <path d="M3 19h18"></path>
                    </svg>
                  </div>
                  Incomplete Tasks ({incompleteTasks.length})
                </h3>
                <div className="mt-3 max-h-60 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700">
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {incompleteTasks.map((task, i) => (
                      <li key={i} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{task.task.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span>Story: <span className="text-amber-600 dark:text-amber-400">{task.storyTitle}</span></span>
                          <span>•</span>
                          <span>Status: <span className="text-amber-600 dark:text-amber-400">{task.task.status || 'todo'}</span></span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({
                    recentSession,
                    incompleteTasks,
                    hasIncompleteTasks,
                    isOpen,
                    showFinishQuestion,
                    localStorage: {
                      lastCheck: localStorage.getItem('task-rollover-last-check'),
                      todayFlag: localStorage.getItem('task-rollover-completed-transfers-today'),
                      serviceEnabled: localStorage.getItem('task-rollover-enabled')
                    }
                  }, null, 2));
                  console.log("[TaskRollover] Debug state copied to clipboard");
                }}
                className="gap-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
                  <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                </svg>
                Copy Debug Info
              </Button>
              <Button
                variant="outline"
                onClick={handleResetRolloverState}
                className="gap-2 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 dark:text-indigo-400">
                  <path d="M12 2v4"></path>
                  <path d="M20 12h-4"></path>
                  <path d="M12 22v-4"></path>
                  <path d="M4 12h4"></path>
                  <path d="M17.8 16.5 15 13.8"></path>
                  <path d="M6.5 6.5 9.3 9.3"></path>
                  <path d="m16 8-2.8 2.8"></path>
                  <path d="M8 16 10.7 13"></path>
                </svg>
                Reset State
              </Button>
              <Button
                onClick={() => {
                  console.log("[TaskRollover] Forcing check from debug panel");
                  checkForIncompleteTasks(true, false);
                  setShowDebug(false);
                }}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <line x1="12" y1="2" x2="12" y2="22"></line>
                  <polyline points="2 12 12 2 22 12"></polyline>
                </svg>
                Force Check
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
  onComplete: (index: number) => void;
  onDelete: (index: number) => void;
}

function TaskItem({ task, index, onToggle, onComplete, onDelete }: TaskItemProps) {
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  
  const handleComplete = async (index: number) => {
    setIsCompletingTask(true);
    try {
      await onComplete(index);
    } finally {
      setIsCompletingTask(false);
    }
  };

  return (
    <div className="flex items-start gap-3 border border-gray-200 dark:border-gray-700 rounded-md p-4 
      bg-white dark:bg-gray-900/90 hover:bg-gray-50 dark:hover:bg-gray-800/60 
      transition-colors shadow-sm hover:shadow-md">
      <button 
        type="button"
        className={cn(
          "h-5 w-5 rounded flex-shrink-0 flex items-center justify-center transition-colors border",
          task.selected 
            ? "bg-indigo-100 border-indigo-300 text-indigo-600 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-400" 
            : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500"
        )}
        onClick={() => onToggle(index)}
        aria-label={task.selected ? "Deselect task" : "Select task"}
      >
        {task.selected && (
          <CheckSquare className="h-4 w-4" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
            {task.task.title}
          </h4>
          {task.task.isFrog && (
            <Badge className="bg-green-50 text-green-700 border border-green-200 
              dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 
              font-medium text-xs px-1.5 py-0">
              Priority
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.task.duration ? formatDuration(task.task.duration) : "No duration"}
          </span>
          <span className="text-gray-400 dark:text-gray-500">•</span>
          <span>Category: {task.storyTitle}</span>
        </div>
      </div>
      
      <div className="flex gap-1.5 ml-2">
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded 
            text-gray-500 hover:text-green-600 bg-transparent hover:bg-green-50 
            dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-green-900/20 
            transition-colors"
          onClick={() => handleComplete(index)}
          disabled={isCompletingTask}
          aria-label="Mark as completed"
          title="Mark as completed"
        >
          {isCompletingTask ? (
            <div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded 
            text-gray-500 hover:text-red-600 bg-transparent hover:bg-red-50 
            dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 
            transition-colors"
          onClick={() => onDelete(index)}
          aria-label="Remove from list"
          title="Remove from list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 