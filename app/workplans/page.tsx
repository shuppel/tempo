"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, ArrowRight, Trash2, Archive, MoreHorizontal, AlertCircle, CheckSquare, CalendarX } from "lucide-react"
import type { TodoWorkPlan, TodoWorkPlanStatus, IncompleteTasks } from "@/lib/types"
import { cn } from "@/lib/utils"
import { WorkPlanStorageService } from "@/app/features/workplan-manager/services/workplan-storage.service"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"

// Create storage service instance
const storageService = new WorkPlanStorageService()

// Debug: Log when storage service is instantiated
console.log('WorkPlanStorageService instantiated')

const DELETE_CONFIRMATION_TEXT = "Delete This Work Plan!"

export default function WorkPlansPage() {
  const [workplans, setWorkPlans] = useState<TodoWorkPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [workplanToDelete, setWorkPlanToDelete] = useState<string | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    // Debug: Log when loadWorkPlans is called
    console.log('loadWorkPlans effect triggered')
    loadWorkPlans()
  }, [])

  useEffect(() => {
    // Reset confirmation text when dialog closes
    if (!isDeleteDialogOpen) {
      setConfirmationText('')
    }
  }, [isDeleteDialogOpen])

  const loadWorkPlans = async () => {
    try {
      setLoading(true)
      console.log('Fetching workplans from storage service...')
      const loadedWorkPlans = await storageService.getAllWorkPlans()
      console.log('Raw loaded workplans:', loadedWorkPlans)
      
      // Debug: Log each workplan's data
      loadedWorkPlans.forEach(wp => {
        console.log(`Workplan ${wp.id}:`, {
          status: wp.status,
          totalDuration: wp.totalDuration,
          storyBlocks: wp.storyBlocks?.length || 0
        })
      })
      
      setWorkPlans(loadedWorkPlans)
    } catch (error) {
      console.error('Failed to load workplans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorkPlan = async () => {
    if (!workplanToDelete || confirmationText !== DELETE_CONFIRMATION_TEXT) return
    
    try {
      await storageService.deleteWorkPlan(workplanToDelete)
      setWorkPlans(workplans.filter(workplan => workplan.id !== workplanToDelete))
      toast({
        title: "WorkPlan deleted",
        description: "The workplan has been successfully deleted."
      })
    } catch (error) {
      console.error('Failed to delete workplan:', error)
      toast({
        title: "Error",
        description: "Failed to delete the workplan. Please try again.",
        variant: "destructive"
      })
    } finally {
      setWorkPlanToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleArchiveWorkPlan = async (workplanId: string) => {
    try {
      // Get the workplan
      const workplan = workplans.find(w => w.id === workplanId)
      if (!workplan) return

      // Update the workplan status to 'archived'
      const updatedWorkPlan: TodoWorkPlan = {
        ...workplan,
        status: 'archived' as const
      }
      
      // Save the updated workplan
      await storageService.saveWorkPlan(updatedWorkPlan)
      
      // Update local state
      setWorkPlans(workplans.map(w => 
        w.id === workplanId ? updatedWorkPlan : w
      ))
      
      toast({
        title: "Work Plan archived",
        description: "The work plan has been successfully archived."
      })
    } catch (error) {
      console.error('Failed to archive workplan:', error)
      toast({
        title: "Error",
        description: "Failed to archive the workplan. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Function to format minutes into hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`
  }

  if (loading) {
    return (
      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <p className="text-muted-foreground">Loading workplans...</p>
        </div>
      </main>
    )
  }

  // Filter workplans by status - show archived last
  const activeWorkPlans = workplans.filter(w => {
    console.log(`Checking workplan ${w.id} with status: ${w.status}`)
    // A workplan is active if it's not archived and has a valid status
    return w.status && w.status !== 'archived'
  })
  const archivedWorkPlans = workplans.filter(w => w.status === 'archived')
  
  console.log('All workplans:', workplans.map(w => ({ id: w.id, status: w.status })))
  console.log('Active workplans:', activeWorkPlans.map(w => ({ id: w.id, status: w.status })))
  console.log('Archived workplans:', archivedWorkPlans.map(w => ({ id: w.id, status: w.status })))
  
  // Sort workplans by date (newest first)
  const sortedActiveWorkPlans = [...activeWorkPlans].sort((a, b) => {
    const dateA = parseISO(b.id)
    const dateB = parseISO(a.id)
    console.log(`Comparing dates: ${b.id} (${dateA}) vs ${a.id} (${dateB})`)
    return dateA.getTime() - dateB.getTime()
  })

  const sortedArchivedWorkPlans = [...archivedWorkPlans].sort((a, b) => {
    const dateA = parseISO(b.id)
    const dateB = parseISO(a.id)
    return dateA.getTime() - dateB.getTime()
  })
  
  console.log('Sorted active workplans:', sortedActiveWorkPlans.map(w => ({ id: w.id, status: w.status })))
  console.log('Sorted archived workplans:', sortedArchivedWorkPlans.map(w => ({ id: w.id, status: w.status })))

  return (
    <TooltipProvider>
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setWorkPlanToDelete(null)
        }}
      >
        <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
          <div className="grid gap-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Your Work Plans</h1>
              <p className="text-lg text-muted-foreground mt-2">
                View and manage your planned work sessions
              </p>
            </div>

            {/* Active WorkPlans */}
            <div className="grid gap-4">
              {sortedActiveWorkPlans.map((workplan) => (
                <Card key={workplan.id} className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">
                          {format(parseISO(workplan.id), 'EEEE, MMMM d, yyyy')}
                        </CardTitle>
                        <Badge variant="secondary" className={cn(
                          "capitalize",
                          workplan.status === 'completed' && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
                          workplan.status === 'in-progress' && "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
                          workplan.status === 'planned' && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        )}>
                          {workplan.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-9 w-9 hover:bg-muted"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Work Plan actions</p>
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuItem 
                              className="flex items-center cursor-pointer text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400"
                              onClick={() => handleArchiveWorkPlan(workplan.id)}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              <span>Archive</span>
                            </DropdownMenuItem>
                            <div className="h-px bg-border mx-1 my-1" />
                            <DropdownMenuItem 
                              className="flex items-center cursor-pointer text-destructive"
                              onClick={() => {
                                setWorkPlanToDelete(workplan.id)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Link href={`/workplan/${workplan.id}`}>
                          <Button variant="outline" className="gap-2">
                            View Work Plan
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <CardDescription className="flex items-center justify-between gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(workplan.totalDuration)}
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <Progress 
                          value={workplan.storyBlocks.reduce((sum: number, block) => sum + (block.progress || 0), 0) / workplan.storyBlocks.length} 
                          className="w-24" 
                        />
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}

              {workplans.length === 0 && (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      <p>No work plans found</p>
                      <p className="text-sm mt-1">Plan your first work plan to get started</p>
                      <Link href="/" className="mt-4 inline-block">
                        <Button>Create New Work Plan</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Archived WorkPlans (if any) */}
            {archivedWorkPlans.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-muted-foreground">Archived Work Plans</h2>
                <div className="grid gap-2">
                  {sortedArchivedWorkPlans.map((workplan) => (
                    <Card key={workplan.id} className="transition-colors hover:bg-muted/50 bg-muted/20">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg text-muted-foreground">
                              {format(parseISO(workplan.id), 'EEEE, MMMM d, yyyy')}
                            </CardTitle>
                            <Badge variant="outline" className="text-muted-foreground">
                              Archived
                            </Badge>
                            
                            {/* Display badge for incomplete tasks */}
                            {workplan.incompleteTasks && workplan.incompleteTasks.count > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200 dark:border-amber-800/60 flex items-center gap-1"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    <span>{workplan.incompleteTasks.count} incomplete</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-md">
                                  <div className="space-y-1">
                                    <p className="font-medium">Incomplete tasks from this work plan:</p>
                                    <ul className="text-xs space-y-1 list-disc list-inside">
                                      {workplan.incompleteTasks.tasks.slice(0, 5).map((task, i) => (
                                        <li key={i} className="flex items-center gap-1">
                                          <span className="truncate">{task.title}</span>
                                          {task.rolledOver && (
                                            <span className="text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap italic">(rolled over)</span>
                                          )}
                                          {task.mitigated && !task.rolledOver && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap italic">(mitigated)</span>
                                          )}
                                        </li>
                                      ))}
                                      {workplan.incompleteTasks.tasks.length > 5 && (
                                        <li className="text-muted-foreground">
                                          And {workplan.incompleteTasks.tasks.length - 5} more...
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Display badge for completion rate */}
                            {workplan.incompleteTasks && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    {workplan.incompleteTasks.count === 0 ? (
                                      <Badge 
                                        variant="outline" 
                                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-800/60 flex items-center gap-1"
                                      >
                                        <CheckSquare className="h-3 w-3" />
                                        <span>All tasks completed</span>
                                      </Badge>
                                    ) : (
                                      <Badge 
                                        variant="outline" 
                                        className="flex items-center gap-1"
                                      >
                                        {/* Calculate completed percentage */}
                                        <span>
                                          {calculateCompletionPercentage(workplan)}% completed
                                        </span>
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p>Task completion rate for this work plan</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Actions Dropdown Menu for Archived WorkPlans */}
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      className="h-8 w-8 hover:bg-muted"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p>Archive actions</p>
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-[180px]">
                                <DropdownMenuItem 
                                  className="flex items-center cursor-pointer text-destructive"
                                  onClick={() => {
                                    setWorkPlanToDelete(workplan.id)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Link href={`/workplan/${workplan.id}`}>
                              <Button variant="outline" size="sm" className="h-8">
                                View
                                <ArrowRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        
                        {/* Show incomplete task summary if available */}
                        {workplan.incompleteTasks && workplan.incompleteTasks.count > 0 && (
                          <CardDescription className="mt-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Incomplete:</span>
                                <span>{workplan.incompleteTasks.count} tasks</span>
                              </div>
                              
                              {/* Count tasks by status */}
                              {(() => {
                                const rolledOver = workplan.incompleteTasks.tasks.filter(t => t.rolledOver).length;
                                const mitigated = workplan.incompleteTasks.tasks.filter(t => t.mitigated && !t.rolledOver).length;
                                const abandoned = workplan.incompleteTasks.tasks.filter(t => !t.mitigated && !t.rolledOver).length;
                                
                                return (
                                  <>
                                    {rolledOver > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-blue-500 dark:text-blue-400">Rolled over:</span>
                                        <span>{rolledOver}</span>
                                      </div>
                                    )}
                                    
                                    {mitigated > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-500 dark:text-gray-400">Mitigated:</span>
                                        <span>{mitigated}</span>
                                      </div>
                                    )}
                                    
                                    {abandoned > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-amber-500 dark:text-amber-400">Abandoned:</span>
                                        <span>{abandoned}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Delete confirmation dialog content */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {workplanToDelete ? 'Work Plan' : ''}</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the work plan
                {workplanToDelete && ` for ${format(parseISO(workplanToDelete), 'MMMM d, yyyy')}`}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <p className="text-sm font-medium mb-2">
                Type <span className="font-bold text-destructive">{DELETE_CONFIRMATION_TEXT}</span> to confirm:
              </p>
              <Input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type confirmation text..."
                className="w-full"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setWorkPlanToDelete(null)
                setIsDeleteDialogOpen(false)
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteWorkPlan}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmationText !== DELETE_CONFIRMATION_TEXT}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </main>
      </AlertDialog>
    </TooltipProvider>
  )
}

// Helper function to calculate completion percentage for a work plan
function calculateCompletionPercentage(workplan: TodoWorkPlan): number {
  // Count all tasks in the work plan
  let totalTasks = 0;
  let completedTasks = 0;
  
  // Count tasks from story blocks
  workplan.storyBlocks.forEach(story => {
    story.timeBoxes.forEach(timeBox => {
      if (timeBox.type === 'work' && timeBox.tasks) {
        totalTasks += timeBox.tasks.length;
        completedTasks += timeBox.tasks.filter(task => task.status === 'completed').length;
      }
    });
  });
  
  // If we have incomplete tasks data, add those to our calculation
  if (workplan.incompleteTasks) {
    // If we have no tasks counted from story blocks but we have incomplete tasks data,
    // we can calculate from that
    if (totalTasks === 0 && workplan.incompleteTasks.count > 0) {
      // We know incomplete count, need to infer total
      // This is an approximation since we don't store the total task count explicitly
      const incompleteCount = workplan.incompleteTasks.count;
      // Calculate completed tasks (excluding rolled over and mitigated)
      const completedEstimate = workplan.storyBlocks.reduce((count, story) => {
        return count + story.timeBoxes.reduce((boxCount, box) => {
          if (box.type === 'work' && box.tasks) {
            return boxCount + box.tasks.filter(t => t.status === 'completed').length;
          }
          return boxCount;
        }, 0);
      }, 0);
      
      totalTasks = incompleteCount + completedEstimate;
      completedTasks = completedEstimate;
    }
  }
  
  if (totalTasks === 0) return 0;
  
  return Math.round((completedTasks / totalTasks) * 100);
} 