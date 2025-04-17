"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { FileText, X, ChevronRight, BarChart3, TrendingUp, Play, PauseCircle, Clock, Brain, CheckCircle, Heart, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Slider } from "@/app/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

// Type for session metrics
interface SessionMetrics {
  totalFocusTime: number; // in seconds
  totalBreakTime: number; // in seconds
  totalSessionTime: number; // in seconds
  averageBreakDuration: number; // in seconds
  breakCount: number;
  completedTasks: number;
  totalTasks: number;
  averageTaskCompletionTime: number; // in seconds
  focusConsistency: number; // scale of 0-10
  taskCompletionRate: number; // ratio > 1 means faster than expected
  totalActualTime: number; // in seconds
  totalEstimatedTime: number; // in seconds
}

export interface SessionDebriefModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SessionDebriefData) => void
  sessionDate: string
  sessionMetrics: SessionMetrics | null
}

export interface SessionDebriefData {
  sessionDate: string
  productivity: number
  stress: number
  satisfaction: number
  energy: number
  focus: number
  metrics?: SessionMetrics
}

// Helper functions
const formatTime = (seconds: number): string => {
  if (!seconds) return '0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const calculatePercentage = (part: number, total: number): number => {
  if (!total) return 0;
  return Math.round((part / total) * 100);
};

const getFocusConsistencyLabel = (value: number): string => {
  if (value >= 8) return 'Excellent';
  if (value >= 6) return 'Good';
  if (value >= 4) return 'Average';
  return 'Needs Improvement';
};

