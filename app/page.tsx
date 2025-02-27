"use client"

import { useState } from "react"
import Image from "next/image"
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
          <div className="flex items-center gap-4">
            <Image 
              src="/assets/features/brain_dump.png" 
              alt="Brain Dump Logo" 
              width={80} 
              height={80} 
              className="rounded-lg shadow-md"
            />
            <h1 className="text-5xl flex items-center">Brain Dump</h1>
          </div>
          <p className="text-body-large text-muted-foreground">
            Transform scattered thoughts into structured productivity. Simply list your tasks—we'll analyze, organize, and create focused work sessions optimized for your workflow. No more overwhelm, just clarity and progress.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <BrainDump onTasksProcessed={handleTasksProcessed} />

          <div className="space-y-8">
            <Card className="border-2">
              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl">Session Preview</CardTitle>
                <CardDescription className="text-body text-muted-foreground">
                  Your productivity metrics at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-6">
                  <div>
                    <dt className="ui-label mb-2">Tasks</dt>
                    <dd className="text-4xl font-heading">{stats.totalTasks}</dd>
                  </div>
                  <div>
                    <dt className="ui-label mb-2">Estimated Time</dt>
                    <dd className="text-4xl font-heading">
                      {stats.totalDuration > 59 
                        ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
                        : `${stats.totalDuration}m`}
                    </dd>
                  </div>
                  <div>
                    <dt className="ui-label mb-2">Focus Stories</dt>
                    <dd className="text-4xl font-heading">{stats.totalStories}</dd>
                  </div>
                  {stats.totalFrogs > 0 && (
                    <div>
                      <dt className="ui-label mb-2 flex items-center gap-2">
                        <span>Eat These Frogs First</span>
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

