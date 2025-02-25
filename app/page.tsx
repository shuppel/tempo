"use client"

import { useState } from "react"
import { BrainDump } from "@/app/features/brain-dump"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Stats {
  totalTasks: number
  totalDuration: number
  totalStories: number
  totalFrogs: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    totalDuration: 0,
    totalStories: 0,
    totalFrogs: 0
  })

  const handleTasksProcessed = (stories: any[]) => {
    const totalTasks = stories.reduce((acc, story) => acc + story.tasks.length, 0)
    const totalDuration = stories.reduce((acc, story) => acc + story.estimatedDuration, 0)
    const totalFrogs = stories.reduce((acc, story) => 
      acc + story.tasks.filter((task: any) => task.isFrog).length, 0)
    
    setStats({
      totalTasks,
      totalDuration,
      totalStories: stories.length,
      totalFrogs
    })
  }

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="grid gap-12">
        <div className="space-y-4">
          <h1 className="text-5xl">Task Management</h1>
          <p className="text-body-large text-muted-foreground">
            Plan your day by dumping your tasks and letting AI organize them into focused work sessions.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <BrainDump onTasksProcessed={handleTasksProcessed} />

          <div className="space-y-8">
            <Card className="border-2">
              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl">Today's Stats</CardTitle>
                <CardDescription className="text-body text-muted-foreground">
                  Overview of your planned work
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-6">
                  <div>
                    <dt className="ui-label mb-2">Total Tasks</dt>
                    <dd className="text-4xl font-heading">{stats.totalTasks}</dd>
                  </div>
                  <div>
                    <dt className="ui-label mb-2">Total Duration</dt>
                    <dd className="text-4xl font-heading">
                      {stats.totalDuration > 59 
                        ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
                        : `${stats.totalDuration}m`}
                    </dd>
                  </div>
                  <div>
                    <dt className="ui-label mb-2">Stories</dt>
                    <dd className="text-4xl font-heading">{stats.totalStories}</dd>
                  </div>
                  {stats.totalFrogs > 0 && (
                    <div>
                      <dt className="ui-label mb-2 flex items-center gap-2">
                        <span>Priority Tasks</span>
                        <span className="text-lg">🐸</span>
                      </dt>
                      <dd className="text-4xl font-heading text-primary">{stats.totalFrogs}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

