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
    <main className="flex-1 container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="grid gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight">Brain Dump</h1>
          <p className="text-muted-foreground text-base">
            Transform thoughts into structured tasks. Enter your tasks—we'll organize them into focused work sessions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
          <BrainDump onTasksProcessed={handleTasksProcessed} />

          {stats.totalTasks > 0 && (
            <Card className="border h-fit shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Session Preview</CardTitle>
                <CardDescription className="text-sm">
                  Productivity metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <dt className="text-muted-foreground text-sm">Tasks</dt>
                    <dd className="text-2xl font-medium">{stats.totalTasks}</dd>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <dt className="text-muted-foreground text-sm">Estimated Time</dt>
                    <dd className="text-2xl font-medium">
                      {stats.totalDuration > 59 
                        ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
                        : `${stats.totalDuration}m`}
                    </dd>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <dt className="text-muted-foreground text-sm">Focus Stories</dt>
                    <dd className="text-2xl font-medium">{stats.totalStories}</dd>
                  </div>
                  {stats.totalFrogs > 0 && (
                    <div className="flex justify-between items-baseline">
                      <dt className="text-muted-foreground text-sm flex items-center gap-1">
                        <span>Frogs</span>
                        <span className="text-base">🐸</span>
                      </dt>
                      <dd className="text-2xl font-medium text-primary">{stats.totalFrogs}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

