"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"
import { Plus, AlertCircle, Loader2, RefreshCw, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { TaskDialog } from "./task-dialog"
import { TaskActionModal } from "./task-action-modal"
import { TimeboxView } from "./timebox-view"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn, escapeHtml } from "@/lib/utils"
import { organizeTasks, createTimeBoxes } from "@/lib/task-manager"
import type { Task, SessionPlan } from "@/lib/types"
import { useTasks } from "@/features/task-persistence/hooks/useTasks"

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
  const {
    tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    saveTasks,
    updateTask,
    deleteTask
  } = useTasks()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<string>()
  const [actionProgress, setActionProgress] = useState(0)
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>({
    organizing: false,
    planning: false,
    generating: false
  })
  const [showSuccess, setShowSuccess] = useState(false)

  const isLoading = Object.values(loadingState).some(Boolean)

  const organizeAndPlanTasks = useCallback(async () => {
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
      setSessionPlan(null)
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
  }, [tasks])

  useEffect(() => {
    if (tasks.length > 0) {
      organizeAndPlanTasks()
    } else {
      // Animate out the session plan
      if (sessionPlan) {
        setLoadingState(prev => ({ ...prev, generating: true }))
        setTimeout(() => {
          setSessionPlan(null)
          setLoadingState(prev => ({ ...prev, generating: false }))
        }, 300)
      }
    }
  }, [tasks, organizeAndPlanTasks, sessionPlan])

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const reorderedTasks = Array.from(tasks)
    const [removed] = reorderedTasks.splice(result.source.index, 1)
    reorderedTasks.splice(result.destination.index, 0, removed)

    try {
      await saveTasks(reorderedTasks)
    } catch (err) {
      setError({
        code: 'REORDER_ERROR',
        message: 'Failed to reorder tasks',
        details: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  const handleAddTask = async (newTask: Task) => {
    try {
      await saveTasks([...tasks, newTask])
      setIsDialogOpen(false)
    } catch (err) {
      setError({
        code: 'SAVE_ERROR',
        message: 'Failed to save task',
        details: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask({ taskId, updates })
    } catch (err) {
      setError({
        code: 'UPDATE_ERROR',
        message: 'Failed to update task',
        details: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
    } catch (err) {
      setError({
        code: 'DELETE_ERROR',
        message: 'Failed to delete task',
        details: err instanceof Error ? err.message : 'Unknown error'
      })
    }
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
        <h2 className="text-2xl font-bold" dangerouslySetInnerHTML={{ __html: escapeHtml("Today's Tasks") }} />
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

      {tasksError && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error: Task Loading</AlertTitle>
          <AlertDescription>
            <p>{typeof tasksError === 'string' ? tasksError : (tasksError?.message || 'Unknown error')}</p>
          </AlertDescription>
        </Alert>
      )}

      {isLoadingTasks && <LoadingSkeleton />}

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
            isCurrentTimeBox={() => false}
          />
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Total Duration: {Math.floor(sessionPlan.totalDuration / 60)} hours {sessionPlan.totalDuration % 60} minutes
            </p>
            <Progress 
              value={tasks.filter((t: Task) => t.status === "completed").length / tasks.length * 100} 
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
              {tasks.map((task: Task, index: number) => (
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
                      <TaskCard
                        task={task}
                        onUpdate={(updates) => handleTaskUpdate(task.id, updates)}
                        onDelete={() => handleTaskDelete(task.id)}
                      />
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
          <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: escapeHtml("Add a task to get started with your Pomodoro session. Don&apos;t forget to plan breaks!") }} />
        </div>
      )}

      <TaskDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onAddTask={handleAddTask} />
      <TaskActionModal 
        open={isActionModalOpen}
        onOpenChange={setIsActionModalOpen}
        currentAction={currentAction}
        progress={actionProgress}
      />
    </div>
  )
}

