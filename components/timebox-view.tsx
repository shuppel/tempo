"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, Pause, Brain, FileText, CheckCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { format } from "date-fns"
import type { StoryBlock, TimeBox, TimeBoxTask } from "@/lib/types"

interface TimeboxViewProps {
  storyBlocks: Array<StoryBlock & { id: string }>
  currentTimeBox?: TimeBox
  isCurrentTimeBox: (box: TimeBox) => boolean
  isPaused?: boolean
  className?: string
  onTaskClick?: (storyId: string, timeBoxIndex: number, taskIndex: number, task: TimeBoxTask) => void
}

const timeBoxIcons = {
  work: CheckCircle2,
  "short-break": Pause,
  "long-break": Brain,
  lunch: Clock,
  debrief: FileText,
} as const

const timeBoxColors = {
  work: "bg-indigo-500 border-indigo-600",
  "short-break": "bg-teal-400 border-teal-500",
  "long-break": "bg-violet-600 border-violet-700",
  lunch: "bg-amber-500 border-amber-600",
  debrief: "bg-rose-500 border-rose-600",
} as const

const timeBoxStyles = {
  work: "text-indigo-700 bg-indigo-50 border-indigo-200",
  "short-break": "text-teal-700 bg-teal-50 border-teal-200",
  "long-break": "text-violet-800 bg-violet-50 border-violet-300",
  lunch: "text-amber-700 bg-amber-50 border-amber-200",
  debrief: "text-rose-700 bg-rose-50 border-rose-200",
} as const

export function TimeboxView({ 
  storyBlocks, 
  currentTimeBox, 
  isCurrentTimeBox, 
  isPaused, 
  className,
  onTaskClick
}: TimeboxViewProps) {
  const formatTimeRange = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return ""
    return `${format(new Date(startTime), 'h:mm a')} - ${format(new Date(endTime), 'h:mm a')}`
  }

  return (
    <div className={cn("space-y-8", className)}>
      {storyBlocks.map((story) => (
        <div key={story.id} className="space-y-4">
          {/* Story Header */}
          <div className="flex items-center gap-4">
            <span className="text-2xl">{story.icon}</span>
            <div className="flex-1">
              <h3 className="font-medium">{story.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Progress value={story.progress} className="flex-1" />
                <span>{story.progress}%</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {Math.floor(story.totalDuration / 60)}h {story.totalDuration % 60}m
            </span>
          </div>

          {/* Timeboxes */}
          <div className="space-y-2 pl-8">
            {story.timeBoxes.map((box, timeBoxIndex) => {
              const Icon = timeBoxIcons[box.type]
              const isActive = isCurrentTimeBox(box)
              const boxKey = `${story.id}-${box.type}-${timeBoxIndex}-${box.duration}-${box.tasks?.[0]?.title || ''}`

              return (
                <div
                  key={boxKey}
                  className={cn(
                    "relative flex items-center gap-4 pl-8 pr-4 py-2 rounded-lg border transition-all duration-300",
                    timeBoxStyles[box.type],
                    isActive && "ring-2 ring-primary ring-offset-2",
                    isActive && isPaused && "opacity-75 saturate-50",
                    box.status === "completed" && "opacity-75 bg-green-50 border-green-100"
                  )}
                >
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors duration-300",
                    box.status === "completed" ? "bg-green-500" : timeBoxColors[box.type]
                  )} />
                  
                  <div className={cn(
                    "absolute -left-6 w-4 h-4 rounded-full transition-colors duration-300",
                    isActive ? "bg-primary" : box.status === "completed" ? "bg-green-500" : "bg-muted-foreground/20",
                    isActive && isPaused && "animate-pulse"
                  )} />
                  
                  {box.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-300",
                      isActive && !isPaused && "animate-spin-slow"
                    )} />
                  )}
                  
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium capitalize">
                        {box.type === "work" ? "Focus Session" : box.type.replace("-", " ")}
                        {box.status === "completed" && " (Completed)"}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeRange(box.estimatedStartTime, box.estimatedEndTime)}
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {box.duration} mins
                    </span>
                  </div>
                  
                  {box.tasks && box.tasks.length > 0 && box.type === "work" && (
                    <div className="mt-2 px-3 py-2 space-y-1.5 bg-white/50 rounded-md">
                      {box.tasks.map((task: TimeBoxTask, taskIndex: number) => (
                        <div 
                          key={`${boxKey}-task-${taskIndex}-${task.title}`}
                          className={cn(
                            "flex items-center gap-2 py-1 px-1 rounded text-sm cursor-pointer hover:bg-white/90 transition-colors",
                            task.status === "completed" && "line-through text-muted-foreground"
                          )}
                          onClick={() => onTaskClick?.(story.id, timeBoxIndex, taskIndex, task)}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center",
                            task.status === "completed" ? "bg-green-100 border-green-300" : "border-gray-300"
                          )}>
                            {task.status === "completed" && (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            )}
                          </div>
                          <span>{task.title}</span>
                          {task.isFrog && <span className="text-amber-500">🐸</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
} 