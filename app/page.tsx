"use client"

import { useState } from "react"
import { BrainDump } from "@/app/features/brain-dump"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Stats {
  totalTasks: number
  totalDuration: number
  totalStories: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    totalDuration: 0,
    totalStories: 0
  })

  const handleTasksProcessed = (stories: any[]) => {
    const totalTasks = stories.reduce((acc, story) => acc + story.tasks.length, 0)
    const totalDuration = stories.reduce((acc, story) => acc + story.estimatedDuration, 0)
    
    setStats({
      totalTasks,
      totalDuration,
      totalStories: stories.length
    })
  }

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="grid gap-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Task Management</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Plan your day by dumping your tasks and letting AI organize them into focused work sessions.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <BrainDump onTasksProcessed={handleTasksProcessed} />

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Today's Stats</CardTitle>
                <CardDescription>Overview of your planned work</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Total Tasks</dt>
                    <dd className="text-2xl font-bold">{stats.totalTasks}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Total Duration</dt>
                    <dd className="text-2xl font-bold">{stats.totalDuration} minutes</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Stories</dt>
                    <dd className="text-2xl font-bold">{stats.totalStories}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

