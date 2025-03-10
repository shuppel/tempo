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
      <div className="command-center grid gap-8 p-4 md:p-6 rounded-lg">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="crt-screen h-20 w-20 flex items-center justify-center">
              <Image 
                src="/assets/features/brain_dump.png" 
                alt="Brain Dump Logo" 
                width={60} 
                height={60} 
                className="rounded-lg turn-effect"
              />
            </div>
            <h1 className="text-5xl flex items-center text-panel-fg blur-in-h">COMMAND CENTER</h1>
          </div>
          <p className="text-body-large text-panel-fg">
            Transform scattered thoughts into structured productivity. Simply list your tasks—we'll analyze, organize, and create focused work sessions optimized for your workflow. No more overwhelm, just clarity and progress.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div className="command-panel">
            <div className="command-panel-header">BRAIN DUMP INTERFACE</div>
            <BrainDump onTasksProcessed={handleTasksProcessed} />
          </div>

          <div className="space-y-8">
            <div className="crt-screen">
              <div className="command-panel-header">SESSION PREVIEW</div>
              <dl className="space-y-6">
                <div>
                  <dt className="ui-label mb-2 text-panel-fg">TASKS</dt>
                  <dd className="data-readout text-center text-4xl">{stats.totalTasks}</dd>
                </div>
                <div>
                  <dt className="ui-label mb-2 text-panel-fg">ESTIMATED TIME</dt>
                  <dd className="data-readout text-center text-4xl">
                    {stats.totalDuration > 59 
                      ? `${Math.floor(stats.totalDuration / 60)}h ${stats.totalDuration % 60}m` 
                      : `${stats.totalDuration}m`}
                  </dd>
                </div>
                <div>
                  <dt className="ui-label mb-2 text-panel-fg">FOCUS STORIES</dt>
                  <dd className="data-readout text-center text-4xl">{stats.totalStories}</dd>
                </div>
                {stats.totalFrogs > 0 && (
                  <div className="blur-in-v">
                    <dt className="ui-label mb-2 flex items-center gap-2 text-panel-fg">
                      <span>EAT THESE FROGS FIRST</span>
                      <span className="text-lg">🐸</span>
                    </dt>
                    <dd className="data-readout text-center text-4xl">{stats.totalFrogs}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

