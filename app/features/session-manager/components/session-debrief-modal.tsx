"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { FileText, X, ChevronRight, BarChart3, TrendingUp, Play, PauseCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Slider } from "@/app/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface SessionDebriefModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SessionDebriefData) => void
  sessionDate: string
  sessionMetrics: SessionMetrics | null
}

export interface SessionMetrics {
  totalTimeSpent: number
  plannedTime: number
  timeSaved: number
  averageBreakTime: number
  focusRating: number
  focusConsistency: number
  longestFocusStretch: number
  taskCompletionSpeed: number
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

// Rating scale descriptors
const productivityDescriptors = [
  "Stationary", "Sluggish", "Slovenly", "Passive", "Average",
  "Efficient", "Productive", "Industrious", "High-Performing", "Exceptional"
];

const stressDescriptors = [
  "Serene", "Calm", "Relaxed", "Easy", "Balanced",
  "Tense", "Pressured", "Strained", "Overwhelmed", "Burnt-out"
];

const satisfactionDescriptors = [
  "Disappointed", "Unsatisfied", "Underwhelmed", "Indifferent", "Content",
  "Pleased", "Satisfied", "Fulfilled", "Delighted", "Ecstatic"
];

const energyDescriptors = [
  "Depleted", "Exhausted", "Drained", "Tired", "Low",
  "Adequate", "Energized", "Lively", "Vigorous", "Exuberant"
];

const focusDescriptors = [
  "Scattered", "Distracted", "Unfocused", "Wavering", "Inconsistent",
  "Attentive", "Concentrated", "Engaged", "Focused", "Deeply immersed"
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
  const [currentPage, setCurrentPage] = useState<'feedback' | 'metrics'>('feedback')

  React.useEffect(() => {
    console.log("SessionDebriefModal isOpen:", isOpen);
  }, [isOpen]);

  // Reset state when modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setCurrentPage('feedback');
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
    setCurrentPage('metrics');
  }

  // Sample metrics if none provided
  const metrics = sessionMetrics || {
    totalTimeSpent: 180, // 3 hours in minutes
    plannedTime: 210, // 3.5 hours in minutes
    timeSaved: 30, // 30 minutes saved
    averageBreakTime: 8, // 8 minutes per break
    focusRating: 7.5, // 7.5/10
    focusConsistency: 85, // 85%
    longestFocusStretch: 45, // 45 minutes
    taskCompletionSpeed: 90, // 90% is good
  };

  if (!isOpen) return null

  // For debugging purposes, add a highly visible indicator
  console.log("Rendering SessionDebriefModal with isOpen:", isOpen, "sessionDate:", sessionDate);

  // Render the metrics view
  const renderMetricsView = () => {
    if (!sessionMetrics) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Metrics Available</h3>
          <p className="text-sm text-muted-foreground text-center">
            Complete more tasks to generate session metrics
          </p>
        </div>
      );
    }

    const { totalTimeSpent, plannedTime, timeSaved, averageBreakTime, 
            focusConsistency, longestFocusStretch, taskCompletionSpeed } = sessionMetrics;

    // Convert seconds to minutes
    const totalTimeInMinutes = Math.round(totalTimeSpent / 60);
    const plannedTimeInMinutes = Math.round(plannedTime / 60);
    const timeSavedInMinutes = Math.round(timeSaved / 60);
    const avgBreakInMinutes = Math.round(averageBreakTime / 60);
    const longestFocusInMinutes = Math.round(longestFocusStretch / 60);

    return (
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Session Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Here's a summary of your productivity metrics for this session
          </p>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Total Time</div>
              <div className="text-xs text-muted-foreground">Time spent in focused work</div>
            </div>
            <div className="text-sm font-medium">{totalTimeInMinutes} min</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Planned Time</div>
              <div className="text-xs text-muted-foreground">Total time scheduled</div>
            </div>
            <div className="text-sm font-medium">{plannedTimeInMinutes} min</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Time Saved</div>
              <div className="text-xs text-muted-foreground">Saved from planned time</div>
            </div>
            <div className="text-sm font-medium">{timeSavedInMinutes} min</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Average Break</div>
              <div className="text-xs text-muted-foreground">Average time per break</div>
            </div>
            <div className="text-sm font-medium">{avgBreakInMinutes} min</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Longest Focus</div>
              <div className="text-xs text-muted-foreground">Longest uninterrupted focus</div>
            </div>
            <div className="text-sm font-medium">{longestFocusInMinutes} min</div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Task Completion Speed</div>
                <div className="text-xs text-muted-foreground">How quickly you completed tasks</div>
              </div>
              <div className="text-sm font-medium">{taskCompletionSpeed}%</div>
            </div>
            <Progress value={taskCompletionSpeed} className="h-2" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Focus Consistency</div>
                <div className="text-xs text-muted-foreground">How consistently you maintained focus</div>
              </div>
              <div className="text-sm font-medium">{focusConsistency}%</div>
            </div>
            <Progress value={focusConsistency} className="h-2" />
          </div>
        </div>
      </div>
    );
  };

  // Render the feedback view
  const renderFeedbackView = () => {
    return (
      <>
        <p className="text-sm text-muted-foreground mb-6">
          Reflect on your completed session and capture your thoughts and feelings.
        </p>

        <div className="flex flex-col gap-6 py-4">
          <div>
            <Label htmlFor="reflections" className="mb-2 block">
              Reflections
            </Label>
            <Textarea
              id="reflections"
              className="min-h-[150px]"
              placeholder="What went well? What challenges did you face? What would you do differently next time?"
              value={reflections}
              onChange={(e) => setReflections(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">How do you feel about this session?</h3>
            
            <div className="space-y-6">
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
                  onValueChange={(value) => setProductivityRating(value[0])}
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
                  onValueChange={(value) => setStressLevel(value[0])}
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
                  onValueChange={(value) => setSatisfactionRating(value[0])}
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
                  onValueChange={(value) => setEnergyLevel(value[0])}
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
                  onValueChange={(value) => setFocusRating(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Distracted</span>
                  <span>Deep focus</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            className="gap-2"
            onClick={handleNextPage}
          >
            View Metrics
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </>
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
            {currentPage === 'feedback' ? (
              <FileText className="h-5 w-5 text-rose-500" />
            ) : (
              <BarChart3 className="h-5 w-5 text-blue-500" />
            )}
            <h2 className="text-xl font-semibold">
              {currentPage === 'feedback' ? 'Session Debrief' : 'Productivity Metrics'}
            </h2>
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
            <div className={`w-3 h-3 rounded-full ${currentPage === 'feedback' ? 'bg-rose-500' : 'bg-gray-300'}`} />
            <div className="w-8 h-0.5 bg-gray-300" />
            <div className={`w-3 h-3 rounded-full ${currentPage === 'metrics' ? 'bg-blue-500' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Feedback page */}
        {currentPage === 'feedback' && (
          renderFeedbackView()
        )}

        {/* Metrics page */}
        {currentPage === 'metrics' && (
          renderMetricsView()
        )}

        {/* Footer with navigation/action buttons */}
        <div className="flex justify-end gap-2 mt-6">
          {currentPage === 'feedback' ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                className="gap-2"
                onClick={handleNextPage}
              >
                View Metrics
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage('feedback')}
              >
                Back to Feedback
              </Button>
              <Button onClick={handleSave}>
                Save Debrief
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 