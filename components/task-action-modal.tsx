import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressLoader } from "@/components/ui/progress-loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Brain, FileText } from "lucide-react";
import type { Task } from "@/lib/types";

interface TaskActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTask?: Task;
  currentAction?: string;
  progress: number;
}

const PROGRESS_STAGES = [
  { threshold: 20, label: "Analyzing", icon: Brain },
  { threshold: 40, label: "Organizing", icon: FileText },
  { threshold: 80, label: "Planning", icon: Clock },
  { threshold: 100, label: "Completing", icon: CheckCircle2 },
];

export function TaskActionModal({
  open,
  onOpenChange,
  currentTask,
  currentAction,
  progress,
}: TaskActionModalProps) {
  const currentStage =
    PROGRESS_STAGES.find((stage) => progress <= stage.threshold) ||
    PROGRESS_STAGES[PROGRESS_STAGES.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Processing Tasks</DialogTitle>
          <DialogDescription>
            {currentTask?.title || "Optimizing your work session..."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {currentStage && (
                <>
                  <currentStage.icon className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-700 text-sm">
                    {currentStage.label}
                  </span>
                </>
              )}
            </div>
            <ProgressLoader
              progress={progress}
              description={currentAction || "Initializing..."}
            />

            <div className="flex justify-between items-center">
              {PROGRESS_STAGES.map((stage) => {
                const Icon = stage.icon;
                const isActive = progress <= stage.threshold;
                const isPast = progress > stage.threshold;
                return (
                  <div
                    key={stage.label}
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all duration-300",
                      isPast && "text-green-600",
                      isActive && "scale-110",
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-full transition-colors duration-300",
                        isPast && "bg-green-50",
                        isActive && "bg-blue-50",
                        !isPast && !isActive && "bg-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isPast && "text-green-600",
                          isActive && "text-blue-600",
                          !isPast && !isActive && "text-muted-foreground",
                        )}
                      />
                    </div>
                    <span className="text-xs font-medium">{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {currentTask && (
            <div className="space-y-2 text-sm border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Task</span>
                <Badge variant={currentTask.isFrog ? "default" : "outline"}>
                  {currentTask.taskCategory}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{currentTask.duration} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difficulty</span>
                <span className="font-medium">{currentTask.difficulty}</span>
              </div>
              {currentTask.description && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {currentTask.description}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
