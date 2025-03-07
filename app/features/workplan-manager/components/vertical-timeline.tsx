"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  Coffee, 
  FileText, 
  Calendar,
  ArrowRight,
  AlertCircle,
  Undo2,
  X,
  RotateCcw,
  ChevronRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog"
import { format } from "date-fns"
import type { StoryBlock, TimeBox, TimeBoxTask, TimeBoxStatus } from "@/lib/types"
import { timeboxTypeConfig, statusColorConfig } from "../config/timeline-config"

// Interface for the vertical timeline component
export interface VerticalTimelineProps {
  storyBlocks: StoryBlock[]
  activeTimeBoxId?: string
  activeStoryId?: string
  activeTimeBoxIndex?: number
  startTime?: string
  completedPercentage: number
  onTaskClick?: (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => void
  onTimeBoxClick?: (storyId: string, timeBoxIndex: number) => void
  onStartTimeBox?: (storyId: string, timeBoxIndex: number, duration: number) => void
  onCompleteTimeBox?: (storyId: string, timeBoxIndex: number) => void
  onUndoCompleteTimeBox?: (storyId: string, timeBoxIndex: number) => void
  onStartWorkPlanDebrief?: (duration: number) => void
  isCompactView?: boolean
}

// Interface for next action
interface NextAction {
  storyId: string;
  timeBoxIndex: number;
  type: string;
}

// Interface for time estimates
interface TimeEstimate {
  start: string;
  end: string;
}

export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
  storyBlocks,
  activeTimeBoxId,
  activeStoryId,
  activeTimeBoxIndex,
  startTime,
  completedPercentage,
  onTaskClick,
  onTimeBoxClick,
  onStartTimeBox,
  onCompleteTimeBox,
  onUndoCompleteTimeBox,
  onStartWorkPlanDebrief: onStartSessionDebrief,
  isCompactView = false
}: VerticalTimelineProps) => {
  const [visibleBoxes, setVisibleBoxes] = useState<Set<string>>(new Set())
  const [confirmComplete, setConfirmComplete] = useState<{storyId: string, timeBoxIndex: number} | null>(null)
  const [confirmTaskComplete, setConfirmTaskComplete] = useState<{storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask} | null>(null)
  // Ready to start popup state
  const [readyToStartPopupOpen, setReadyToStartPopupOpen] = useState(false)
  // Track if we've shown the popup - we only want to show it once per "idle period"
  const [hasShownPopup, setHasShownPopup] = useState(false)
  // Track the current next action to detect changes
  const [lastNextActionId, setLastNextActionId] = useState<string | null>(null)
  
  // Add state to track if workplan debrief is active
  const [workPlanDebriefActive, setWorkPlanDebriefActive] = useState(false)
  const [workPlanDebriefCompleted, setWorkPlanDebriefCompleted] = useState(false)
  
  // Override the default confirm dialog with our own dialogs
  // This prevents the browser's built-in confirm dialog from showing
  useEffect(() => {
    // Store original dialog functions and capture references
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    const originalPrompt = window.prompt;
    
    // Create a no-op function that returns true to allow operations to proceed
    const noOpTrue = () => true;
    const noOp = () => {};
    
    // Override all browser dialog functions - using direct property assignment 
    // which is more reliable than prototype overrides
    window.confirm = noOpTrue;  // Always return true to proceed with the action
    window.alert = noOp;      // Do nothing for alerts
    window.prompt = () => null; // Return null for prompts
    
    // Handle beforeunload to prevent "Are you sure you want to leave?" dialogs
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.returnValue = '';
      return '';
    };
    
    // Add event listeners at the capture phase to intercept events before they reach handlers
    window.addEventListener('beforeunload', handleBeforeUnload, { capture: true });
    
    // Set a more aggressive MutationObserver to detect and hide any dialog-like elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          for (const node of Array.from(mutation.addedNodes)) {
            // Check for anything that looks like a dialog
            if (node instanceof HTMLElement) {
              // Look for browser dialogs, but not our Radix UI dialogs
              if ((
                  node.tagName === 'DIALOG' || 
                  node.querySelector('dialog') ||
                  node.role === 'dialog' || 
                  node.getAttribute('role') === 'dialog' ||
                  node.classList.contains('dialog')
                ) && 
                !node.closest('[data-radix-alert-dialog-content]') &&
                !node.hasAttribute('data-radix-alert-dialog-content')
              ) {
                // Attempt to hide or remove the dialog
                if (node instanceof HTMLDialogElement) {
                  node.close();
                }
                
                // Hide it as a fallback
                node.style.display = 'none';
                node.style.visibility = 'hidden';
                node.style.opacity = '0';
                node.style.pointerEvents = 'none';
                
                console.log("Removed browser dialog:", node);
              }
            }
          }
        }
      }
    });
    
    // Start observing the entire document with comprehensive configuration
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'open', 'style', 'class']
    });
    
    // Override any window.onbeforeunload handlers that might be set by other code
    Object.defineProperty(window, 'onbeforeunload', {
      get: () => null,
      set: () => null,
      configurable: true
    });
    
    // Restore original functions on cleanup
    return () => {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      window.prompt = originalPrompt;
      window.removeEventListener('beforeunload', handleBeforeUnload, { capture: true });
      observer.disconnect();
    };
  }, []);
  
  // Create a safe wrapper for task completion that won't trigger browser dialogs
  const safeCompleteTask = React.useCallback((
    storyId: string, 
    timeBoxIndex: number, 
    taskIndex: number, 
    task: TimeBoxTask, 
    newStatus: TimeBoxStatus
  ) => {
    if (!onTaskClick) return;
    
    try {
      // Create a new task object with the updated status
      const updatedTask = {
        ...task,
        status: newStatus
      };
      
      console.log("Calling onTaskClick with status:", newStatus, "for task:", task.title);
      
      // Call parent component's handler with the updated task
      onTaskClick(storyId, timeBoxIndex, taskIndex, updatedTask);
    } catch (err) {
      console.error("Error in safeCompleteTask:", err);
    }
  }, [onTaskClick]);
  
  // Create a wrapper for onTaskClick to handle task status changes internally
  const handleTaskClick = React.useCallback((
    storyId: string, 
    timeBoxIndex: number, 
    taskIndex: number, 
    task: TimeBoxTask,
    shouldConfirm: boolean = true,
    event?: React.MouseEvent
  ) => {
    // Stop event propagation and prevent default to avoid any browser alerts
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    if (task.status === "completed") {
      // For completed tasks, toggle to incomplete without confirmation
      safeCompleteTask(storyId, timeBoxIndex, taskIndex, task, "todo" as TimeBoxStatus);
    } else if (shouldConfirm) {
      // For incomplete tasks, show our custom confirmation dialog
      setConfirmTaskComplete({ storyId, timeBoxIndex, taskIndex, task });
    } else {
      // Direct completion (from our dialog confirmation)
      safeCompleteTask(storyId, timeBoxIndex, taskIndex, task, "completed" as TimeBoxStatus);
    }
  }, [safeCompleteTask]);
  
  // Set up intersection observer to track which items are visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Instead of animating items one by one as they come into view,
        // just mark all items as visible immediately after component mounts
        const visibleIds = entries.map(entry => entry.target.getAttribute('data-id')).filter(Boolean) as string[];
        setVisibleBoxes(new Set(visibleIds));
      },
      { 
        threshold: 0.1,
        rootMargin: "-5% 0px -5% 0px"
      }
    )
    
    // Query all timeline items and observe them
    const items = document.querySelectorAll('.timeline-item')
    items.forEach(item => observer.observe(item))
    
    // Mark all items as visible immediately
    setTimeout(() => {
      const allIds = Array.from(items).map(item => item.getAttribute('data-id')).filter(Boolean) as string[];
      setVisibleBoxes(new Set(allIds));
    }, 100);
    
    return () => {
      observer.disconnect()
    }
  }, [storyBlocks])
  
  // Calculate accumulated duration up to a specific timeBox
  const calculateAccumulatedDuration = (targetStoryIndex: number, targetTimeBoxIndex: number): number => {
    let totalMinutes = 0
    
    for (let si = 0; si <= targetStoryIndex; si++) {
      const story = storyBlocks[si]
      if (!story) continue
      
      const boxLimit = si === targetStoryIndex ? targetTimeBoxIndex : story.timeBoxes.length - 1
      
      for (let bi = 0; bi <= boxLimit; bi++) {
        const box = story.timeBoxes[bi]
        if (!box) continue
        
        if (si === targetStoryIndex && bi === targetTimeBoxIndex) {
          // Don't include the target box's duration
          break
        }
        
        totalMinutes += box.duration
      }
    }
    
    return totalMinutes
  }
  
  // Function to calculate estimated time for timeboxes
  const calculateTimeEstimates = (storyIndex: number, timeBoxIndex: number): TimeEstimate => {
    if (!startTime) return { start: "", end: "" }

    try {
      const accumulatedMinutes = calculateAccumulatedDuration(storyIndex, timeBoxIndex)
      const startDate = new Date(startTime)
      
      // Estimated start time
      const estimatedStart = new Date(startDate.getTime())
      estimatedStart.setMinutes(estimatedStart.getMinutes() + accumulatedMinutes)
      
      // Estimated end time
      const estimatedEnd = new Date(estimatedStart.getTime())
      const currentTimeBox = storyBlocks[storyIndex]?.timeBoxes[timeBoxIndex]
      if (currentTimeBox) {
        estimatedEnd.setMinutes(estimatedEnd.getMinutes() + currentTimeBox.duration)
      }
      
      return {
        start: format(estimatedStart, 'h:mm a'),
        end: format(estimatedEnd, 'h:mm a')
      }
    } catch (e) {
      return { start: "", end: "" }
    }
  }
  
  // Helper function to get button classes for different break types
  const getBreakButtonClasses = (color: string): string => {
    switch(color) {
      case 'teal':
        return "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-900/50"
      case 'violet':
        return "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-900/50"
      case 'amber':
        return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/50"
      case 'rose':
        return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/50"
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
    }
  }
  
  const determineNextAction = (): NextAction | null => {
    // If there's any active timebox, we shouldn't show the "Next Up" badge
    const hasActiveTimebox = storyBlocks?.some(story => 
      story.timeBoxes?.some(box => box.status === "in-progress")
    ) || false;
    
    if (hasActiveTimebox) {
      return null;
    }
    
    // Find the first incomplete timebox
    for (let i = 0; i < (storyBlocks?.length || 0); i++) {
      const story = storyBlocks?.[i];
      if (!story?.timeBoxes) continue;
      
      for (let j = 0; j < story.timeBoxes.length; j++) {
        const box = story.timeBoxes[j];
        if (box.status === "todo") {
          return {
            storyId: story.id,
            timeBoxIndex: j,
            type: box.type
          };
        }
      }
    }
    
    return null;
  };

  const nextAction = determineNextAction();
  
  // Track when the next action changes (like after completing a task)
  useEffect(() => {
    if (nextAction) {
      const nextActionId = `${nextAction.storyId}-${nextAction.timeBoxIndex}`;
      
      // If the next action has changed, reset the popup shown state
      if (lastNextActionId !== nextActionId) {
        setLastNextActionId(nextActionId);
        setHasShownPopup(false);
      }
    } else {
      // No next action available
      setLastNextActionId(null);
    }
  }, [nextAction, lastNextActionId]);
  
  // Check if there's any active timebox
  const hasActiveTimebox = storyBlocks?.some(story => 
    story.timeBoxes?.some(box => box.status === "in-progress")
  ) || false;
  
  // When active timebox status changes, reset popup state
  useEffect(() => {
    if (hasActiveTimebox) {
      // If a timebox becomes active, reset the popup shown state
      setHasShownPopup(false);
    }
  }, [hasActiveTimebox]);
  
  // Function to scroll to the next task
  const scrollToNextTask = () => {
    if (nextAction) {
      const timeBoxId = `${nextAction.storyId}-box-${nextAction.timeBoxIndex}`;
      const element = document.querySelector(`[data-id="${timeBoxId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Close the popup after scrolling
      setReadyToStartPopupOpen(false);
      setHasShownPopup(true);
    }
  };

  // Show the popup once when component mounts if there's a next action but no active timebox
  useEffect(() => {
    if (!hasActiveTimebox && nextAction && !hasShownPopup) {
      // Short delay before showing popup to avoid it appearing immediately on load
      const timer = setTimeout(() => {
        setReadyToStartPopupOpen(true);
        setHasShownPopup(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasActiveTimebox, nextAction, hasShownPopup]);
  
  return (
    <TooltipProvider delayDuration={50} skipDelayDuration={0}>
      <div className="vertical-timeline-container">
        {/* Floating action button to open popup */}
        {!hasActiveTimebox && nextAction && !readyToStartPopupOpen && (
          <div className="fixed bottom-8 right-8 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon"
                  className="h-12 w-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-transform hover:scale-110"
                  onClick={() => setReadyToStartPopupOpen(true)}
                >
                  <Play className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                <p>Continue to next task</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      
        {/* Ready to get started popup */}
        <AlertDialog 
          open={readyToStartPopupOpen} 
          onOpenChange={setReadyToStartPopupOpen}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700 dark:from-purple-400 dark:to-indigo-400">
                Ready to get started?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-600 dark:text-gray-400">
                Your next task is ready and waiting for you. Let's go there now!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center justify-center my-2">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <Play className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel 
                className="min-w-[100px] h-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReadyToStartPopupOpen(false);
                }}
              >
                Later
              </AlertDialogCancel>
              <AlertDialogAction 
                className="min-w-[140px] h-10 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToNextTask();
                }}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Confirmation Dialog for Completing Timeboxes */}
        <AlertDialog 
          open={confirmComplete !== null} 
          onOpenChange={(open: boolean) => {
            // Clear the state when dialog closes
            if (!open) setConfirmComplete(null);
          }}
        >
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Timebox</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark this timebox as complete? This will move you to the next step in your session.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                className="min-w-[100px] h-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmComplete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                className="min-w-[100px] h-10 bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirmComplete && onCompleteTimeBox) {
                    onCompleteTimeBox(confirmComplete.storyId, confirmComplete.timeBoxIndex);
                    setConfirmComplete(null);
                  }
                }}
              >
                Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Confirmation Dialog for Completing Tasks */}
        <AlertDialog 
          open={confirmTaskComplete !== null} 
          onOpenChange={(open: boolean) => {
            // Clear the state when dialog closes
            if (!open) setConfirmTaskComplete(null);
          }}
        >
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Task</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {confirmTaskComplete && (
                  <>
                    <p className="mb-4">Are you sure you want to mark the following task as complete?</p>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">"{confirmTaskComplete.task.title}"</span>
                        {confirmTaskComplete.task.isFrog && (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 font-medium text-xs px-1.5 py-0">
                            🐸 FROG
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                className="min-w-[120px] h-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmTaskComplete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                className="min-w-[120px] h-10 bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirmTaskComplete) {
                    console.log("Confirmed task completion for:", confirmTaskComplete.task.title);
                    
                    // Complete the task using our safe handler
                    safeCompleteTask(
                      confirmTaskComplete.storyId,
                      confirmTaskComplete.timeBoxIndex,
                      confirmTaskComplete.taskIndex,
                      confirmTaskComplete.task,
                      "completed" as TimeBoxStatus
                    );
                    setConfirmTaskComplete(null);
                  }
                }}
              >
                Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Enhanced timeline header with overall progress */}
        <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400">Session Progress</h3>
            </div>
            <Badge variant="outline" className="px-3 py-1 border-indigo-200 dark:border-indigo-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm text-indigo-700 dark:text-indigo-300">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                <span>{completedPercentage}% Complete</span>
              </div>
            </Badge>
          </div>
          
          <div className="relative">
            {/* Progress bar with gradient background and position indicator */}
            <div className="h-5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-inner relative">
              <div 
                className="h-full transition-all duration-500 ease-in-out rounded-full progress-gradient"
                style={{ width: `${completedPercentage}%` }}
              ></div>
              
              {/* Position indicator triangle */}
              <div 
                className="absolute top-[-8px] transform -translate-x-1/2 transition-all duration-500 ease-in-out"
                style={{ left: `${completedPercentage}%` }}
              >
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-indigo-500 dark:border-t-indigo-400"></div>
              </div>
            </div>
            
            {/* Progress markers with color-coded numeric percentages - active percentage is emphasized */}
            <div className="mt-2 flex justify-between text-xs px-1">
              <span className={cn(
                "font-medium text-pink-500 dark:text-pink-400",
                completedPercentage < 12.5 && "text-sm font-bold"
              )}>0%</span>
              <span className={cn(
                "font-medium text-orange-500 dark:text-orange-400",
                completedPercentage >= 12.5 && completedPercentage < 37.5 && "text-sm font-bold"
              )}>25%</span>
              <span className={cn(
                "font-medium text-purple-500 dark:text-purple-400",
                completedPercentage >= 37.5 && completedPercentage < 62.5 && "text-sm font-bold"
              )}>50%</span>
              <span className={cn(
                "font-medium text-indigo-500 dark:text-indigo-400",
                completedPercentage >= 62.5 && completedPercentage < 87.5 && "text-sm font-bold"
              )}>75%</span>
              <span className={cn(
                "font-medium text-emerald-500 dark:text-emerald-400",
                completedPercentage >= 87.5 && "text-sm font-bold"
              )}>100%</span>
            </div>
          </div>
        </div>
        
        {/* Main timeline content */}
        <div className="relative">
          {/* Main timeline track - gradient background with shimmering effect */}
          <div className="absolute left-7 top-6 bottom-0 w-[0.125rem] bg-gradient-to-b from-indigo-300 via-purple-300 to-pink-300 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 z-0 timeline-shimmer opacity-75"></div>
          
          {/* Timeline content */}
          <div className="space-y-10">
            {storyBlocks?.map((story, storyIndex) => {
              const storyId = story.id || `story-${storyIndex}`
              const isActiveStory = storyId === activeStoryId
              
              // Calculate story progress
              const totalTasks = story.timeBoxes?.reduce(
                (sum, box) => sum + (box.tasks?.length || 0), 0
              ) || 0;
              const completedTasks = story.timeBoxes?.reduce(
                (sum, box) => sum + (box.tasks?.filter(t => t.status === "completed").length || 0), 0
              ) || 0;
              const storyProgress = totalTasks > 0 
                ? Math.round((completedTasks / totalTasks) * 100) 
                : 0;
              
              return (
                <div key={storyId} className="relative">
                  {/* Story title with progress */}
                  <div className="flex items-center mb-5">
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center z-10",
                      "bg-gradient-to-br from-indigo-100 to-violet-50 dark:from-indigo-950 dark:to-violet-900",
                      "border-2 border-indigo-200 dark:border-indigo-700 shadow-sm",
                      isActiveStory && "ring-4 ring-indigo-200 dark:ring-indigo-700 ring-opacity-50"
                    )}>
                      <span className="text-xl">{story.icon || "📝"}</span>
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="font-bold text-lg">{story.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress 
                          value={storyProgress} 
                          className="flex-1 h-2 bg-gray-100 dark:bg-gray-800" 
                          indicatorClassName="story-progress-gradient"
                        />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{storyProgress}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Timeboxes for this story */}
                  <div className="space-y-4 ml-8 pl-14 relative">
                    {story.timeBoxes?.map((timeBox, timeBoxIndex) => {
                      // Generate a unique ID for this timeBox
                      const timeBoxId = `${storyId}-box-${timeBoxIndex}`
                      const isActive = timeBoxId === activeTimeBoxId
                      const config = timeboxTypeConfig[timeBox.type as keyof typeof timeboxTypeConfig] || timeboxTypeConfig.work
                      const Icon = config.icon
                      const isCompleted = timeBox.status === "completed"
                      const isInProgress = timeBox.status === "in-progress"
                      
                      // Get status colors
                      const statusColors = isCompleted 
                        ? statusColorConfig.completed 
                        : isInProgress 
                          ? statusColorConfig["in-progress"] 
                          : statusColorConfig.todo
                      
                      // Calculate time estimates for this timebox
                      const timeEstimates = calculateTimeEstimates(storyIndex, timeBoxIndex)
                      
                      // Animation variants
                      const boxAnimation = {
                        hidden: { opacity: 0, y: 20 },
                        show: { 
                          opacity: 1, 
                          y: 0,
                          transition: { 
                            type: "spring", 
                            stiffness: 300,
                            damping: 30,
                            delay: 0.1
                          }
                        },
                        active: {
                          scale: 1.01,
                          boxShadow: "0 8px 25px rgba(0,0,0,0.1)",
                          transition: { 
                            type: "spring", 
                            stiffness: 400,
                            damping: 20
                          }
                        }
                      }
                      
                      // Connection line animation - make it appear immediately
                      const lineAnimation = {
                        hidden: { height: 0 },
                        show: { 
                          height: "100%",
                          transition: { 
                            duration: 0.3,
                            delay: 0.1
                          }
                        }
                      }
                      
                      // Calculate task completion
                      const totalBoxTasks = timeBox.tasks?.length || 0;
                      const completedBoxTasks = timeBox.tasks?.filter(t => t.status === "completed").length || 0;
                      const boxProgress = totalBoxTasks > 0 
                        ? Math.round((completedBoxTasks / totalBoxTasks) * 100) 
                        : isCompleted ? 100 : isInProgress ? 50 : 0;
                      
                      return (
                        <motion.div 
                          key={timeBoxId}
                          className="timeline-item relative"
                          data-id={timeBoxId}
                          initial="hidden"
                          animate="show"
                          variants={boxAnimation}
                        >
                          {/* Vertical connecting line to next item */}
                          {timeBoxIndex < (story.timeBoxes?.length || 0) - 1 && (
                            <motion.div 
                              className={cn(
                                "absolute left-[-36px] top-7 w-[0.125rem] z-0 opacity-60",
                                isActive 
                                  ? "bg-gradient-to-b from-indigo-300 to-purple-300 dark:from-indigo-600 dark:to-purple-600" 
                                  : "bg-gray-200 dark:bg-gray-700"
                              )}
                              style={{ bottom: "-16px" }}
                              variants={lineAnimation}
                            />
                          )}
                          
                          {/* Timeline node */}
                          <div className="absolute left-[-40px] top-0 flex items-center justify-center z-10">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shadow-sm",
                              isCompleted ? statusColorConfig.completed.bg :
                                isInProgress ? statusColorConfig["in-progress"].bg :
                                config.bg,
                              isActive && !isCompleted && "ring-4 ring-indigo-200 dark:ring-indigo-800 ring-opacity-50 animate-pulse",
                              isCompleted ? statusColorConfig.completed.border :
                                isInProgress ? statusColorConfig["in-progress"].border :
                                config.border,
                              "border-2"
                            )}>
                              {isCompleted ? (
                                <CheckCircle2 className={cn("h-4 w-4", statusColorConfig.completed.text)} />
                              ) : isInProgress ? (
                                <Play className={cn("h-4 w-4", statusColorConfig["in-progress"].text)} />
                              ) : (
                                <Icon className={cn(
                                  "h-4 w-4",
                                  `text-${config.color}-600 dark:text-${config.color}-400`
                                )} />
                              )}
                            </div>
                          </div>
                          
                          {/* Main content box */}
                          <div 
                            className={cn(
                              "rounded-xl p-4 border-l-4 mb-2 transition-all overflow-hidden relative",
                              isActive ? "bg-indigo-50 dark:bg-indigo-950/40 shadow-md border-indigo-400 dark:border-indigo-600" : 
                                isInProgress ? statusColors.bg + " shadow-md " + statusColors.border : 
                                "bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900 border-gray-200 dark:border-gray-800",
                              isCompleted && statusColors.bg + " " + statusColors.border,
                              isActive && "transform-gpu shadow-lg",
                              nextAction && nextAction.storyId === storyId && nextAction.timeBoxIndex === timeBoxIndex && "next-action-card",
                              "hover:scale-[1.02] hover:shadow-md transform-gpu transition-transform duration-200"
                            )}
                          >
                            {/* Indicator for next action */}
                            
                            {/* Glow effect for active task */}
                            {isActive && (
                              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-indigo-500/5 animate-glow"></div>
                            )}
                            
                            <div className="flex items-center justify-between mb-2 relative">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-sm font-medium",
                                  `text-${config.color}-700 dark:text-${config.color}-400`,
                                  (timeBox.type === "short-break" || timeBox.type === "long-break") && "flex items-center"
                                )}>
                                  {(timeBox.type === "short-break" || timeBox.type === "long-break") && <Coffee className="mr-1 h-3.5 w-3.5" />}
                                  {config.title}
                                  {(timeBox.type === "short-break" || timeBox.type === "long-break") && nextAction && nextAction.storyId === storyId && nextAction.timeBoxIndex === timeBoxIndex && (
                                    <span className="ml-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded-sm">
                                      Rest time
                                    </span>
                                  )}
                                </span>
                                {isActive && (
                                  <Badge className="bg-indigo-500 text-xs dark:bg-indigo-700/70 dark:text-indigo-100">Active</Badge>
                                )}
                                {isCompleted && (
                                  <Badge className="bg-green-500 text-xs dark:bg-green-700/70 dark:text-green-100">Completed</Badge>
                                )}
                                {isInProgress && !isActive && (
                                  <Badge className="bg-blue-500 text-xs dark:bg-blue-700/70 dark:text-blue-100">In Progress</Badge>
                                )}
                                {nextAction && nextAction.storyId === storyId && nextAction.timeBoxIndex === timeBoxIndex && (
                                  <Badge 
                                    className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-700 dark:hover:bg-purple-800 ml-1 animate-pulse-scale shadow-md px-3 py-1.5 font-medium tracking-wide"
                                  >
                                    <span className="inline-flex items-center justify-center mr-1.5 text-xs">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse animate-play-icon">
                                        <path d="M5 3L19 12L5 21V3Z" fill="currentColor" />
                                      </svg>
                                    </span>
                                    Next Up
                                  </Badge>
                                )}
                              </div>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-sm">{timeBox.duration}m</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                                  <p>Duration: {timeBox.duration} minutes</p>
                                  {timeEstimates.start && (
                                    <p>Estimated time: {timeEstimates.start} - {timeEstimates.end}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            
                            {/* Task list - show if not in compact view */}
                            {!isCompactView && timeBox.tasks && timeBox.tasks.length > 0 && (
                              <div className={cn(
                                "mt-3 space-y-1.5 pl-3 border-l-2 relative",
                                isActive ? "border-indigo-200 dark:border-indigo-800" : "border-gray-100 dark:border-gray-800"
                              )}>
                                {timeBox.tasks.map((task, taskIndex) => {
                                  // Check if task is completed based on status
                                  const isTaskCompleted = task.status === "completed"
                                  
                                  const isNextTask = !isTaskCompleted && 
                                    timeBox.tasks ? 
                                    taskIndex === (timeBox.tasks.findIndex(t => t.status !== "completed") || 0) : 
                                    false;
                                  
                                  return (
                                    <div 
                                      key={`task-${taskIndex}`}
                                      className={cn(
                                        "flex items-start gap-2 py-1 px-2 rounded transition-all",
                                        isTaskCompleted 
                                          ? "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800" 
                                          : isNextTask
                                            ? "bg-indigo-50/70 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border-l-2 border-indigo-300 dark:border-indigo-600 pl-1.5" 
                                            : "hover:bg-gray-50 dark:hover:bg-gray-900/50",
                                        "cursor-pointer"
                                      )}
                                      onClick={(e) => {
                                        // Prevent any click event from reaching parent components
                                        e.stopPropagation();
                                        e.preventDefault();
                                        return false; // Explicitly return false to prevent default
                                      }}
                                      onMouseDown={(e) => {
                                        // Also prevent mousedown to stop any drag events
                                        e.stopPropagation();
                                        e.preventDefault();
                                      }}
                                    >
                                      <div 
                                        className={cn(
                                          "mt-0.5 w-5 h-5 border rounded flex items-center justify-center cursor-pointer",
                                          isTaskCompleted ? statusColorConfig.completed.bg + " " + statusColorConfig.completed.border :
                                            "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        )}
                                        onClick={(e) => {
                                          // Prevent event bubbling and default
                                          e.stopPropagation();
                                          e.preventDefault();
                                          
                                          // Use our handler function with the event
                                          handleTaskClick(storyId, timeBoxIndex, taskIndex, task, true, e);
                                          
                                          // Return false to prevent any other handlers
                                          return false;
                                        }}
                                        onMouseDown={(e) => {
                                          // Also prevent mousedown to stop any drag events
                                          e.stopPropagation();
                                          e.preventDefault();
                                        }}
                                      >
                                        {isTaskCompleted && (
                                          <CheckCircle2 className={cn("h-3.5 w-3.5", statusColorConfig.completed.text)} />
                                        )}
                                      </div>
                                      <span 
                                        className={cn(
                                          "text-sm flex-1",
                                          isTaskCompleted && "line-through"
                                        )}
                                        onClick={(e) => {
                                          // Prevent event bubbling and default
                                          e.stopPropagation();
                                          e.preventDefault();
                                          
                                          // Use our handler function with the event
                                          handleTaskClick(storyId, timeBoxIndex, taskIndex, task, true, e);
                                          
                                          // Return false to prevent any other handlers
                                          return false;
                                        }}
                                        onMouseDown={(e) => {
                                          // Also prevent mousedown to stop any drag events
                                          e.stopPropagation();
                                          e.preventDefault();
                                        }}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>{task.title}</span>
                                          {task.isFrog && (
                                            <Badge variant="secondary" className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 font-medium text-xs px-1.5 py-0">
                                              🐸 FROG
                                            </Badge>
                                          )}
                                        </div>
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            
                            {/* Action buttons row */}
                            <div className="mt-3.5 flex justify-between items-center">
                              {/* Progress display */}
                              <div className="flex-1 mr-3">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>{timeEstimates.start || "—"}</span>
                                  <span>{timeEstimates.end || "—"}</span>
                                </div>
                                <Progress 
                                  value={boxProgress} 
                                  className="h-1.5 bg-gray-100 dark:bg-gray-800" 
                                  indicatorClassName="timebox-progress-gradient"
                                />
                              </div>
                            
                              {/* Action buttons for the timebox */}
                              <div className="flex gap-1.5 items-center">
                                {/* Undo button - show only for completed timeboxes */}
                                {isCompleted && onUndoCompleteTimeBox && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUndoCompleteTimeBox(storyId, timeBoxIndex);
                                        }}
                                      >
                                        <Undo2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                                      <p>Undo Complete</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
{/* Start button - show for todo work boxes */}
{!isCompleted && !isInProgress && onStartTimeBox && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                          "h-9 px-4 rounded-xl shadow-sm",
                                          "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/50",
                                          "hover:scale-105 transition-transform duration-200 hover:shadow-md",
                                          nextAction && nextAction.storyId === storyId && nextAction.timeBoxIndex === timeBoxIndex && "relative z-20 hover:ring-2 hover:ring-purple-300 dark:hover:ring-purple-700"
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStartTimeBox(storyId, timeBoxIndex, timeBox.duration);
                                        }}
                                      >
                                        <Play className="h-4.5 w-4.5 mr-1.5" />
                                        <span className="text-sm font-medium">Start</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                                      <p>Start this {timeBox.type === 'work' ? 'timebox' : 'break'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                
                                {/* Complete button - show for in-progress timeboxes */}
                                {isInProgress && onCompleteTimeBox && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 px-4 rounded-xl shadow-sm bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          
                                          // First check if there are incomplete tasks
                                          const hasIncompleteTasks = timeBox.tasks && timeBox.tasks.some(t => t.status !== "completed");
                                          
                                          if (hasIncompleteTasks && timeBox.tasks) {
                                            // Find the first incomplete task
                                            const firstIncompleteTaskIndex = timeBox.tasks.findIndex(t => t.status !== "completed");
                                            if (firstIncompleteTaskIndex !== -1) {
                                              handleTaskClick(storyId, timeBoxIndex, firstIncompleteTaskIndex, timeBox.tasks[firstIncompleteTaskIndex], true, e);
                                              return;
                                            }
                                          }
                                          
                                          // If no incomplete tasks or something went wrong, use the original behavior
                                          setConfirmComplete({ storyId, timeBoxIndex });
                                        }}
                                      >
                                        <CheckCircle2 className="h-4.5 w-4.5 mr-1.5" />
                                        <span className="text-sm font-medium">Complete</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                                      <p>Mark as completed</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                               
                                {/* View details button - for all timeboxes */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTimeBoxClick?.(storyId, timeBoxIndex);
                                      }}
                                    >
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                                    <p>View Details</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            
            {/* Replace the basic End marker with a Debrief TimeBox */}
            <div className="ml-7 relative">
              {/* Vertical connecting line to debrief - extend further up to connect better */}
              <motion.div 
                className="absolute left-[-36px] top-[-50px] w-[0.125rem] z-0 opacity-75 bg-gradient-to-b from-purple-300 via-pink-300 to-rose-300 dark:from-purple-700 dark:via-pink-700 dark:to-rose-700"
                style={{ height: "58px" }}
                initial={{ height: 0 }}
                animate={{ height: "58px" }}
                transition={{ duration: 0.3, delay: 0.1 }}
              ></motion.div>
              
              {/* Timeline node */}
              <div className="absolute left-[-40px] top-0 flex items-center justify-center z-10">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 border-2">
                  <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              
              {/* Main content box */}
              <div className="rounded-xl p-4 border-l-4 mb-2 transition-all overflow-hidden relative bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900 border-rose-200 dark:border-rose-800 hover:scale-[1.02] hover:shadow-md transform-gpu transition-transform duration-200 ml-8 pl-6">
                <div className="flex items-center justify-between mb-2 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-400">
                      Session Debrief
                    </span>
                    <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 text-xs">
                      5-15 min
                    </Badge>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                  <p>Reflect on your completed session and capture any important insights.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Suggested questions:</div>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 pl-4 list-disc">
                    <li>What went well in this session?</li>
                    <li>What challenges did you encounter?</li>
                    <li>What can you improve for next time?</li>
                  </ul>
                </div>
                
                {/* Session Debrief Button */}
                <div className="mt-3.5 flex justify-between items-center">
                  <div className="flex-1 mr-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Session completed</span>
                    </div>
                  </div>
                  
                  {workPlanDebriefActive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl shadow-sm bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/50 hover:scale-105 transition-transform duration-200 hover:shadow-md"
                          onClick={() => {
                            setWorkPlanDebriefCompleted(true);
                            setWorkPlanDebriefActive(false);
                          }}
                        >
                          <CheckCircle2 className="h-4.5 w-4.5 mr-1.5" />
                          <span className="text-sm font-medium">Complete Debrief</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                        <p>Mark your debrief as completed</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {!workPlanDebriefActive && !workPlanDebriefCompleted && onStartSessionDebrief && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl shadow-sm bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/50 hover:scale-105 transition-transform duration-200 hover:shadow-md"
                          onClick={() => {
                            // 10 minutes for the debrief by default
                            onStartSessionDebrief(10);
                            setWorkPlanDebriefActive(true);
                          }}
                        >
                          <FileText className="h-4.5 w-4.5 mr-1.5" />
                          <span className="text-sm font-medium">Start Debrief</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="z-[9999] bg-white dark:bg-gray-900 shadow-lg px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-sm">
                        <p>Begin your session reflection</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {workPlanDebriefCompleted && (
                    <Badge className="bg-green-500 text-white dark:bg-green-700 dark:text-white px-2.5 py-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      <span>Completed</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add some custom CSS for timeline shimmer effect */}
        <style jsx>{`
          .timeline-shimmer {
            position: relative;
            overflow: hidden;
          }
          
          .timeline-shimmer::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              to bottom,
              transparent 0%,
              rgba(255, 255, 255, 0.4) 50%,
              transparent 100%
            );
            animation: shimmer 3s infinite;
            transform: translateY(-100%);
          }
          
          @keyframes shimmer {
            0% {
              transform: translateY(-100%);
            }
            100% {
              transform: translateY(100%);
            }
          }
          
          @keyframes glow {
            0% {
              opacity: 0.3;
            }
            50% {
              opacity: 0.6;
            }
            100% {
              opacity: 0.3;
            }
          }
          
          @keyframes pulse-scale {
            0% {
              transform: scale(1);
              box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
            }
            50% {
              transform: scale(1.07);
              box-shadow: 0 0 20px rgba(139, 92, 246, 0.8);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
            }
          }
          
          @keyframes pulse-border {
            0% {
              box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
            }
          }
          
          @keyframes pulse-subtle {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.9;
              transform: translateY(-1px);
            }
          }
          
          @keyframes attention-flash {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.85;
              transform: scale(1.08);
            }
          }
          
          @keyframes bounce-gentle {
            0%, 100% {
              transform: translateY(-50%) translateX(0);
            }
            50% {
              transform: translateY(-50%) translateX(-5px);
            }
          }
          
          .animate-glow {
            animation: glow 2s ease-in-out infinite;
          }
          
          .animate-pulse-scale {
            animation: pulse-scale 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          .animate-pulse-border {
            animation: pulse-border 2s infinite;
          }
          
          .animate-pulse-subtle {
            animation: pulse-subtle 3s ease-in-out infinite;
          }
          
          .animate-bounce-gentle {
            animation: bounce-gentle 1.5s ease-in-out infinite;
          }
          
          /* Timeline card hover effects */
          .timeline-item > div[class*="rounded-xl"] {
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease-out, background-color 0.2s ease;
            will-change: transform, box-shadow;
            transform-origin: left center;
          }
          
          .timeline-item > div[class*="rounded-xl"]:hover {
            z-index: 10;
            transform: translateX(12px) scale(1.03);
            box-shadow: 4px 5px 15px rgba(0, 0, 0, 0.1);
          }
          
          .next-action-card {
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
            position: relative;
            animation: attention-flash 3s ease-in-out infinite;
            /* Add a left border highlight */
            border-left: 4px solid rgba(139, 92, 246, 0.9) !important;
          }
          
          /* Enhance the left border with a glow effect */
          .next-action-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -2px;
            height: 100%;
            width: 6px;
            background: linear-gradient(to right, 
              rgba(139, 92, 246, 0.9) 0%, 
              rgba(168, 85, 247, 0.7) 50%, 
              rgba(139, 92, 246, 0.1) 100%
            );
            border-radius: 4px;
            filter: blur(3px);
            animation: purple-flare-pulse 2s ease-in-out infinite;
            z-index: 1;
          }
          
          /* Stop animations when hovering over the card or start button */
          .next-action-card:hover,
          .next-action-card:hover::after,
          .next-action-card:hover::before {
            animation-play-state: paused;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.8);
          }
          
          .next-action-card::after {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(to right, rgba(139, 92, 246, 0.7), rgba(168, 85, 247, 0.7));
            -webkit-mask: 
              linear-gradient(#fff 0 0) content-box, 
              linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0.9;
            z-index: 0;
            animation: pulse-border 2s infinite;
          }
          
          /* Add a special animation for the purple flare effect */
          @keyframes purple-flare-pulse {
            0% {
              opacity: 0.6;
              filter: blur(3px) brightness(1);
            }
            50% {
              opacity: 1;
              filter: blur(4px) brightness(1.5);
            }
            100% {
              opacity: 0.6;
              filter: blur(3px) brightness(1);
            }
          }
          
          /* Ensure tooltips appear above all other elements */
          [data-radix-tooltip-content] {
            z-index: 9999 !important;
            position: fixed !important;
            pointer-events: none !important;
            top: 0;
            left: 0;
            max-width: 20rem;
            transform-origin: var(--radix-tooltip-content-transform-origin);
            animation: tooltipFadeIn 0.2s ease-out;
          }
          
          @keyframes tooltipFadeIn {
            from {
              opacity: 0;
              transform: scale(0.96);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          /* Add a portal class to ensure tooltips render at the root level */
          .radix-tooltip-portal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 0;
            overflow: visible;
            z-index: 9999;
          }
          
          /* Dark mode adjustments for the next-action-card */
          .dark .next-action-card {
            border-left: 4px solid rgba(168, 85, 247, 0.9) !important;
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
          }
          
          .dark .next-action-card::before {
            background: linear-gradient(to right, 
              rgba(168, 85, 247, 0.9) 0%, 
              rgba(192, 132, 252, 0.7) 50%, 
              rgba(168, 85, 247, 0.1) 100%
            );
            filter: blur(4px);
          }
          
          .dark .next-action-card:hover {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
          }
          
          .dark .next-action-card::after {
            background: linear-gradient(to right, rgba(168, 85, 247, 0.7), rgba(192, 132, 252, 0.7));
          }
          
          @keyframes play-icon-pulse {
            0% {
              transform: scale(1) translateX(0);
              opacity: 0.9;
            }
            50% {
              transform: scale(1.1) translateX(1px);
              opacity: 1;
            }
            100% {
              transform: scale(1) translateX(0);
              opacity: 0.9;
            }
          }
          
          .animate-play-icon {
            animation: play-icon-pulse 1.5s ease-in-out infinite;
          }
          
          /* Progress gradient styling */
          .progress-gradient {
            background: linear-gradient(
              to right, 
              #f472b6, /* Pink */
              #fb923c, /* Orange */
              #a78bfa, /* Light purple */
              #4ade80  /* Green */
            );
            background-size: 300% 100%;
            animation: progress-gradient-shift 3s ease infinite;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .dark .progress-gradient {
            background: linear-gradient(
              to right, 
              #db2777, /* Darker pink for dark mode */
              #ea580c, /* Darker orange for dark mode */
              #8b5cf6, /* Darker purple for dark mode */
              #22c55e  /* Darker green for dark mode */
            );
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          
          @keyframes progress-gradient-shift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          
          /* Story progress bar gradient styling - same colors but no animation */
          .story-progress-gradient {
            background: linear-gradient(
              to right, 
              #f472b6, /* Pink */
              #fb923c, /* Orange */
              #a78bfa, /* Light purple */
              #4ade80  /* Green */
            );
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          
          .dark .story-progress-gradient {
            background: linear-gradient(
              to right, 
              #db2777, /* Darker pink for dark mode */
              #ea580c, /* Darker orange for dark mode */
              #8b5cf6, /* Darker purple for dark mode */
              #22c55e  /* Darker green for dark mode */
            );
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          }

          /* Timebox progress bar styling - simpler gradient focused on completion color */
          .timebox-progress-gradient {
            background: linear-gradient(
              to right, 
              #a78bfa, /* Light purple */
              #34d399  /* Emerald green */
            );
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.03);
          }
          
          .dark .timebox-progress-gradient {
            background: linear-gradient(
              to right, 
              #8b5cf6, /* Darker purple for dark mode */
              #10b981  /* Darker emerald for dark mode */
            );
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          }
        `}</style>
      </div>
    </TooltipProvider>
  )
}