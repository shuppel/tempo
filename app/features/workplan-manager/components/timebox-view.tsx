import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, Pause, Brain, FileText, CheckCircle, Circle, Play, X, ChevronRight, ChevronDown, CircleDot, Undo2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import type { StoryBlock, TimeBox, TimeBoxTask } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface TimeboxViewProps {
  storyBlocks: StoryBlock[]
  isCurrentTimeBox: (timeBox: TimeBox) => boolean
  onTaskClick?: (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => void
  onStartTimeBox?: (storyId: string, timeBoxIndex: number, duration: number) => void
  onCompleteTimeBox?: (storyId: string, timeBoxIndex: number) => void
  onUndoCompleteTimeBox?: (storyId: string, timeBoxIndex: number) => void
  hideOverview?: boolean
}

// Colors and styles for different timebox types
const timeboxTypeConfig = {
  work: {
    icon: CheckCircle2,
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    title: "Focus Session"
  },
  "short-break": {
    icon: Pause,
    color: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-900",
    title: "Short Break"
  },
  "long-break": {
    icon: Brain,
    color: "text-violet-800 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-300 dark:border-violet-800",
    title: "Long Break"
  },
  lunch: {
    icon: Clock,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    title: "Lunch Break"
  },
  debrief: {
    icon: FileText,
    color: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900",
    title: "Debrief"
  }
} as const;

export const TimeboxView = ({
  storyBlocks,
  isCurrentTimeBox,
  onTaskClick,
  onStartTimeBox,
  onCompleteTimeBox,
  onUndoCompleteTimeBox,
  hideOverview = false
}: TimeboxViewProps) => {
  // Track if this is the first time the component is rendered
  const [isFirstRender, setIsFirstRender] = useState(true);
  
  // Ref to track the first start button
  const firstStartButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Determine if we should show animation guidance
  const [showGuidance, setShowGuidance] = useState(false);
  
  // Add the missing state variable for caption bubble
  const [showCaptionBubble, setShowCaptionBubble] = useState(false);
  
  // Reference for caption bubble positioning
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const captionBubbleRef = useRef<HTMLDivElement | null>(null);
  
  // Track which timebox should be highlighted as the next action
  const [nextActionTimebox, setNextActionTimebox] = useState<{storyId: string, timeBoxIndex: number} | null>(null);
  
  // Check local storage for first visit
  useEffect(() => {
    const hasSeenButtonGuidance = localStorage.getItem('hasSeenStartButtonGuidance')
    if (!hasSeenButtonGuidance) {
      setShowGuidance(true)
      setShowCaptionBubble(true)
      // Wait to set this until user dismisses the bubble
    }
    
    // Set first render to false after initial render
    if (isFirstRender) {
      setIsFirstRender(false)
    }
    
    // Auto-hide guidance after 15 seconds if not dismissed
    let timer: NodeJS.Timeout | null = null
    if (showGuidance) {
      timer = setTimeout(() => {
        setShowGuidance(false)
        setShowCaptionBubble(false)
        localStorage.setItem('hasSeenStartButtonGuidance', 'true')
      }, 15000)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isFirstRender, showGuidance])
  
  // Position the caption bubble relative to the button
  useEffect(() => {
    if (startButtonRef.current && captionBubbleRef.current && showCaptionBubble) {
      // Add a small delay to ensure the DOM is fully rendered
      const timer = setTimeout(() => {
        const buttonRect = startButtonRef.current?.getBoundingClientRect()
        if (buttonRect && captionBubbleRef.current) {
          // Position the bubble above the button
          captionBubbleRef.current.style.position = 'absolute'
          captionBubbleRef.current.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`
          captionBubbleRef.current.style.left = `${buttonRect.left + (buttonRect.width / 2) - 125}px`
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [showCaptionBubble, startButtonRef.current, captionBubbleRef.current])
  
  // Find the first todo timebox (work or break)
  const findFirstTodoTimeBox = () => {
    // Skip stories without ids
    if (!storyBlocks.length) return null
    
    for (const story of storyBlocks) {
      if (!story.id) continue; // Skip stories without IDs
      
      for (let i = 0; i < story.timeBoxes.length; i++) {
        const timeBox = story.timeBoxes[i];
        if (timeBox.status === 'todo' && !isTimeBoxActiveById(story.id, i)) {
          return {
            storyId: story.id,
            timeBoxIndex: i,
            duration: timeBox.duration,
            type: timeBox.type
          };
        }
      }
    }
    return null;
  };
  
  // Update nextActionTimebox when component mounts or storyBlocks changes
  useEffect(() => {
    const nextTodo = findFirstTodoTimeBox();
    if (nextTodo) {
      setNextActionTimebox({
        storyId: nextTodo.storyId,
        timeBoxIndex: nextTodo.timeBoxIndex
      });
    } else {
      setNextActionTimebox(null);
    }
  }, [storyBlocks]);
  
  // Helper function to check if a timebox is the current active one
  const isTimeBoxActiveById = (storyId: string, timeBoxIndex: number): boolean => {
    const story = storyBlocks.find(s => s.id === storyId);
    if (!story) return false;
    
    const timeBox = story.timeBoxes[timeBoxIndex];
    if (!timeBox) return false;
    
    return isCurrentTimeBox(timeBox);
  };
  
  const firstTodoTimeBox = findFirstTodoTimeBox();
  const isFirstTodoTimeBox = (storyId: string, timeBoxIndex: number) => 
    firstTodoTimeBox && 
    storyId === firstTodoTimeBox.storyId && 
    timeBoxIndex === firstTodoTimeBox.timeBoxIndex &&
    showGuidance;
    
  // Check if this timebox is the next action (should be highlighted)
  const isNextAction = (storyId: string, timeBoxIndex: number) => {
    // Check if there's any active timebox - if so, don't highlight next actions
    const hasActiveTimebox = storyBlocks.some(story => 
      story.timeBoxes.some(box => isCurrentTimeBox(box))
    );
    
    // This controls all "Next Action" styling throughout the component
    // When this returns false, no card highlighting or badges will show
    return nextActionTimebox && 
      storyId === nextActionTimebox.storyId && 
      timeBoxIndex === nextActionTimebox.timeBoxIndex &&
      !showGuidance && // Don't highlight next action if first-time guidance is visible
      !hasActiveTimebox; // Don't highlight next action if any timebox is active
  }
  
  // Handle dismissing the caption bubble
  const handleDismissBubble = () => {
    setShowCaptionBubble(false);
    localStorage.setItem('hasSeenStartButtonGuidance', 'true');
  };

  // Toggle task completion status
  const handleTaskClick = (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => {
    if (onTaskClick) {
      onTaskClick(storyId, timeBoxIndex, taskIndex, task);
    }
  };

  // Calculate total workplan duration
  const totalDuration = storyBlocks.reduce(
    (total: number, story: StoryBlock) => total + story.timeBoxes.reduce((sum: number, box: TimeBox) => sum + box.duration, 0), 
    0
  );

  // Calculate work and break distribution
  const workDuration = storyBlocks.reduce(
    (total: number, story: StoryBlock) => total + story.timeBoxes.filter(box => box.type === 'work').reduce((sum: number, box: TimeBox) => sum + box.duration, 0), 
    0
  );
  const breakDuration = totalDuration - workDuration;
  
  // Calculate total completed work timeboxes
  const totalWorkBoxes = storyBlocks.flatMap(s => s.timeBoxes.filter(t => t.type === 'work')).length;
  const completedWorkBoxes = storyBlocks.flatMap(s => s.timeBoxes.filter(t => t.type === 'work' && t.status === 'completed')).length;
  const workPlanProgress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0;

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* WorkPlan summary - conditionally rendered */}
      {!hideOverview && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-background rounded-lg p-4 border border-border shadow-sm">
          <div>
            <h3 className="font-medium">WorkPlan Overview</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Total: {Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain className="h-4 w-4" />
                <span>Focus: {Math.floor(workDuration / 60)}h {workDuration % 60}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Pause className="h-4 w-4" />
                <span>Breaks: {Math.floor(breakDuration / 60)}h {breakDuration % 60}m</span>
              </div>
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Progress value={workPlanProgress} className="w-full sm:w-32 h-2" />
            <span className="text-sm font-medium">{workPlanProgress}%</span>
          </div>
        </div>
      )}

      {/* Timebox list */}
      <div className="space-y-8">
        {storyBlocks.map((story, storyIndex) => {
            const storyId = story.id || `story-${storyIndex}`;
          
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
              
              <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 space-y-5 ml-2">
                {story.timeBoxes.map((timeBox, timeBoxIndex) => {
                  const config = timeboxTypeConfig[timeBox.type as keyof typeof timeboxTypeConfig] || timeboxTypeConfig.work;
                  const Icon = config.icon;
                  const isCompleted = timeBox.status === "completed";
                  const isActive = isCurrentTimeBox(timeBox);
                  const isWork = timeBox.type === "work";
                    const isCurrentFirstTodo = isFirstTodoTimeBox(storyId, timeBoxIndex);
                    const shouldHighlightNextAction = isNextAction(storyId, timeBoxIndex);
                    
                    // Get the styling for different timebox buttons
                    const getButtonStyles = () => {
                      const type = timeBox.type as string;
                      
                      // If this is the next action to take, use a prominent purple/orange style
                      if (shouldHighlightNextAction) {
                        return "bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/50";
                      }
                      
                      // Otherwise use type-specific styles
                      if (type === 'short-break' || type === 'long-break') {
                        return "bg-teal-100 hover:bg-teal-200 border-teal-300 text-teal-700 dark:bg-teal-950/30 dark:border-teal-900 dark:text-teal-400 dark:hover:bg-teal-950/50";
                      } else if (type === 'debrief') {
                        return "bg-rose-100 hover:bg-rose-200 border-rose-300 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50";
                      } else if (type === 'lunch') {
                        return "bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/50";
                      } else {
                        return "bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/50";
                      }
                    };
                    
                    // Get the animation properties for the button
                    const getButtonAnimation = () => {
                      // Check if there's any active timebox - if so, don't animate buttons
                      const hasActiveTimebox = storyBlocks.some(story => 
                        story.timeBoxes.some(box => isCurrentTimeBox(box))
                      );
                      
                      // Don't animate if any timebox is active
                      if (hasActiveTimebox) {
                        return { scale: 1 };
                      }
                      
                      // For the next action, use a more noticeable purple glow
                      if (shouldHighlightNextAction) {
                        return {
                          scale: [1, 1.05, 1.025, 1.012, 1],
                          boxShadow: [
                            "0 0 0 0 rgba(126, 34, 206, 0)",
                            "0 0 0 5px rgba(126, 34, 206, 0.3)",
                            "0 0 0 3px rgba(126, 34, 206, 0.2)",
                            "0 0 0 1px rgba(126, 34, 206, 0.1)",
                            "0 0 0 0 rgba(126, 34, 206, 0)"
                          ]
                        };
                      }
                      
                      // Default blue animation for first-time guidance
                      return {
                        scale: [1, 1.05, 1.025, 1.012, 1],
                        boxShadow: [
                          "0 0 0 0 rgba(59, 130, 246, 0)",
                          "0 0 0 5px rgba(59, 130, 246, 0.3)",
                          "0 0 0 3px rgba(59, 130, 246, 0.2)",
                          "0 0 0 1px rgba(59, 130, 246, 0.1)",
                          "0 0 0 0 rgba(59, 130, 246, 0)"
                        ]
                      };
                    };
                  
                  return (
                    <div 
                      key={`${storyId}-${timeBoxIndex}`} 
                      className={cn(
                        "relative", 
                          isCompleted && "opacity-75",
                          (isCurrentFirstTodo || shouldHighlightNextAction) && "border-purple-400"
                      )}
                    >
                      {/* Timeline marker */}
                      <div className={cn(
                        "absolute left-[-22px] top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 bg-background",
                        isWork 
                          ? isCompleted 
                            ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                            : isActive 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                                : shouldHighlightNextAction
                                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                              : "border-gray-400 dark:border-gray-600" 
                          : `border-${config.border.split('-')[1]}-500 dark:border-${config.border.split('-')[1]}-700 ${config.bg} dark:bg-${config.bg.split('-')[1]}-950/30`
                      )}>
                        {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {isActive && !isCompleted && isWork && <Circle className="h-3 w-3 text-gray-300 dark:text-gray-600" />}
                        {!isWork && <Icon className={cn("h-3 w-3", config.color)} />}
                      </div>
                      
                      {/* Timebox content */}
                      <div className={cn(
                        "rounded-lg p-4 shadow-sm",
                        isWork 
                          ? isCompleted 
                            ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900" 
                            : isActive 
                              ? "bg-blue-50 border border-blue-200 ring-2 ring-blue-300 ring-opacity-50 dark:bg-blue-950/30 dark:border-blue-900 dark:ring-blue-900 dark:ring-opacity-50" 
                                : shouldHighlightNextAction
                                  ? "bg-background border border-purple-300 ring-1 ring-purple-300 ring-opacity-50 dark:border-purple-800 dark:ring-purple-800 dark:ring-opacity-50"
                              : "bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800" 
                          : `${config.bg} border ${config.border} dark:bg-${config.bg.split('-')[1]}-950/30 dark:border-${config.border.split('-')[1]}-900`
                      )}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-normal",
                                isWork 
                                  ? isCompleted 
                                    ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900" 
                                    : isActive 
                                      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900" 
                                        : shouldHighlightNextAction
                                          ? "bg-purple-50 border-purple-300 dark:bg-purple-950/30 dark:border-purple-900"
                                      : "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800" 
                                  : `${config.bg} ${config.border} dark:bg-${config.bg.split('-')[1]}-950/30 dark:border-${config.border.split('-')[1]}-900`
                              )}
                            >
                              {config.title}
                            </Badge>
                            {isCompleted && <Badge variant="secondary" className="bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400">Completed</Badge>}
                            {isActive && <Badge className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400">In Progress</Badge>}
                            {shouldHighlightNextAction && <Badge className="bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/30 dark:border-purple-900 dark:text-purple-400">Next Action</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{timeBox.duration} mins</span>
                              
                              {/* Add Undo button for completed timeboxes */}
                              {isCompleted && onUndoCompleteTimeBox && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        if (window.confirm('Are you sure you want to go back to this task?')) {
                                          onUndoCompleteTimeBox(storyId, timeBoxIndex);
                                        }
                                      }}
                                      className="py-1 h-7 bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/50 rounded-full"
                                    >
                                      <Undo2 className="h-3 w-3 mr-1" />
                                      <span>Undo</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Revert this timebox to go back</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Modified to show Start button for ALL timeboxes, not just work timeboxes */}
                              {!isCompleted && !isActive && onStartTimeBox && (
                                isCurrentFirstTodo || shouldHighlightNextAction ? (
                                  <div className="relative">
                                    {/* Caption bubble pointing to the button */}
                                    {showCaptionBubble && isCurrentFirstTodo && (
                                      <div 
                                        ref={captionBubbleRef}
                                        className="absolute opacity-100 top-0 right-0 transform -translate-y-full translate-x-1/4 z-20 bg-blue-600 dark:bg-blue-800 text-white p-3 rounded-lg shadow-lg text-sm font-medium w-48 mb-2 transition-opacity duration-300"
                                        style={{ marginBottom: '10px' }}
                                      >
                                        <div className="font-medium">Start Here!</div>
                                        <p className="text-xs mt-1">
                                          Click this button to start your {isWork ? "first focus session" : "break"}.
                                        </p>
                                        <div className="absolute bottom-0 left-1/4 transform translate-y-full -translate-x-1/2 border-8 border-transparent border-t-blue-600 dark:border-t-blue-800"></div>
                                        <button 
                                          onClick={handleDismissBubble}
                                          className="absolute top-1 right-1 text-white/80 hover:text-white"
                                          aria-label="Dismiss guidance"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                    
                                    <motion.div
                                      initial={{ scale: 1 }}
                                      animate={getButtonAnimation()}
                                      transition={{ 
                                        repeat: storyBlocks.some(story => story.timeBoxes.some(box => isCurrentTimeBox(box))) ? 0 : Infinity,
                                        repeatType: "loop",
                                        duration: 3,
                                        ease: "easeInOut",
                                        times: [0, 0.25, 0.5, 0.75, 1]
                                      }}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            ref={isCurrentFirstTodo ? startButtonRef : undefined}
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => {
                                              if (isCurrentFirstTodo) setShowGuidance(false);
                                              onStartTimeBox(storyId, timeBoxIndex, timeBox.duration);
                                            }}
                                            className={cn("py-1 h-7 rounded-md", getButtonStyles())}
                                          >
                                            <Play className="h-3 w-3 mr-1" />
                                            Start
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{shouldHighlightNextAction ? "This is your next task!" : "Start this task"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </motion.div>
                                  </div>
                                ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onStartTimeBox(storyId, timeBoxIndex, timeBox.duration)}
                                    className={cn("py-1 h-7 rounded-md", timeBox.status === 'todo' && getButtonStyles())}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                                )
                            )}
                              
                            {isActive && onCompleteTimeBox && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                  onClick={() => {
                                    onCompleteTimeBox(storyId, timeBoxIndex);
                                    // After completing, find the next task to highlight
                                    const nextTodo = findFirstTodoTimeBox();
                                    if (nextTodo) {
                                      setNextActionTimebox({
                                        storyId: nextTodo.storyId,
                                        timeBoxIndex: nextTodo.timeBoxIndex
                                      });
                                    }
                                  }}
                                  className="py-1 h-7 bg-green-100 border-green-300 text-green-700 hover:bg-green-200 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/50 rounded-full"
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
                                  !isCompleted && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                  task.status === "completed" && "bg-green-50/50 dark:bg-green-950/20"
                                )}
                                onClick={!isCompleted && onTaskClick ? () => handleTaskClick(storyId, timeBoxIndex, taskIndex, task) : undefined}
                              >
                                <div className="flex-shrink-0">
                                  {task.status === 'completed' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                  )}
                                </div>
                                <span className={cn(
                                  "text-sm",
                                  task.status === 'completed' && "line-through text-gray-500 dark:text-gray-400"
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
    </TooltipProvider>
  );
}; 