const getFocusConsistencyColor = (value: number): string => {
  if (value >= 8) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (value >= 6) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (value >= 4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
};

const getCompletionSpeedLabel = (value: number): string => {
  if (value >= 1.5) return 'Very Fast';
  if (value >= 1.1) return 'Fast';
  if (value >= 0.9) return 'On Target';
  if (value >= 0.7) return 'Slower';
  return 'Much Slower';
};

const getCompletionSpeedColor = (value: number): string => {
  if (value >= 1.5) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (value >= 1.1) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (value >= 0.9) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
};

const getProgressValue = (value: number): number => {
  // Convert completion rate to progress value (0-100)
  // 0.5x = 0%, 1.0x = 50%, 1.5x = 100%
  return Math.min(Math.max((value - 0.5) * 100, 0), 100);
};


// If mock data is truly necessary, consider a more maintainable approach:
const generateMockSessionMetrics = (): SessionMetrics => {
  // Dynamically generate mock data with some randomness
  return {
    totalFocusTime: Math.floor(Math.random() * 5400), // Random time up to 1.5 hours
    totalBreakTime: Math.floor(Math.random() * 1800), // Random break time up to 30 minutes
    totalSessionTime: Math.floor(Math.random() * 7200), // Random total session time up to 2 hours
    averageBreakDuration: Math.floor(Math.random() * 600), // Random break duration up to 10 minutes
    breakCount: Math.floor(Math.random() * 5), // Random break count
    completedTasks: Math.floor(Math.random() * 6), // Random completed tasks
    totalTasks: 5, // Keep this consistent
    averageTaskCompletionTime: Math.floor(Math.random() * 2000), // Random task completion time
    focusConsistency: Number((Math.random() * 10).toFixed(1)), // Random focus consistency
    taskCompletionRate: Number((Math.random() * 2).toFixed(1)), // Random completion rate
    totalActualTime: Math.floor(Math.random() * 5400), // Random actual time
    totalEstimatedTime: Math.floor(Math.random() * 7200), // Random estimated time
  };
};

// Only generate mock data in development environment
const mockSession: SessionMetrics = process.env.NODE_ENV === 'development' 
  ? generateMockSessionMetrics() 
  : {} as SessionMetrics;

// Descriptors for the sliders
const productivityDescriptors = [
  "Very low", "Low", "Below average", "Somewhat low", "Average", 
  "Somewhat high", "Above average", "High", "Very high", "Exceptional"
];

const stressDescriptors = [
  "None", "Minimal", "Very low", "Low", "Moderate", 
  "Somewhat high", "High", "Very high", "Severe", "Extreme"
];

const satisfactionDescriptors = [
  "Very dissatisfied", "Dissatisfied", "Somewhat dissatisfied", "Slightly dissatisfied", "Neutral", 
  "Slightly satisfied", "Somewhat satisfied", "Satisfied", "Very satisfied", "Extremely satisfied"
];

const energyDescriptors = [
  "Completely drained", "Very low", "Low", "Somewhat low", "Moderate", 
  "Somewhat high", "Good", "Very good", "Excellent", "Boundless"
];

const focusDescriptors = [
  "Completely distracted", "Very distracted", "Distracted", "Somewhat distracted", "Neutral", 
  "Somewhat focused", "Focused", "Very focused", "Deeply focused", "Flow state"
];

export function SessionDebriefModal({
  isOpen,
  onClose,
  onSave,
  sessionDate,
  sessionMetrics
}: SessionDebriefModalProps) {
  const [reflections, setReflections] = useState("")
  const [productivityRating, setProductivityRating] = useState(5)
  const [stressLevel, setStressLevel] = useState(5)
  const [satisfactionRating, setSatisfactionRating] = useState(5)
  const [energyLevel, setEnergyLevel] = useState(5)
  const [focusRating, setFocusRating] = useState(5)
  const [currentPage, setCurrentPage] = useState<'reflection' | 'feelings' | 'metrics'>('reflection')

  React.useEffect(() => {
    console.log("SessionDebriefModal isOpen:", isOpen);
  }, [isOpen]);

  // Reset state when modal is opened
  // This useEffect ensures that every time the modal is opened, 
  // the current page is reset to the first page ('reflection')
  // This prevents the modal from retaining its previous navigation state
  // and provides a consistent starting point for the user's debrief experience
  React.useEffect(() => {
    if (isOpen) {
      setCurrentPage('reflection');
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    const debriefData: SessionDebriefData = {
      sessionDate,
      productivity: productivityRating,
      stress: stressLevel,
      satisfaction: satisfactionRating,
      energy: energyLevel,
      focus: focusRating,
      metrics: sessionMetrics || undefined
    };
    console.log("Saving debrief data:", debriefData);
    onSave(debriefData);
    onClose();
  }, [productivityRating, stressLevel, satisfactionRating, energyLevel, focusRating, sessionDate, onSave, sessionMetrics]);

  const handleNextPage = () => {
    if (currentPage === 'reflection') {
      setCurrentPage('feelings');
    } else if (currentPage === 'feelings') {
      setCurrentPage('metrics');
    }
  };

  const handlePreviousPage = () => {
    if (currentPage === 'metrics') {
      setCurrentPage('feelings');
    } else if (currentPage === 'feelings') {
      setCurrentPage('reflection');
    }
  };

  // Sample metrics if none provided
  const session = sessionMetrics || mockSession;

  if (!isOpen) return null

  // For debugging purposes, add a highly visible indicator
  console.log("Rendering SessionDebriefModal with isOpen:", isOpen, "sessionDate:", sessionDate);

  // Render the metrics view
  const renderMetricsView = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Focus Time */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <Clock className="h-4 w-4" />
                  Focus Time
                </h3>
                <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(session.totalFocusTime)}
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {calculatePercentage(session.totalFocusTime, session.totalSessionTime)}% of session
              </Badge>
            </div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-2">
              You spent {formatTime(session.totalFocusTime)} in focused work out of {formatTime(session.totalSessionTime)} total session time.
            </p>
          </div>

          {/* Card 2: Breaks */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                  <PauseCircle className="h-4 w-4" />
                  Break Balance
                </h3>
                <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatTime(session.totalBreakTime)}
                </div>
              </div>
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                {calculatePercentage(session.totalBreakTime, session.totalSessionTime)}% of session
              </Badge>
            </div>
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-2">
              You took {session.breakCount} breaks totaling {formatTime(session.totalBreakTime)}, averaging {formatTime(session.averageBreakDuration)} per break.
            </p>
          </div>

          {/* Card 3: Task Completion */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 text-green-700 dark:text-green-300">
                  <Play className="h-4 w-4" />
                  Task Completion
                </h3>
                <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                  {session.completedTasks} / {session.totalTasks}
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                {calculatePercentage(session.completedTasks, session.totalTasks)}% completion
              </Badge>
            </div>
            <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2">
              You completed {session.completedTasks} of {session.totalTasks} planned tasks, with an average completion time of {formatTime(session.averageTaskCompletionTime)} per task.
            </p>
          </div>

          {/* Card 4: Focus Consistency */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <Brain className="h-4 w-4" />
                  Focus Consistency
                </h3>
                <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {session.focusConsistency ? session.focusConsistency.toFixed(1) : '0.0'}/10
                </div>
              </div>
              <Badge className={`${getFocusConsistencyColor(session.focusConsistency || 0)}`}>
                {getFocusConsistencyLabel(session.focusConsistency || 0)}
              </Badge>
            </div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-2">
              Your focus consistency score reflects how well you maintained focus without interruptions during work periods.
            </p>
          </div>

          {/* Card 5: Task Completion Speed */}
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4 md:col-span-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <TrendingUp className="h-4 w-4" />
                  Task Completion Speed
                </h3>
                <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {session.taskCompletionRate ? session.taskCompletionRate.toFixed(1) : '0.0'}x
                </div>
              </div>
              <Badge className={`${getCompletionSpeedColor(session.taskCompletionRate || 0)}`}>
                {getCompletionSpeedLabel(session.taskCompletionRate || 0)}
              </Badge>
            </div>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-2">
              Your completion speed compares your actual task completion times against estimated times. Above 1.0x means faster than expected.
            </p>

            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-700 dark:text-rose-300 font-medium">Historical Performance</span>
                <span className="text-rose-500/70">{formatTime(session.totalActualTime)} vs {formatTime(session.totalEstimatedTime)} estimated</span>
              </div>
              <Progress value={getProgressValue(session.taskCompletionRate || 0)} className="h-2" />
              <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                <span>Slower</span>
                <span>On Target</span>
                <span>Faster</span>
              </div>
            </div>
          </div>
        </div>

        {/* Session Ratings Summary */}
        <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Session Ratings Overview</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Productivity</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{productivityRating}/10</div>
              <div className="text-xs text-rose-500 mt-1">{productivityDescriptors[productivityRating-1]}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Stress</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{stressLevel}/10</div>
              <div className="text-xs text-rose-500 mt-1">{stressDescriptors[stressLevel-1]}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Satisfaction</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{satisfactionRating}/10</div>
              <div className="text-xs text-rose-500 mt-1">{satisfactionDescriptors[satisfactionRating-1]}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Energy</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{energyLevel}/10</div>
              <div className="text-xs text-rose-500 mt-1">{energyDescriptors[energyLevel-1]}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Focus</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{focusRating}/10</div>
              <div className="text-xs text-rose-500 mt-1">{focusDescriptors[focusRating-1]}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the feelings view
  const renderFeelingsView = () => {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-2">Rate Your Experience</h3>
          <p className="text-blue-700/80 dark:text-blue-300/80 text-sm mb-3">
            How did you feel during this work session? Rating your experience helps identify patterns
            in your productivity and well-being over time.
          </p>
        </div>

        <div className="space-y-6 pt-2">
          {/* Productivity Rating */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="productivity">Productivity</Label>
              <div className="flex flex-col items-end">
                <span className="text-sm text-muted-foreground">{productivityRating}/10</span>
                <span className="text-xs font-medium text-blue-500">{productivityDescriptors[productivityRating-1]}</span>
              </div>
            </div>
            <Slider
              id="productivity"
              min={1}
              max={10}
              step={1}
              value={[productivityRating]}
              onValueChange={(value: number[]) => setProductivityRating(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Unproductive</span>
              <span>Very productive</span>
            </div>
          </div>

          {/* Stress Level */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="stress">Stress Level</Label>
              <div className="flex flex-col items-end">
                <span className="text-sm text-muted-foreground">{stressLevel}/10</span>
                <span className="text-xs font-medium text-blue-500">{stressDescriptors[stressLevel-1]}</span>
              </div>
            </div>
            <Slider
              id="stress"
              min={1}
              max={10}
              step={1}
              value={[stressLevel]}
              onValueChange={(value: number[]) => setStressLevel(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Relaxed</span>
              <span>Overwhelmed</span>
            </div>
          </div>

          {/* Satisfaction Rating */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="satisfaction">Satisfaction</Label>
              <div className="flex flex-col items-end">
                <span className="text-sm text-muted-foreground">{satisfactionRating}/10</span>
                <span className="text-xs font-medium text-blue-500">{satisfactionDescriptors[satisfactionRating-1]}</span>
              </div>
            </div>
            <Slider
              id="satisfaction"
              min={1}
              max={10}
              step={1}
              value={[satisfactionRating]}
              onValueChange={(value: number[]) => setSatisfactionRating(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Unsatisfied</span>
              <span>Very satisfied</span>
            </div>
          </div>

          {/* Energy Level */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="energy">Energy Level</Label>
              <div className="flex flex-col items-end">
                <span className="text-sm text-muted-foreground">{energyLevel}/10</span>
                <span className="text-xs font-medium text-blue-500">{energyDescriptors[energyLevel-1]}</span>
              </div>
            </div>
            <Slider
              id="energy"
              min={1}
              max={10}
              step={1}
              value={[energyLevel]}
              onValueChange={(value: number[]) => setEnergyLevel(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Exhausted</span>
              <span>Energized</span>
            </div>
          </div>

          {/* Focus Rating */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="focus">Focus Quality</Label>
              <div className="flex flex-col items-end">
                <span className="text-sm text-muted-foreground">{focusRating}/10</span>
                <span className="text-xs font-medium text-blue-500">{focusDescriptors[focusRating-1]}</span>
              </div>
            </div>
            <Slider
              id="focus"
              min={1}
              max={10}
              step={1}
              value={[focusRating]}
              onValueChange={(value: number[]) => setFocusRating(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Distracted</span>
              <span>Deep focus</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the reflection view
  const renderReflectionView = () => {
    return (
      <div className="space-y-6">
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-rose-700 dark:text-rose-300 mb-2">Time for Reflection</h3>
          <p className="text-rose-700/80 dark:text-rose-300/80 text-sm mb-3">
            Reflecting on your work session helps strengthen neural pathways and improves future productivity.
            Take 5-15 minutes to consider these questions:
          </p>
          <ul className="space-y-2 text-sm text-rose-600 dark:text-rose-400">
            <li className="flex gap-2">
              <CheckCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>What did you accomplish during this session?</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>What worked well and what could be improved?</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>What were your biggest distractions or challenges?</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>How will you approach your next session differently?</span>
            </li>
          </ul>
        </div>

        <div>
          <Label htmlFor="reflections" className="mb-2 block">
            Session Reflection
          </Label>
          <Textarea
            id="reflections"
            className="min-h-[250px]"
            placeholder="Write your session reflection here..."
            value={reflections}
            onChange={(e) => setReflections(e.target.value)}
          />
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center"
      style={{
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        // Close when clicking outside
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-background rounded-lg shadow-xl border-4 border-rose-500 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {currentPage === 'reflection' ? (
              <FileText className="h-5 w-5 text-rose-500" />
            ) : currentPage === 'feelings' ? (
              <Heart className="h-5 w-5 text-blue-500" />
            ) : (
              <BarChart3 className="h-5 w-5 text-green-500" />
            )}
            <h2 className="text-xl font-semibold">
              {currentPage === 'reflection' ? 'Session Reflection' : 
               currentPage === 'feelings' ? 'Session Experience' : 
               'Productivity Metrics'}
            </h2>
            {currentPage === 'reflection' && (
              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 text-xs ml-2">
                5-15 min
              </Badge>
            )}
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Page indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${currentPage === 'reflection' ? 'bg-rose-500' : 'bg-gray-300'}`} />
            <div className="w-8 h-0.5 bg-gray-300" />
            <div className={`w-3 h-3 rounded-full ${currentPage === 'feelings' ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <div className="w-8 h-0.5 bg-gray-300" />
            <div className={`w-3 h-3 rounded-full ${currentPage === 'metrics' ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Content area */}
        {currentPage === 'reflection' ? (
          renderReflectionView()
        ) : currentPage === 'feelings' ? (
          renderFeelingsView()
        ) : (
          renderMetricsView()
        )}

        {/* Footer with navigation/action buttons */}
        <div className="flex justify-between gap-2 mt-6">
          {currentPage === 'reflection' ? (
            <div></div>
          ) : (
            <Button 
              variant="outline" 
              onClick={handlePreviousPage}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {currentPage === 'feelings' ? 'Back to Reflection' : 'Back to Experience'}
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {currentPage === 'metrics' ? (
              <Button 
                onClick={handleSave}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                Save Debrief
              </Button>
            ) : (
              <Button 
                className={`gap-2 ${currentPage === 'reflection' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                onClick={handleNextPage}
              >
                {currentPage === 'reflection' ? 'Rate Experience' : 'View Metrics'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 