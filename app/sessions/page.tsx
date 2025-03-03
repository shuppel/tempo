"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, ArrowRight, Trash2, Archive, MoreHorizontal, AlertCircle, CheckSquare, CalendarX } from "lucide-react"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SessionStorageService } from "@/app/features/session-manager"
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

const storageService = new SessionStorageService()
const DELETE_CONFIRMATION_TEXT = "Delete This Session!"

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    // Reset confirmation text when dialog closes
    if (!isDeleteDialogOpen) {
      setConfirmationText('')
    }
  }, [isDeleteDialogOpen])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const loadedSessions = await storageService.getAllSessions()
      setSessions(loadedSessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete || confirmationText !== DELETE_CONFIRMATION_TEXT) return
    
    try {
      await storageService.deleteSession(sessionToDelete)
      setSessions(sessions.filter(session => session.date !== sessionToDelete))
      toast({
        title: "Session deleted",
        description: "The session has been successfully deleted."
      })
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast({
        title: "Error",
        description: "Failed to delete the session. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSessionToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleArchiveSession = async (sessionDate: string) => {
    try {
      // Get the session
      const session = sessions.find(s => s.date === sessionDate)
      if (!session) return

      // Update the session status to 'archived'
      const updatedSession = {
        ...session,
        status: 'archived' as const
      }
      
      // Save the updated session
      await storageService.saveSession(sessionDate, updatedSession)
      
      // Update local state
      setSessions(sessions.map(s => 
        s.date === sessionDate ? updatedSession : s
      ))
      
      toast({
        title: "Session archived",
        description: "The session has been successfully archived."
      })
    } catch (error) {
      console.error('Failed to archive session:', error)
      toast({
        title: "Error",
        description: "Failed to archive the session. Please try again.",
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
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </main>
    )
  }

  // Filter sessions by status - show archived last
  const activeSessions = sessions.filter(s => s.status !== 'archived')
  const archivedSessions = sessions.filter(s => s.status === 'archived')
  
  // Sort sessions by date (newest first)
  const sortedActiveSessions = [...activeSessions].sort((a, b) => 
    parseISO(b.date).getTime() - parseISO(a.date).getTime()
  )
  
  const sortedArchivedSessions = [...archivedSessions].sort((a, b) => 
    parseISO(b.date).getTime() - parseISO(a.date).getTime()
  )

  return (
    <TooltipProvider>
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setSessionToDelete(null)
        }}
      >
        <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
          <div className="grid gap-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Your Sessions</h1>
              <p className="text-lg text-muted-foreground mt-2">
                View and manage your planned work sessions
              </p>
            </div>

            {/* Active Sessions */}
            <div className="grid gap-4">
              {sortedActiveSessions.map((session) => (
                <Card key={session.date} className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">
                          {format(parseISO(session.date), 'EEEE, MMMM d, yyyy')}
                        </CardTitle>
                        <Badge variant="secondary" className={cn(
                          "capitalize",
                          session.status === 'completed' && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
                          session.status === 'in-progress' && "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
                          session.status === 'planned' && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        )}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Actions Dropdown Menu */}
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
                              <p>Session actions</p>
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuItem 
                              className="flex items-center cursor-pointer text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400"
                              onClick={() => handleArchiveSession(session.date)}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              <span>Archive</span>
                            </DropdownMenuItem>
                            <div className="h-px bg-border mx-1 my-1" />
                            <DropdownMenuItem 
                              className="flex items-center cursor-pointer text-destructive"
                              onClick={() => {
                                setSessionToDelete(session.date)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Link href={`/session/${session.date}`}>
                          <Button variant="outline" className="gap-2">
                            View Session
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <CardDescription className="flex items-center justify-between gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(session.totalDuration)}
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <Progress 
                          value={session.storyBlocks.reduce((sum, block) => sum + (block.progress || 0), 0) / session.storyBlocks.length} 
                          className="w-24" 
                        />
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}

              {sessions.length === 0 && (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      <p>No sessions found</p>
                      <p className="text-sm mt-1">Plan your first session to get started</p>
                      <Link href="/" className="mt-4 inline-block">
                        <Button>Create New Session</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Archived Sessions (if any) */}
            {sortedArchivedSessions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-muted-foreground">Archived Sessions</h2>
                <div className="grid gap-2">
                  {sortedArchivedSessions.map((session) => (
                    <Card key={session.date} className="transition-colors hover:bg-muted/50 bg-muted/20">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg text-muted-foreground">
                              {format(parseISO(session.date), 'EEEE, MMMM d, yyyy')}
                            </CardTitle>
                            <Badge variant="outline" className="text-muted-foreground">
                              Archived
                            </Badge>
                            
                            {/* Display badge for incomplete tasks */}
                            {session.incompleteTasks && session.incompleteTasks.count > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200 dark:border-amber-800/60 flex items-center gap-1"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    <span>{session.incompleteTasks.count} incomplete</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-md">
                                  <div className="space-y-1">
                                    <p className="font-medium">Incomplete tasks from this session:</p>
                                    <ul className="text-xs space-y-1 list-disc list-inside">
                                      {session.incompleteTasks.tasks.slice(0, 5).map((task, i) => (
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
                                      {session.incompleteTasks.tasks.length > 5 && (
                                        <li className="text-muted-foreground">
                                          And {session.incompleteTasks.tasks.length - 5} more...
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Display badge for completion rate */}
                            {session.incompleteTasks && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    {session.incompleteTasks.count === 0 ? (
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
                                          {calculateCompletionPercentage(session)}% completed
                                        </span>
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p>Task completion rate for this session</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Actions Dropdown Menu for Archived Sessions */}
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
                                    setSessionToDelete(session.date)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Link href={`/session/${session.date}`}>
                              <Button variant="outline" size="sm" className="h-8">
                                View
                                <ArrowRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        
                        {/* Show incomplete task summary if available */}
                        {session.incompleteTasks && session.incompleteTasks.count > 0 && (
                          <CardDescription className="mt-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Incomplete:</span>
                                <span>{session.incompleteTasks.count} tasks</span>
                              </div>
                              
                              {/* Count tasks by status */}
                              {(() => {
                                const rolledOver = session.incompleteTasks.tasks.filter(t => t.rolledOver).length;
                                const mitigated = session.incompleteTasks.tasks.filter(t => t.mitigated && !t.rolledOver).length;
                                const abandoned = session.incompleteTasks.tasks.filter(t => !t.mitigated && !t.rolledOver).length;
                                
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
              <AlertDialogTitle>Delete {sessionToDelete ? 'Session' : ''}</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the session
                {sessionToDelete && ` for ${format(parseISO(sessionToDelete), 'MMMM d, yyyy')}`}.
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
                setSessionToDelete(null)
                setIsDeleteDialogOpen(false)
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteSession}
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

// Helper function to calculate completion percentage for a session
function calculateCompletionPercentage(session: Session): number {
  // Count all tasks in the session
  let totalTasks = 0;
  let completedTasks = 0;
  
  // Count tasks from story blocks
  session.storyBlocks.forEach(story => {
    story.timeBoxes.forEach(timeBox => {
      if (timeBox.type === 'work' && timeBox.tasks) {
        totalTasks += timeBox.tasks.length;
        completedTasks += timeBox.tasks.filter(task => task.status === 'completed').length;
      }
    });
  });
  
  // If we have incomplete tasks data, add those to our calculation
  if (session.incompleteTasks) {
    // If we have no tasks counted from story blocks but we have incomplete tasks data,
    // we can calculate from that
    if (totalTasks === 0 && session.incompleteTasks.count > 0) {
      // We know incomplete count, need to infer total
      // This is an approximation since we don't store the total task count explicitly
      const incompleteCount = session.incompleteTasks.count;
      // Calculate completed tasks (excluding rolled over and mitigated)
      const completedEstimate = session.storyBlocks.reduce((count, story) => {
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