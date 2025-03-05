"use client";

import React, { useEffect, useState } from "react";
import { 
  analyzeTaskContext, 
  getContextRecommendations, 
  isTaskDurationAppropriate,
  TaskContextType,
  TASK_CONTEXT_RECOMMENDATIONS
} from "@/lib/taskContextAnalyzer";
import type { Task } from "@/lib/types";
import { 
  Clock, 
  AlertCircle, 
  Info,
  Brain,
  Timer,
  ArrowRight,
  Book, 
  Palette, 
  ClipboardList, 
  CalendarCheck, 
  BookOpen, 
  Pen, 
  Code, 
  CheckSquare, 
  Search,
  Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserPreferences } from "@/lib/userPreferences";
import { cn } from "@/lib/utils";

// Icons for different task types
const TASK_CONTEXT_ICONS: Record<TaskContextType, React.ReactNode> = {
  focus: <Brain className="h-4 w-4" />,
  meeting: <Clock className="h-4 w-4" />,
  learning: <Book className="h-4 w-4" />,
  creative: <Palette className="h-4 w-4" />,
  admin: <ClipboardList className="h-4 w-4" />,
  planning: <CalendarCheck className="h-4 w-4" />,
  reading: <BookOpen className="h-4 w-4" />,
  writing: <Pen className="h-4 w-4" />,
  coding: <Code className="h-4 w-4" />,
  review: <CheckSquare className="h-4 w-4" />,
  research: <Search className="h-4 w-4" />
};

interface TaskDurationAdvisorProps {
  task: Partial<Task>;
  onChange?: (updatedTask: Partial<Task>) => void;
}

export function TaskDurationAdvisor({ task, onChange }: TaskDurationAdvisorProps) {
  const { preferences } = useUserPreferences();
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [detectedContext, setDetectedContext] = useState<TaskContextType | null>(null);
  const [appropriatenessCheck, setAppropriatenessCheck] = useState<ReturnType<typeof isTaskDurationAppropriate> | null>(null);
  const [suggestedDuration, setSuggestedDuration] = useState<number | null>(null);
  
  // Analyze task when it changes
  useEffect(() => {
    if (!task || !task.title) return;
    
    // Need to cast to Task since we're using a partial
    const taskForAnalysis = task as Task;
    
    // Only run if we have enough information
    if (taskForAnalysis.title && taskForAnalysis.taskCategory) {
      // Detect task context
      const context = analyzeTaskContext(taskForAnalysis);
      setDetectedContext(context);
      
      // Check if duration is appropriate for this context
      if (taskForAnalysis.duration) {
        const check = isTaskDurationAppropriate(taskForAnalysis);
        setAppropriatenessCheck(check);
        
        // Set suggested duration if needed
        if (!check.appropriate && check.recommendation) {
          if (check.recommendation.minDuration) {
            setSuggestedDuration(check.recommendation.minDuration);
          } else if (check.recommendation.maxDuration) {
            setSuggestedDuration(check.recommendation.maxDuration);
          }
        } else {
          setSuggestedDuration(null);
        }
      }
    }
  }, [task]);
  
  // Handle duration update
  const handleAcceptSuggestion = () => {
    if (!suggestedDuration || !onChange) return;
    
    onChange({
      ...task,
      duration: suggestedDuration
    });
  };
  
  // If we don't have enough information yet, render nothing
  if (!detectedContext || !task.title) {
    return null;
  }
  
  // Get recommendations for this context
  const recommendations = TASK_CONTEXT_RECOMMENDATIONS[detectedContext];
  
  // Check if duration falls within acceptable range
  const hasAppropriateLength = !task.duration || 
    (task.duration >= recommendations.minDuration && 
     task.duration <= recommendations.maxDuration);
  
  // Calculate flow state development
  const flowStateLikelihood = task.duration 
    ? Math.min(100, Math.round((task.duration / recommendations.flowStateThreshold) * 100))
    : 0;
  
  return (
    <div className="mt-4 space-y-4">
      {/* Context Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "flex items-center gap-1.5 px-2 py-1",
              !hasAppropriateLength && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
            )}
          >
            {TASK_CONTEXT_ICONS[detectedContext] || <Clock className="h-4 w-4" />}
            <span>Detected: {detectedContext}</span>
          </Badge>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs"
            onClick={() => setShowMoreInfo(true)}
          >
            <Info className="h-3.5 w-3.5 mr-1" />
            More Info
          </Button>
        </div>
        
        {flowStateLikelihood > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  <Progress 
                    value={flowStateLikelihood} 
                    className="w-20 h-1.5" 
                    indicatorClassName="bg-indigo-500 dark:bg-indigo-400"
                  />
                  <span className="text-xs text-muted-foreground">Flow</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {flowStateLikelihood < 50 
                    ? "This duration may be too short to achieve flow state"
                    : flowStateLikelihood >= 100
                      ? "Ideal duration for achieving flow state"
                      : "A good duration for developing flow state"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {/* Duration Warning */}
      {!hasAppropriateLength && task.duration && appropriatenessCheck?.message && (
        <Alert 
          variant="default" 
          className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col space-y-2">
              <p>{appropriatenessCheck.message}</p>
              {suggestedDuration && (
                <Button 
                  size="sm" 
                  className="w-fit"
                  onClick={handleAcceptSuggestion}
                >
                  Update to {suggestedDuration} minutes
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* More Information Dialog */}
      <AlertDialog open={showMoreInfo} onOpenChange={setShowMoreInfo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {TASK_CONTEXT_ICONS[detectedContext] || <Clock className="h-5 w-5" />}
              {detectedContext} Task Information
            </AlertDialogTitle>
            <AlertDialogDescription>
              Recommendations for this task type based on productivity research.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <p className="text-sm mb-4">{recommendations.description}</p>
            
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Examples</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {recommendations.examples.map((example: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">Recommended Duration</Label>
                <div className="mt-1 space-y-2">
                  <div className="text-sm">
                    {recommendations.minDuration} - {recommendations.maxDuration} minutes
                  </div>
                  <div className="px-2 relative pt-2">
                    <div className="absolute left-0 top-0 text-xs text-muted-foreground">Min</div>
                    <div className="absolute right-0 top-0 text-xs text-muted-foreground">Max</div>
                    <Slider
                      disabled
                      defaultValue={[recommendations.minDuration, recommendations.maxDuration]}
                      max={180}
                      step={5}
                      className="mt-4"
                    />
                    <div className="absolute top-4 h-6 w-0.5 bg-blue-500 dark:bg-blue-400" style={{
                      left: `${(recommendations.idealBreakInterval / 180) * 100}%`
                    }}>
                      <div className="absolute -top-4 -left-10 text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap">
                        Break point
                      </div>
                    </div>
                    
                    <div className="absolute top-4 h-6 w-0.5 bg-indigo-500 dark:bg-indigo-400" style={{
                      left: `${(recommendations.flowStateThreshold / 180) * 100}%`
                    }}>
                      <div className="absolute -top-4 -left-10 text-xs text-indigo-500 dark:text-indigo-400 whitespace-nowrap">
                        Flow state
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Break Interval</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{recommendations.idealBreakInterval} minutes</span>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Break Duration</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{recommendations.breakDuration} minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {suggestedDuration && (
              <AlertDialogAction onClick={handleAcceptSuggestion}>
                Update Duration
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 