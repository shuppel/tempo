"use client";

import { useState, useEffect } from "react";
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
  AlertDialogTrigger,
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
  const [initialCheckDone, setInitialCheckDone] = useState(false);
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
    debriefPreviousSession
  } = useTaskRollover();

  // Show the initial dialog if there are incomplete tasks
  useEffect(() => {
    if (!isLoading && hasIncompleteTasks && !initialCheckDone) {
      setShowFinishQuestion(true);
      setInitialCheckDone(true);
    }
  }, [isLoading, hasIncompleteTasks, initialCheckDone]);

  // When rollover is finished, add the tasks to Brain Dump
  useEffect(() => {
    if (!isOpen && brainDumpText && onCompletedTasksAdded) {
      onCompletedTasksAdded(brainDumpText);
    }
  }, [isOpen, brainDumpText, onCompletedTasksAdded]);

  // Handle "Did you finish everything?" dialog responses
  const handleFinishedYes = () => {
    setShowFinishQuestion(false);
    debriefPreviousSession();
  };

  const handleFinishedNo = () => {
    setShowFinishQuestion(false);
    setIsOpen(true);
  };

  const handleTaskRolloverComplete = () => {
    finishRollover();
    if (onCompletedTasksAdded) {
      onCompletedTasksAdded(brainDumpText);
    }
  };

  return (
    <>
      {/* "Did you finish everything?" question dialog */}
      <AlertDialog open={showFinishQuestion} onOpenChange={setShowFinishQuestion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Previous Tasks Found</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>
                  Did you finish everything you wanted to finish from the session on
                  {recentSession && (
                    <span className="font-medium ml-1">
                      {format(parseISO(recentSession.date), "EEEE, MMMM d")}
                    </span>
                  )}?
                </p>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-start gap-2">
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
            <AlertDialogCancel onClick={() => setShowFinishQuestion(false)}>
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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Task Rollover</DialogTitle>
            <DialogDescription>
              {recentSession && (
                <span>
                  Select tasks from {format(parseISO(recentSession.date), "EEEE, MMMM d")} to add to today's plan
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col space-y-3 overflow-y-auto py-2 flex-1">
            {incompleteTasks.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllTasks}
                    className="h-8"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllTasks}
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
              <Button variant="outline" onClick={closeAndDiscard}>
                Cancel
              </Button>
              <Button onClick={handleTaskRolloverComplete} disabled={selectedCount === 0}>
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