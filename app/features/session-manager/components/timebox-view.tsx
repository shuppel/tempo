import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, Pause, Brain, FileText, CheckCircle, Circle, Play } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import type { StoryBlock, TimeBox, TimeBoxTask } from "@/lib/types"

export interface TimeboxViewProps {
  storyBlocks: StoryBlock[]
  isCurrentTimeBox: (timeBox: TimeBox) => boolean
  onTaskClick?: (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => void
  onStartTimeBox?: (storyId: string, timeBoxIndex: number, duration: number) => void
  onCompleteTimeBox?: (storyId: string, timeBoxIndex: number) => void
  hideOverview?: boolean
}

// Colors and styles for different timebox types
const timeboxTypeConfig = {
  work: {
    icon: CheckCircle2,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    title: "Focus Session"
  },
  "short-break": {
    icon: Pause,
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    title: "Short Break"
  },
  "long-break": {
    icon: Brain,
    color: "text-violet-800",
    bg: "bg-violet-50",
    border: "border-violet-300",
    title: "Long Break"
  },
  lunch: {
    icon: Clock,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    title: "Lunch Break"
  },
  debrief: {
    icon: FileText,
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    title: "Debrief"
  }
} as const;

export const TimeboxView = ({
  storyBlocks,
  isCurrentTimeBox,
  onTaskClick,
  onStartTimeBox,
  onCompleteTimeBox,
  hideOverview = false
}: TimeboxViewProps) => {
  // Helper to get a stable ID for stories that don't have one
  const getStoryId = (story: StoryBlock, index: number): string => {
    return story.id || `story-${index}`;
  };

  // Toggle task completion status
  const handleTaskClick = (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => {
    if (onTaskClick) {
      onTaskClick(storyId, timeBoxIndex, taskIndex, task);
    }
  };

  // Calculate total session duration
  const totalDuration = storyBlocks.reduce(
    (total, story) => total + story.timeBoxes.reduce((sum, box) => sum + box.duration, 0), 
    0
  );

  // Calculate work and break distribution
  const workDuration = storyBlocks.reduce(
    (total, story) => total + story.timeBoxes.filter(box => box.type === 'work').reduce((sum, box) => sum + box.duration, 0), 
    0
  );
  const breakDuration = totalDuration - workDuration;
  
  // Calculate total completed work timeboxes
  const totalWorkBoxes = storyBlocks.flatMap(s => s.timeBoxes.filter(t => t.type === 'work')).length;
  const completedWorkBoxes = storyBlocks.flatMap(s => s.timeBoxes.filter(t => t.type === 'work' && t.status === 'completed')).length;
  const sessionProgress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Session summary - conditionally rendered */}
      {!hideOverview && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div>
            <h3 className="font-medium">Session Overview</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Total: {Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                <span>Work: {Math.floor(workDuration / 60)}h {workDuration % 60}m</span>
              </div>
              <div className="flex items-center gap-1">
                <Pause className="h-3.5 w-3.5 text-teal-500" />
                <span>Breaks: {Math.floor(breakDuration / 60)}h {breakDuration % 60}m</span>
              </div>
            </div>
          </div>
          <div className="w-full sm:w-36">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span>Progress</span>
              <span>{sessionProgress}%</span>
            </div>
            <Progress value={sessionProgress} className="h-2" />
          </div>
        </div>
      )}

      {/* Timebox list */}
      <div className="space-y-8">
        {storyBlocks.map((story, storyIndex) => {
          const storyId = getStoryId(story, storyIndex);
          
          return (
            <div key={storyId} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{story.title}</h3>
                {story.progress !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Progress value={story.progress} className="w-24 h-1.5" />
                    <span className="text-muted-foreground text-xs">{story.progress}%</span>
                  </div>
                )}
              </div>
              
              <div className="relative pl-6 border-l-2 border-gray-200 space-y-5 ml-2">
                {story.timeBoxes.map((timeBox, timeBoxIndex) => {
                  const config = timeboxTypeConfig[timeBox.type as keyof typeof timeboxTypeConfig] || timeboxTypeConfig.work;
                  const Icon = config.icon;
                  const isCompleted = timeBox.status === "completed";
                  const isActive = isCurrentTimeBox(timeBox);
                  const isWork = timeBox.type === "work";
                  
                  return (
                    <div 
                      key={`${storyId}-${timeBoxIndex}`} 
                      className={cn(
                        "relative", 
                        isCompleted && "opacity-75"
                      )}
                    >
                      {/* Timeline marker */}
                      <div className={cn(
                        "absolute left-[-22px] top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 bg-background",
                        isWork 
                          ? isCompleted 
                            ? "border-green-500 bg-green-50" 
                            : isActive 
                              ? "border-blue-500 bg-blue-50" 
                              : "border-gray-300" 
                          : `${config.border.replace('border', 'border')} ${config.bg}`
                      )}>
                        {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {isActive && !isCompleted && <Clock className="h-3 w-3 text-blue-500 animate-pulse" />}
                        {!isActive && !isCompleted && isWork && <Circle className="h-3 w-3 text-gray-300" />}
                        {!isWork && <Icon className={cn("h-3 w-3", config.color)} />}
                      </div>
                      
                      {/* Timebox content */}
                      <div className={cn(
                        "rounded-lg p-4 shadow-sm",
                        isWork 
                          ? isCompleted 
                            ? "bg-green-50 border border-green-100" 
                            : isActive 
                              ? "bg-blue-50 border border-blue-100 ring-2 ring-blue-100 ring-opacity-50" 
                              : "bg-white border border-gray-100" 
                          : `${config.bg} border ${config.border}`
                      )}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-normal",
                                isWork 
                                  ? isCompleted 
                                    ? "bg-green-50" 
                                    : isActive 
                                      ? "bg-blue-50" 
                                      : "bg-white/80" 
                                  : config.bg
                              )}
                            >
                              {config.title}
                            </Badge>
                            {isCompleted && <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>}
                            {isActive && <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{timeBox.duration} mins</span>
                            {isWork && !isCompleted && !isActive && onStartTimeBox && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onStartTimeBox(storyId, timeBoxIndex, timeBox.duration)}
                                className="py-1 h-7"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {isActive && onCompleteTimeBox && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onCompleteTimeBox(storyId, timeBoxIndex)}
                                className="py-1 h-7 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Tasks for work sessions */}
                        {isWork && timeBox.tasks && timeBox.tasks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {timeBox.tasks.map((task, taskIndex) => (
                              <div 
                                key={taskIndex}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded",
                                  !isCompleted && "cursor-pointer hover:bg-gray-50",
                                  task.status === "completed" && "bg-green-50/50"
                                )}
                                onClick={!isCompleted && onTaskClick ? () => handleTaskClick(storyId, timeBoxIndex, taskIndex, task) : undefined}
                              >
                                <div className="flex-shrink-0">
                                  {task.status === 'completed' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-gray-300" />
                                  )}
                                </div>
                                <span className={cn(
                                  "text-sm",
                                  task.status === 'completed' && "line-through text-gray-500"
                                )}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 