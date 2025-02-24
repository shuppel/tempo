"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { 
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Loader2, Info, Clock, Edit2, AlertCircle, XCircle, Bug, Lock, Unlock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CircularProgress } from "@/components/ui/circular-progress"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"

interface BrainDumpProps {
  onTasksProcessed: (stories: ProcessedStory[]) => void
}

interface ApiError {
  error: string
  code: string
  details?: unknown
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    'code' in error &&
    typeof (error as any).error === 'string' &&
    typeof (error as any).code === 'string'
  )
}

export function BrainDump({ onTasksProcessed }: BrainDumpProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<string>("")
  const [processedStories, setProcessedStories] = useState<ProcessedStory[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState(0)
  const [editedDurations, setEditedDurations] = useState<Record<string, number>>({})
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [shouldNotifyParent, setShouldNotifyParent] = useState(false)
  const [isInputLocked, setIsInputLocked] = useState(false)

  // Memoize the callback to prevent unnecessary re-renders
  const notifyParent = useCallback(() => {
    if (processedStories.length > 0) {
      onTasksProcessed(processedStories)
      setShouldNotifyParent(false)
    }
  }, [processedStories, onTasksProcessed])

  useEffect(() => {
    if (shouldNotifyParent) {
      notifyParent()
    }
  }, [shouldNotifyParent, notifyParent])

  const processTasks = async (shouldRetry = false) => {
    if (shouldRetry) {
      setRetryCount(prev => prev + 1)
    } else {
      setRetryCount(0)
    }

    setIsProcessing(true)
    setProcessingStep("Analyzing tasks...")
    setProcessingProgress(20)
    setError(null)

    try {
      const taskList = tasks.split("\n").filter(task => task.trim())
      
      if (taskList.length === 0) {
        throw new Error("Please enter at least one task")
      }
      
      setProcessingStep("Processing with AI...")
      setProcessingProgress(40)
      
      const response = await fetch("/api/tasks/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: taskList })
      })

      setProcessingStep("Organizing stories...")
      setProcessingProgress(80)

      const data = await response.json()
      
      if (!response.ok) {
        // If the response contains error details, throw them
        if (isApiError(data)) {
          const errorDetails = data.details 
            ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
            : ''
          throw new Error(`${data.error}${errorDetails}`)
        }
        // If it's a raw error message
        throw new Error(data.error || 'Failed to process tasks')
      }

      // Validate the response structure
      if (!data.stories || !Array.isArray(data.stories)) {
        // Log the raw response for debugging
        console.error('Invalid response structure:', data)
        throw new Error('Invalid response format: missing stories array')
      }

      // Validate each story has the required fields
      const invalidStories = data.stories.filter((story: ProcessedStory) => {
        return !story.title || !story.tasks || !Array.isArray(story.tasks)
      })

      if (invalidStories.length > 0) {
        console.error('Invalid stories found:', invalidStories)
        throw new Error('Some stories are missing required fields')
      }

      setProcessedStories(data.stories)
      setShouldNotifyParent(true)
      setIsInputLocked(true) // Lock input after successful processing
      
      // Initialize edited durations
      const initialDurations: Record<string, number> = {}
      data.stories.forEach((story: ProcessedStory) => {
        initialDurations[story.title] = story.estimatedDuration
      })
      setEditedDurations(initialDurations)

      setProcessingProgress(100)
      setProcessingStep("Complete!")
    } catch (error) {
      console.error("Failed to process tasks:", error)
      
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorCode = 'UNKNOWN_ERROR'
      let errorDetails = error

      // Check if the error contains a structured response
      if (error instanceof Error && typeof error.message === 'string') {
        try {
          if (error.message.includes('Details:')) {
            const [message, details] = error.message.split('\n\nDetails:')
            try {
              const parsedDetails = JSON.parse(details)
              errorDetails = parsedDetails
              // If we have a response field in the details, try to parse it
              if (parsedDetails.response) {
                try {
                  const parsedResponse = JSON.parse(parsedDetails.response)
                  errorDetails = {
                    ...parsedDetails,
                    response: parsedResponse
                  }
                } catch (e) {
                  // Keep the original response if parsing fails
                }
              }
            } catch (e) {
              errorDetails = details.trim()
            }
            errorMessage = message.trim()
          }
        } catch (e) {
          errorDetails = error.message
        }
      }

      setError({
        message: errorMessage,
        code: errorCode,
        details: errorDetails
      })
      setProcessingStep("Error occurred")
      setProcessingProgress(0)
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setProcessingProgress(0)
        setProcessingStep("")
      }, 1000)
    }
  }

  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true)
      setError(null)
      setProcessingStep("Creating session...")
      setProcessingProgress(0)

      // Apply edited durations to stories while preserving all fields
      const updatedStories = processedStories.map(story => ({
        ...story,
        estimatedDuration: editedDurations[story.title] || story.estimatedDuration,
        tasks: story.tasks.map(task => ({ ...task })),
        project: story.project || 'Default Project',
        category: story.category || 'Development'
      }))

      // Log the stories being sent for debugging
      console.log('Sending stories to create session:', JSON.stringify(updatedStories, null, 2))

      const startTime = new Date().toISOString()
      const response = await fetch("/api/tasks/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stories: updatedStories,
          startTime
        })
      })

      setProcessingProgress(50)

      const sessionPlan = await response.json()
      
      // If response is not ok, handle the error
      if (!response.ok) {
        console.error('Session creation failed:', sessionPlan)
        
        // Extract error details
        let errorMessage = 'Failed to create session'
        let errorDetails = sessionPlan
        
        if (sessionPlan.error) {
          errorMessage = sessionPlan.error
          if (sessionPlan.details) {
            errorDetails = sessionPlan.details
          }
        }

        throw new Error(errorMessage, { cause: errorDetails })
      }

      setProcessingProgress(75)

      // Validate the session plan has the required structure
      if (!sessionPlan.summary || !sessionPlan.storyBlocks) {
        throw new Error('Invalid session plan format')
      }

      const today = new Date().toISOString().split('T')[0]
      
      try {
        localStorage.setItem(`session-${today}`, JSON.stringify(sessionPlan))
      } catch (storageError) {
        console.error('Failed to save session to localStorage:', storageError)
        // Continue anyway as this is not critical
      }
      
      setProcessingProgress(100)
      setProcessingStep("Session created successfully!")
      
      // Use window.location for a full page navigation to avoid hydration issues
      window.location.href = `/session/${today}`
    } catch (error) {
      console.error("Failed to create session:", error)
      
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let errorDetails = error instanceof Error ? error.cause : error
      
      // If the error has a structured response
      if (error instanceof Error && error.cause && typeof error.cause === 'object') {
        errorDetails = error.cause
      }

      setError({
        message: errorMessage,
        code: "SESSION_ERROR",
        details: errorDetails
      })
      
      setProcessingProgress(0)
      setProcessingStep("Error creating session")
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleDurationChange = (storyTitle: string, newDuration: number) => {
    setEditedDurations(prev => {
      const updated = {
        ...prev,
        [storyTitle]: newDuration
      }
      
      // Update stories with new durations while preserving all fields
      const updatedStories = processedStories.map(story => {
        if (story.title === storyTitle) {
          const oldDuration = story.estimatedDuration
          const scaleFactor = newDuration / oldDuration

          // Scale task durations proportionally and round to nearest minute
          const updatedTasks = story.tasks.map(task => ({
            ...task,
            duration: Math.max(1, Math.round(task.duration * scaleFactor))
          }))

          // Calculate total after initial scaling
          let totalTaskDuration = updatedTasks.reduce((sum, task) => sum + task.duration, 0)
          
          // Distribute any remaining difference across tasks evenly
          if (totalTaskDuration !== newDuration) {
            const diff = newDuration - totalTaskDuration
            const tasksToAdjust = [...updatedTasks]
              .sort((a, b) => b.duration - a.duration) // Sort by duration descending
              .slice(0, Math.abs(diff)) // Take as many tasks as we need to adjust

            // Add or subtract 1 minute from each task until we reach the target
            tasksToAdjust.forEach(task => {
              const taskIndex = updatedTasks.findIndex(t => t.title === task.title)
              if (taskIndex !== -1) {
                updatedTasks[taskIndex].duration += diff > 0 ? 1 : -1
                totalTaskDuration += diff > 0 ? 1 : -1
              }
            })

            // If we still have a difference, adjust the longest task
            if (totalTaskDuration !== newDuration) {
              const longestTask = updatedTasks.reduce((max, task) => 
                task.duration > max.duration ? task : max
              , updatedTasks[0])
              const taskIndex = updatedTasks.findIndex(t => t.title === longestTask.title)
              updatedTasks[taskIndex].duration += newDuration - totalTaskDuration
            }
          }

          return {
            ...story,
            estimatedDuration: newDuration,
            tasks: updatedTasks
          }
        }
        return story
      })

      setProcessedStories(updatedStories)
      setShouldNotifyParent(true)
      
      return updated
    })
  }

  const renderTaskBreaks = (task: ProcessedTask) => {
    if (!task.suggestedBreaks?.length) return null

    return (
      <div className="ml-6 mt-1 text-xs text-muted-foreground">
        {task.suggestedBreaks.map((breakInfo, i) => (
          <div key={i} className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>
              After {breakInfo.after}m: {breakInfo.duration}m break
              {breakInfo.reason && ` - ${breakInfo.reason}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const handleProcessTasks = () => {
    processTasks(false)
  }

  const handleRetry = () => {
    setIsInputLocked(false) // Unlock input on retry
    setProcessedStories([]) // Clear processed stories
    setEditedDurations({}) // Reset durations
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle>Brain Dump</CardTitle>
            <CardDescription>
              Enter your tasks, one per line. Just brain dump everything you need to do...
            </CardDescription>
          </div>
          <div className="w-[48px] shrink-0">
            {isProcessing ? (
              <div className="relative">
                <CircularProgress 
                  progress={processingProgress} 
                  size={48}
                  className="bg-background rounded-full shadow-sm"
                />
                <div className="absolute top-full mt-1 right-0 text-xs text-muted-foreground whitespace-nowrap">
                  {processingStep}
                </div>
              </div>
            ) : (
              <div className="w-[48px] h-[48px] flex items-center justify-center">
                {isInputLocked && <Lock className="h-5 w-5 text-muted-foreground" />}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <div className="flex items-start gap-2">
              {error.code === 'PARSING_ERROR' ? (
                <Bug className="h-4 w-4 mt-1" />
              ) : (
                <XCircle className="h-4 w-4 mt-1" />
              )}
              <div className="space-y-2 flex-1">
                <AlertTitle>
                  {error.code === 'PARSING_ERROR' ? 'AI Processing Error' : 'Error Processing Tasks'}
                </AlertTitle>
                <AlertDescription>
                  <p>{error.message}</p>
                  {error.details && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Technical Details:</div>
                      <pre className="text-xs bg-destructive/10 p-2 rounded-md overflow-auto max-h-32">
                        {typeof error.details === 'string' 
                          ? error.details 
                          : JSON.stringify(error.details, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                  {retryCount < 3 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={handleRetry}
                    >
                      Try Again
                    </Button>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Input Format Tips</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Start with action verbs: "Create", "Review", "Update", etc.</li>
              <li>• Add time estimates (optional): "2 hours of work on Project X"</li>
              <li>• Mark priorities: Add "FROG" for high-priority tasks</li>
              <li>• Add deadlines (optional): "Complete by Friday" or "Due: 3pm"</li>
              <li>• Group related tasks: Use similar prefixes for related items</li>
              <li>• Be specific: "Review Q1 metrics report" vs "Review report"</li>
            </ul>
            <div className="mt-2 text-sm font-medium">Examples:</div>
            <pre className="mt-1 text-sm bg-muted p-2 rounded-md">
              Create landing page mockup for client FROG{"\n"}
              Review Q1 metrics report - 30 mins{"\n"}
              Update team documentation - flexible{"\n"}
              Complete project proposal by EOD{"\n"}
              Daily standup and team sync
            </pre>
          </AlertDescription>
        </Alert>

        <div className="relative">
          <Textarea
            className={`min-h-[200px] font-mono ${isInputLocked ? 'opacity-50' : ''}`}
            placeholder="Task 1&#10;Task 2 FROG&#10;Task 3 - flexible&#10;Task 4 - due by 5pm"
            value={tasks}
            onChange={(e) => !isInputLocked && setTasks(e.target.value)}
            disabled={isInputLocked}
          />
          {isInputLocked && (
            <div className="absolute inset-0 bg-background/5 backdrop-blur-[1px] rounded-md flex items-center justify-center">
              <div className="bg-background/90 px-4 py-2 rounded-md shadow-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Input locked</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          {processedStories.length > 0 && (
            <Button 
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              Clear & Unlock
            </Button>
          )}
          <Button 
            onClick={handleProcessTasks}
            disabled={!tasks.trim() || isProcessing || isInputLocked}
            className="w-32"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : isInputLocked ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Locked
              </>
            ) : (
              'Process Tasks'
            )}
          </Button>
        </div>

        {processedStories.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Processed Stories</h3>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" size="sm">
                  Try Again
                </Button>
                <Button 
                  onClick={handleCreateSession} 
                  size="sm"
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Session'
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {processedStories.map((story, index) => (
                <Alert key={index}>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{story.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AlertTitle>{story.title}</AlertTitle>
                        <Badge variant={story.type === "flexible" ? "outline" : "default"}>
                          {story.type}
                        </Badge>
                      </div>
                      <AlertDescription>
                        <p className="mt-1 text-muted-foreground">{story.summary}</p>
                        <ul className="mt-2 space-y-1">
                          {story.tasks.map((task, i) => (
                            <li key={i}>
                              <div className="flex items-center gap-2">
                                <span>•</span>
                                <span>{task.title}</span>
                                {task.isFrog && <span title="Priority Task">🐸</span>}
                                {task.isFlexible ? (
                                  <Badge variant="outline" className="text-xs">flexible</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    ({task.duration} mins)
                                  </span>
                                )}
                              </div>
                              {renderTaskBreaks(task)}
                            </li>
                          ))}
                        </ul>
                        {story.type !== "milestone" && (
                          <div className="mt-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editedDurations[story.title] || story.estimatedDuration}
                                onChange={(e) => handleDurationChange(story.title, parseInt(e.target.value, 10))}
                                className="w-20 h-7 text-sm"
                                min="1"
                              />
                              <span className="text-sm text-muted-foreground">minutes</span>
                            </div>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 