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
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <p className="text-muted-foreground">Loading work plans...</p>
  </div>
)

/**
 * Error fallback component
 * Displayed when an error occurs during loading
 */
const ErrorFallback = ({ error }: { error: StorageError | Error }) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
      <AlertCircle className="h-6 w-6 text-destructive" />
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-xl font-semibold">Failed to load work plans</h3>
      <p className="text-muted-foreground">
        {error instanceof Error
          ? error.message
          : `${error.message} (Code: ${error.code})`}
      </p>
    </div>
    <Button
      variant="outline"
      onClick={() => window.location.reload()}
      className="gap-2"
    >
      <XCircle className="h-4 w-4" />
      Reload page
    </Button>
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
    <Card key={workplan.id} className="transition-colors hover:bg-muted/50">
      {/* Card Header: Date, Status, and Actions */}
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left side: Date, Status, and Time Range */}
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">
              {format(parseISO(workplan.id), 'EEEE, MMMM d, yyyy')}
            </CardTitle>
            {/* Status Badge with color coding */}
            <Badge variant="secondary" className={cn(
              "capitalize",
              workplan.status === 'completed' && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
              workplan.status === 'in-progress' && "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
              workplan.status === 'planned' && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
              workplan.status === 'archived' && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            )}>
              {workplan.status}
            </Badge>
            
            {/* Time Range */}
            <div className="text-sm text-muted-foreground">
              <Clock className="h-4 w-4 inline-block mr-1" />
              {format(parseISO(workplan.startTime), 'h:mm a')} - {format(parseISO(workplan.endTime), 'h:mm a')}
            </div>
          </div>
          
          {/* Right side: Action buttons */}
          <div className="flex items-center gap-2">
            {/* Archive button - only shown if not already archived */}
            {workplan.status !== 'archived' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onArchive(workplan.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archive workplan</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Delete button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(workplan.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete workplan</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      {/* Card Content: Story Blocks and Tasks */}
      <CardContent>
        <div className="grid gap-4">
          {/* Check if there are story blocks to display */}
          {workplan.storyBlocks?.length > 0 ? (
            workplan.storyBlocks.map((story) => {
              // Calculate task statistics for this story
              const stats = calculateTaskStats(story.timeBoxes);
              
              return (
                <div key={story.id} className="space-y-3">
                  {/* Story Header: Title, Icon, and Duration */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Show story icon if available */}
                      {story.icon && (
                        <span className="text-muted-foreground">{story.icon}</span>
                      )}
                      <div>
                        <h3 className="font-medium">{story.title}</h3>
                        {/* Show original title if different from current title */}
                        {story.originalTitle && story.originalTitle !== story.title && (
                          <p className="text-sm text-muted-foreground line-clamp-2">Originally: {story.originalTitle}</p>
                        )}
                        {/* Task completion statistics */}
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.completed}/{stats.total} tasks completed • {formatDuration(stats.duration)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Task List: Show sample tasks from each work time box */}
                  <div className="grid gap-2">
                    {story.timeBoxes
                      .filter(box => box.type === 'work') // Only show work time boxes
                      .map((box, boxIndex) => {
                        const tasks = box.tasks || [];
                        if (tasks.length === 0) return null; // Skip empty time boxes
                        
                        return (
                          <div key={boxIndex} className="text-sm">
                            <div className="flex items-center gap-2">
                              {/* Show up to 2 tasks from this time box */}
                              {tasks.slice(0, 2).map((task, taskIndex) => (
                                <Badge 
                                  key={taskIndex} 
                                  variant={task.status === 'completed' ? 'default' : 'secondary'}
                                  className={cn(
                                    "text-xs",
                                    task.taskCategory && "capitalize", // Capitalize task categories
                                    task.isFrog && "border-2 border-green-500" // Highlight high-priority tasks
                                  )}
                                >
                                  {task.taskCategory && `${task.taskCategory}: `}{task.title}
                                </Badge>
                              ))}
                              {/* Show count of additional tasks if more than 2 */}
                              {tasks.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{tasks.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Progress Bar: Shows completion percentage based on tasks */}
                  <Progress 
                    value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
              );
            })
          ) : (
            // No story blocks fallback message
            <p className="text-muted-foreground text-center py-4">
              No stories available for this work plan.
            </p>
          )}
          
          {/* View Details Link */}
          <div className="flex justify-end">
            <Link href={`/workplan/${workplan.id}`}>
              <Button variant="ghost" className="gap-2">
                View Details
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {workplans.map((workplan) => (
        <WorkPlanCard
          key={workplan.id}
          workplan={workplan}
          onDelete={onDelete}
          onArchive={onArchive}
          formatDuration={formatDuration}
        />
      ))}
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
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">No work plans found</h3>
            <p className="text-muted-foreground">
              Start by creating a new work plan for today.
            </p>
          </div>
          <Link href="/create">
            <Button>Create Work Plan</Button>
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
    <div className="container py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Work Plans</h1>
        <p className="text-muted-foreground">
          View, manage, and track all your work plans
        </p>
      </div>
      
      {/* Main Content */}
      <WorkPlansContent />
    </div>
  )
} 