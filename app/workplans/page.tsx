"use client"

/**
 * WorkPlans Page Component
 * 
 * This file implements the WorkPlans page that displays a list of all work plans
 * in the system. It provides functionality to view, archive, and delete work plans.
 * 
 * The page consists of:
 * 1. A main content area showing all work plans as cards
 * 2. Loading and error states
 * 3. Confirmation dialog for deletion
 * 
 * Each work plan card displays:
 * - Date and status
 * - Start and end times
 * - List of story blocks with their tasks and progress
 * - Actions (archive, delete, view details)
 */

// ===== IMPORTS =====

// React and utility imports
import React, { useState, useMemo, useCallback, useEffect } from "react"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"

// UI Component imports
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

// Icon imports
import { 
  Clock, 
  ArrowRight, 
  Trash2, 
  Archive, 
  MoreHorizontal, 
  AlertCircle, 
  Loader2, 
  XCircle 
} from "lucide-react"

// Type and service imports
import type { TodoWorkPlan, TimeBox } from "@/lib/types"
import { WorkPlanStorageService, StorageError } from "@/app/features/workplan-manager/services/workplan-storage.service"

// ===== CONSTANTS =====

/**
 * Text required for confirming deletion of a work plan
 * User must type this exact text to proceed with deletion
 */
const DELETE_CONFIRMATION_TEXT = "delete"

/**
 * Singleton instance of the storage service
 * Used for loading, saving, and managing work plans
 */
const storageService = new WorkPlanStorageService();

// ===== INTERFACES =====

/**
 * Props for the WorkPlanList component
 */
interface WorkPlanListProps {
  /**
   * Array of work plans to display
   */
  workplans: TodoWorkPlan[];
  
  /**
   * Callback function for deleting a work plan
   * @param id - The ID of the work plan to delete
   */
  onDelete: (id: string) => void;
  
  /**
   * Callback function for archiving a work plan
   * @param id - The ID of the work plan to archive
   */
  onArchive: (id: string) => void;
  
  /**
   * Function to format duration in minutes to a human-readable string
   * @param minutes - Duration in minutes
   * @returns Formatted duration string (e.g., "2h 30m")
   */
  formatDuration: (minutes: number) => string;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Formats a duration in minutes to a human-readable string
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "2h 30m" or "45m")
 */
