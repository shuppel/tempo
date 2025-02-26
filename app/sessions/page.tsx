"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, ArrowRight } from "lucide-react"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SessionStorageService } from "@/app/features/session-manager"

const storageService = new SessionStorageService()

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loadedSessions = await storageService.getAllSessions()
        setSessions(loadedSessions)
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSessions()
  }, [])

  if (loading) {
    return (
      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </main>
    )
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
          {sessions
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
            .map((session) => (
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
                    <Link href={`/session/${session.date}`}>
                      <Button variant="outline" className="gap-2">
                        View Session
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <CardDescription className="flex items-center justify-between gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {session.totalDuration} minutes
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
      </div>
    </main>
  )
} 