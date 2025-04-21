"use client"

import { useState, useCallback, useMemo } from "react"
import { BrainDump } from "@/app/features/brain-dump"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"

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

  const handleTasksProcessed = useCallback((stories: { tasks: { isFrog?: boolean, duration?: number }[]; estimatedDuration?: number }[]) => {
    const totalTasks = stories.reduce((acc, story) => acc + story.tasks.length, 0)
    const totalDuration = stories.reduce((acc, story) => {
      const storyDuration = story.estimatedDuration || 
        (story.tasks.reduce((taskSum: number, task) => taskSum + (task.duration || 0), 0)) || 0
      return acc + storyDuration
    }, 0)
    const totalFrogs = stories.reduce((acc, story) => 
      acc + story.tasks.filter((task) => task.isFrog).length, 0)
    
    setStats({
      totalTasks,
      totalDuration: Math.round(totalDuration),
      totalStories: stories.length,
      totalFrogs
    })
  }, [])

  const formattedDuration = useMemo(() => {
    return stats.totalDuration > 59 
      ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
      : `${stats.totalDuration}m`
  }, [stats.totalDuration])

  return (
    <main className="flex-1 container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
        <BrainDump onTasksProcessed={handleTasksProcessed} />

        {stats.totalTasks > 0 && (
          <Card className="border h-fit shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium">Session Preview</CardTitle>
                <CardDescription className="text-sm">
                  Productivity metrics
                </CardDescription>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <span>Optimize workflow</span>
              </div>
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
                    {formattedDuration}
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
    </main>
  )
}

