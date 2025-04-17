"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { Plus, AlertCircle, Loader2, RefreshCw, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { TaskDialog } from "./task-dialog"
import { TaskActionModal } from "./task-action-modal"
import { TimeboxView } from "./timebox-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { organizeTasks, createTimeBoxes } from "@/lib/task-manager"
import type { Task, SessionPlan, StoryBlock } from "@/lib/types"

interface LoadingState {
  organizing: boolean
  planning: boolean
  generating: boolean
}

interface ErrorState {
  message: string
  code?: string
  details?: string
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<string>()
  const [actionProgress, setActionProgress] = useState(0)
  const [sessionPlan, setSessionPlan] = useState<SessionPlan>()
  const [error, setError] = useState<ErrorState | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>({
    organizing: false,
    planning: false,
    generating: false
  })
  const [showSuccess, setShowSuccess] = useState(false)

  const isLoading = Object.values(loadingState).some(Boolean)

  useEffect(() => {
    if (tasks.length > 0) {
      organizeAndPlanTasks()
    } else {
      // Animate out the session plan
      if (sessionPlan) {
        setLoadingState(prev => ({ ...prev, generating: true }))
        setTimeout(() => {
          setSessionPlan(undefined)
          setLoadingState(prev => ({ ...prev, generating: false }))
        }, 300)
      }
    }
  }, [tasks])

  const organizeAndPlanTasks = async () => {
    setIsActionModalOpen(true)
    setCurrentAction("Analyzing and organizing tasks...")
    setActionProgress(20)
    setError(null)
    setShowSuccess(false)
    setLoadingState({
      organizing: true,
      planning: false,
      generating: false
    })
    
    try {
      // Step 1: Organize Tasks
      setCurrentAction("Organizing tasks by priority and complexity...")
      const organizedTasks = organizeTasks(tasks)
      setActionProgress(40)
      setLoadingState(prev => ({ ...prev, organizing: false, planning: true }))
      
      // Step 2: Create Time Boxes
      setCurrentAction("Creating optimized time boxes...")
      const plan = await createTimeBoxes(organizedTasks)
      setActionProgress(80)
      setLoadingState(prev => ({ ...prev, planning: false, generating: true }))
      
      // Step 3: Generate Final Plan
      setCurrentAction("Finalizing session plan...")
      
      // Animate out the old plan before setting the new one
      setSessionPlan(undefined)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setSessionPlan(plan)
      setActionProgress(100)
      setCurrentAction("Plan created successfully!")
      setShowSuccess(true)

    } catch (error) {
      console.error("Failed to create session plan:", error)
      setError({
        message: "Failed to create session plan",
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
      setActionProgress(0)
      setCurrentAction("Error creating plan")
    } finally {
      // Cleanup with delays for smooth transitions
      setTimeout(() => {
        setLoadingState({ organizing: false, planning: false, generating: false })
        setIsActionModalOpen(false)
        setActionProgress(0)
        setCurrentAction(undefined)
        // Reset success state after a delay
        setTimeout(() => setShowSuccess(false), 2000)
      }, 1000)
    }
  }

  interface DragResult {
    source: {
      index: number;
    };
    destination?: {
      index: number;
    };
  }
  
  const handleDragEnd = (result: DragResult) => {
    if (!result.destination) return

    const items = Array.from(tasks)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setTasks(items)
  }

  const addTask = (task: Task) => {
    setTasks([...tasks, task])
    setIsDialogOpen(false)
  }

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter((task) => task.id !== taskId))
  }

  const toggleComplete = (taskId: string) => {
    setTasks(tasks.map((task) => 
      task.id === taskId 
        ? { ...task, status: task.status === "completed" ? "todo" : "completed" } 
        : task
    ))
  }

  const LoadingSkeleton = () => (
    <div className="rounded-lg border p-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-24 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
        <div className="h-24 bg-muted rounded opacity-50" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Today's Tasks</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error: {error.code}</AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.details && (
              <p className="text-sm mt-2 text-muted">{error.details}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {showSuccess && (
        <Alert className="bg-green-50 text-green-900 border-green-200 animate-in fade-in slide-in-from-top-1">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Session plan created successfully!</AlertDescription>
        </Alert>
      )}

      {isLoading && !sessionPlan && <LoadingSkeleton />}

      {sessionPlan && (
        <div 
          className={cn(
            "rounded-lg border p-4 space-y-4",
            "transition-all duration-500 ease-in-out",
            "animate-in fade-in-50 slide-in-from-left-1",
            loadingState.generating && "animate-out fade-out-50 slide-out-to-right-1"
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Session Timeline</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={organizeAndPlanTasks}
              disabled={isLoading}
              className="relative"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className={cn(
                  "mr-2 h-4 w-4 transition-transform duration-200",
                  "hover:rotate-180"
                )} />
              )}
              Regenerate Plan
            </Button>
          </div>
          
          <TimeboxView 
            storyBlocks={sessionPlan.storyBlocks}
            isCurrentTimeBox={(box) => false}
          />
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Total Duration: {Math.floor(sessionPlan.totalDuration / 60)} hours {sessionPlan.totalDuration % 60} minutes
            </p>
            <Progress 
              value={tasks.filter(t => t.status === "completed").length / tasks.length * 100} 
              className="w-32"
            />
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="tasks">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className={cn(
                "space-y-2 transition-all duration-300",
                isLoading && "opacity-50"
              )}
            >
              {tasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.draggableProps} 
                      {...provided.dragHandleProps}
                      className={cn(
                        "transition-all duration-200 ease-in-out",
                        "hover:scale-[1.02]",
                        snapshot.isDragging && "scale-[1.02] rotate-1",
                        isLoading && "pointer-events-none"
                      )}
                    >
                      <TaskCard task={task} onDelete={deleteTask} onToggleComplete={toggleComplete} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {tasks.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <h3 className="text-lg font-medium">No tasks yet</h3>
          <p className="text-sm text-muted-foreground">Add a task to get started with your Pomodoro session</p>
        </div>
      )}

      <TaskDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onAddTask={addTask} />
      <TaskActionModal 
        open={isActionModalOpen}
        onOpenChange={setIsActionModalOpen}
        currentAction={currentAction}
        progress={actionProgress}
      />
    </div>
  )
}