const formatDuration = (minutes: number): string => {
  if (minutes === 0) return "0m"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`
}

// ===== UI COMPONENTS =====

/**
 * Loading fallback component
 * Displayed when work plans are being loaded
 */
const LoadingFallback = () => (
  <div className="command-center min-h-[400px] flex flex-col items-center justify-center p-8">
    <div className="crt-screen p-8 max-w-lg w-full text-center">
      <div className="command-panel-header text-center">SYSTEM STATUS</div>
      <div className="space-y-6">
        <div className="data-readout p-4">
          <p className="blinking-cursor">LOADING MISSION DATA...</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-panel-fg opacity-80 text-xs">ACCESSING DATA STORAGE</span>
            <div className="led led-green"></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-panel-fg opacity-80 text-xs">VERIFYING MISSION LOGS</span>
            <div className="led led-green"></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-panel-fg opacity-80 text-xs">PREPARING WORK PLANS</span>
            <div className="led led-yellow"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

/**
 * Error fallback component
 * Displayed when an error occurs during loading
 */
const ErrorFallback = ({ error }: { error: StorageError | Error }) => (
  <div className="command-center min-h-[400px] flex flex-col items-center justify-center p-8">
    <div className="crt-screen p-8 max-w-lg w-full text-center">
      <div className="command-panel-header text-center">SYSTEM ALERT</div>
      <div className="space-y-6">
        <div className="data-readout p-4">
          <p className="text-destructive">ERROR CODE: {error instanceof Error ? "ERR-DATA" : error.code}</p>
        </div>
        <div className="space-y-2">
          <p className="text-panel-fg opacity-80 text-sm">
            {error instanceof Error
              ? error.message
              : `${error.message} (Code: ${error.code})`}
          </p>
          <div className="led led-red mx-auto my-6"></div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="command-button mx-auto"
        >
          SYSTEM RESTART
        </button>
      </div>
    </div>
  </div>
)

/**
 * Work Plan Card Component
 * Displays a single work plan as a card with its details and actions
 */
const WorkPlanCard = ({
  workplan,
  onDelete,
  onArchive,
  formatDuration
}: {
  workplan: TodoWorkPlan;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  formatDuration: (minutes: number) => string;
}) => {
  /**
   * Calculates task statistics for a time box array
   * @param timeBoxes - Array of time boxes to analyze
   * @returns Object containing task completion stats
   */
  const calculateTaskStats = (timeBoxes: TimeBox[]) => {
    // Handle empty time boxes array
    if (!timeBoxes?.length) return { completed: 0, total: 0, duration: 0 };
    
    // Reduce all time boxes to get aggregate statistics
    return timeBoxes.reduce((acc, box) => {
      // Only count work-type boxes with tasks
      if (box.type !== 'work' || !box.tasks?.length) return acc;
      
      // Calculate stats for current box
      const boxStats = {
        completed: box.tasks.filter(task => task.status === 'completed').length,
        total: box.tasks.length,
        duration: box.duration || 0
      };
      
      // Aggregate with accumulated stats
      return {
        completed: acc.completed + boxStats.completed,
        total: acc.total + boxStats.total,
        duration: acc.duration + boxStats.duration
      };
    }, { completed: 0, total: 0, duration: 0 });
  };

  return (
    <div className="paper-card">
      <div className="command-panel-header flex justify-between items-center">
        <Link href={`/workplan/${workplan.id}`} className="hover:underline flex-1">
          {format(parseISO(workplan.id), 'MMMM d, yyyy')}
        </Link>
        <div className="flex items-center gap-2">
          <div 
            className={cn("led", 
              workplan.status === 'planned' || workplan.status === 'in-progress' ? "led-green" : 
              workplan.status === 'archived' ? "led-yellow" : "led-blue"
            )}
          ></div>
          <span className="text-xs uppercase">
            {workplan.status === 'planned' || workplan.status === 'in-progress' ? 'ACTIVE' : workplan.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Time Range */}
      <div className="data-readout mt-2 mb-4 px-2 py-1 text-center">
        <div className="flex justify-around">
          <div>
            <span className="block text-xs opacity-80">START</span>
            <span className="font-mono">{workplan.startTime || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-xs opacity-80">END</span>
            <span className="font-mono">{workplan.endTime || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Story Blocks */}
      <div className="space-y-4 mt-4">
        {workplan.storyBlocks.map((story, storyIndex) => (
          <div key={storyIndex} className="p-3 border-l-2 border-panel-highlight bg-panel-bg/30">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-medium text-panel-fg">
                {story.title}
              </h3>
              <span className="text-xs">
                {formatDuration(story.totalDuration)}
              </span>
            </div>
            
            {/* Task statistics */}
            {story.timeBoxes.length > 0 && (() => {
              const stats = calculateTaskStats(story.timeBoxes);
              const progressPercentage = stats.total > 0 
                ? Math.round((stats.completed / stats.total) * 100) 
                : 0;
                
              return (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-xs text-panel-fg/80">
                      {stats.completed}/{stats.total} tasks
                    </span>
                    <span className="text-xs text-panel-fg/80">
                      {progressPercentage}% complete
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-1 mt-2 bg-panel-light">
                    <div
                      className="h-full bg-panel-highlight"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Card footer with actions */}
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => onArchive(workplan.id)}
          className="command-button text-xs"
        >
          {workplan.status === "planned" || workplan.status === "in-progress" ? "ARCHIVE" : "UNARCHIVE"}
        </button>
        <button
          onClick={() => onDelete(workplan.id)}
          className="command-button text-xs text-destructive"
        >
          DELETE
        </button>
        <Link href={`/workplan/${workplan.id}`}>
          <button className="command-button text-xs">
            VIEW
          </button>
        </Link>
      </div>
    </div>
  );
};

/**
 * Work Plan List Component
 * Displays a list of work plans in a grid layout
 */
const WorkPlanList = ({
  workplans,
  onDelete,
  onArchive,
  formatDuration
}: WorkPlanListProps) => {
  return (
    <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {workplans.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center text-center p-8 crt-screen">
          <div className="data-readout p-4 w-full max-w-md text-center">
            <p className="blinking-cursor">
              NO WORK PLANS FOUND. INITIALIZE NEW OPERATION.
            </p>
          </div>
        </div>
      ) : (
        workplans.map((workplan) => (
          <WorkPlanCard
            key={workplan.id}
            workplan={workplan}
            onDelete={onDelete}
            onArchive={onArchive}
            formatDuration={formatDuration}
          />
        ))
      )}
    </div>
  )
}

/**
 * Main Content Component
 * Handles loading work plans, error states, and displaying the work plan list
 */
function WorkPlansContent(): JSX.Element {
  // State for loading status
  const [isLoading, setIsLoading] = useState(true);
  // State for error handling
  const [loadError, setLoadError] = useState<Error | null>(null);
  // State for work plans data
  const [workplans, setWorkplans] = useState<TodoWorkPlan[]>([]);
  // State for tracking which work plan is being deleted
  const [workplanToDelete, setWorkPlanToDelete] = useState<string | null>(null);
  // State for deletion confirmation text input
  const [confirmationText, setConfirmationText] = useState('');
  // State for delete dialog visibility
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Load work plans on component mount
   */
  useEffect(() => {
    async function fetchWorkPlans() {
      try {
        setIsLoading(true);
        // Load all work plans from storage
        const loadedWorkplans = await storageService.getAllWorkPlans();
        // Sort work plans by date (newest first)
        loadedWorkplans.sort((a: TodoWorkPlan, b: TodoWorkPlan) => 
          new Date(b.id).getTime() - new Date(a.id).getTime()
        );
        setWorkplans(loadedWorkplans);
      } catch (error) {
        // Handle loading errors
        console.error("Failed to load work plans:", error);
        setLoadError(error instanceof Error ? error : new Error("Unknown error occurred"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkPlans();
  }, []);

  /**
   * Delete a work plan after confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!workplanToDelete) return;
    
    try {
      // Delete the work plan from storage
      await storageService.deleteWorkPlan(workplanToDelete);
      // Update the UI by filtering out the deleted work plan
      setWorkplans(prev => prev.filter(wp => wp.id !== workplanToDelete));
      // Reset delete dialog state
      setWorkPlanToDelete(null);
      setConfirmationText('');
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete work plan:", error);
      // In a production app, you might want to show an error toast/notification here
    }
  }, [workplanToDelete]);

  /**
   * Open the delete confirmation dialog
   */
  const handleDeleteClick = useCallback((id: string) => {
    setWorkPlanToDelete(id);
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * Archive a work plan
   */
  const handleArchive = useCallback(async (id: string) => {
    try {
      // Find the work plan to archive
      const workplan = workplans.find(wp => wp.id === id);
      if (!workplan) return;
      
      // Change status to archived
      const updated = {
        ...workplan,
        status: 'archived' as const,
        lastUpdated: new Date().toISOString()
      };
      
      // Save the updated work plan
      await storageService.saveWorkPlan(updated);
      // Update the UI with the archived work plan
      setWorkplans(prev => prev.map(wp => wp.id === id ? updated : wp));
    } catch (error) {
      console.error("Failed to archive work plan:", error);
      // In a production app, you might want to show an error toast/notification here
    }
  }, [workplans]);

  /**
   * Memoized function to format duration
   */
  const formatDurationMemo = useMemo(() => formatDuration, []);

  // Show loading fallback if data is being loaded
  if (isLoading) {
    return <LoadingFallback />;
  }

  // Show error fallback if loading failed
  if (loadError) {
    return <ErrorFallback error={loadError} />;
  }

  // Render main content with work plans
  return (
    <TooltipProvider>
      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={() => setIsDeleteDialogOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              work plan and all of its associated data.
              <div className="mt-4">
                <p className="font-medium">
                  Type "{DELETE_CONFIRMATION_TEXT}" to confirm:
                </p>
                <Input
                  className="mt-2"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={DELETE_CONFIRMATION_TEXT}
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setWorkPlanToDelete(null);
                setConfirmationText('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmationText !== DELETE_CONFIRMATION_TEXT}
              className={
                confirmationText !== DELETE_CONFIRMATION_TEXT
                  ? "bg-destructive/50 hover:bg-destructive/50 cursor-not-allowed"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty state message if no work plans */}
      {workplans.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] py-16 px-4 space-y-8 bg-muted/10 rounded-lg border border-muted/20">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
            <Clock className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center space-y-4 max-w-md">
            <h3 className="text-2xl font-semibold">No work plans found</h3>
            <p className="text-muted-foreground text-lg">
              Start by creating a new work plan for today.
            </p>
          </div>
          <Link href="/">
            <Button size="lg" className="px-8 py-6 text-lg font-medium shadow-md hover:shadow-lg transition-all">
              Create Work Plan
            </Button>
          </Link>
        </div>
      ) : (
        /* Display work plan list if there are work plans */
        <WorkPlanList
          workplans={workplans}
          onDelete={handleDeleteClick}
          onArchive={handleArchive}
          formatDuration={formatDurationMemo}
        />
      )}
    </TooltipProvider>
  );
}

/**
 * Main WorkPlans Page Component
 * Wraps the content in a container with a page header
 */
export default function WorkPlansPage() {
  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-8">
      {/* Page Header with Action Button */}
      <div className="command-panel mb-8">
        <div className="command-panel-header">MISSION CONTROL: WORK PLANS</div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-2">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-panel-fg">Active Operation Plans</h2>
            <p className="text-panel-fg opacity-80">
              Monitor, manage, and track all mission-critical work plans
            </p>
          </div>
          
          <Link href="/">
            <button className="command-button">
              INITIALIZE NEW PLAN
            </button>
          </Link>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="crt-screen p-6">
        <WorkPlansContent />
      </div>
    </div>
  )
} 