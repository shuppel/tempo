"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, Calendar, ChevronDown, CheckCircle2, Brain, Timer, AlertCircle } from "lucide-react"
import type { TimeBox } from "@/lib/types"
import { sessionStorage, type StoredSession } from "@/lib/sessionStorage"
import { cn } from "@/lib/utils"

const timeBoxIcons = {
  work: CheckCircle2,
  "short-break": Timer,
  "long-break": Brain,
} as const

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Record<string, StoredSession>>({})
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSessions(sessionStorage.getAllSessions())
  }, [])

  const toggleSession = (date: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  const getSessionProgress = (session: StoredSession) => {
    if (!session?.storyBlocks?.length) {
      return 0;
    }
    
    const totalTasks = session.storyBlocks.reduce((acc, block) => 
      acc + (block.timeBoxes?.filter(box => box.type === 'work')?.length || 0), 0)
    const completedTasks = session.storyBlocks.reduce((acc, block) => 
      acc + (block.timeBoxes?.filter(box => box.type === 'work' && box.status === 'completed')?.length || 0), 0)
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  }

  const getStatusBadge = (session: StoredSession) => {
    switch(session.status) {
      case "in-progress":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Planned</Badge>
    }
  }

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="grid gap-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Your Sessions</h1>
          <p className="text-lg text-muted-foreground mt-2">
            View and manage your planned work sessions
          </p>
        </div>

        <div className="grid gap-4">
          {Object.entries(sessions)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, session]) => (
              <Collapsible
                key={date}
                open={expandedSessions.has(date)}
                onOpenChange={() => toggleSession(date)}
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">
                          {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                        </CardTitle>
                        {getStatusBadge(session)}
                      </div>
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              expandedSessions.has(date) && "rotate-180"
                            )} />
                            {expandedSessions.has(date) ? "Hide Details" : "Show Details"}
                          </Button>
                        </CollapsibleTrigger>
                        <Link href={`/session/${date}`}>
                          <Button variant="outline" size="sm">
                            View Session
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {session.totalDuration} minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {session.totalSessions} sessions
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-end gap-2 text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <Progress value={getSessionProgress(session)} className="w-24" />
                          <span>{Math.round(getSessionProgress(session))}%</span>
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-6">
                          {session.storyBlocks.map((block, blockIndex) => (
                            <div key={block.id || blockIndex} className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{block.icon}</span>
                                <div className="flex-1">
                                  <h3 className="font-medium">{block.title}</h3>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Progress value={block.progress || 0} className="flex-1" />
                                    <span>{block.progress || 0}%</span>
                                  </div>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {Math.floor(block.totalDuration / 60)}h {block.totalDuration % 60}m
                                </span>
                              </div>

                              <div className="pl-8 space-y-2">
                                {block.timeBoxes.map((box: TimeBox, boxIndex) => {
                                  const Icon = timeBoxIcons[box.type as keyof typeof timeBoxIcons] || AlertCircle
                                  return (
                                    <div
                                      key={`${block.id}-${boxIndex}`}
                                      className={cn(
                                        "flex items-center gap-3 p-2 rounded-lg border",
                                        box.type === "work" ? "bg-indigo-50 border-indigo-100" :
                                        box.type === "short-break" ? "bg-teal-50 border-teal-100" :
                                        "bg-violet-50 border-violet-100"
                                      )}
                                    >
                                      <Icon className="h-4 w-4" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium capitalize">
                                            {box.type === "work" ? "Focus Session" : box.type.replace("-", " ")}
                                          </span>
                                          <span className="text-sm text-muted-foreground">
                                            {box.duration} mins
                                          </span>
                                        </div>
                                        {box.tasks && box.tasks.length > 0 && (
                                          <div className="mt-1 text-sm text-muted-foreground">
                                            {box.tasks.map((task, taskIndex) => (
                                              <div key={`${block.id}-${boxIndex}-${taskIndex}`} className="truncate">
                                                • {task.title}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}

          {Object.keys(sessions).length === 0 && (
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
      </div>
    </main>
  )
} 