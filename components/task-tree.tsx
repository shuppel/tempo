"use client"

import { CheckCircle2, Circle, GitCommit, GitFork } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

interface TaskTreeProps {
  tasks: Task[]
  onToggleStatus: (taskId: string) => void
  onToggleFrog: (taskId: string) => void
}

export function TaskTree({ tasks, onToggleStatus, onToggleFrog }: TaskTreeProps) {
  const renderTask = (task: Task, level = 0) => {
    const childTasks = tasks.filter((t) => t.parentId === task.id)

    return (
      <div key={task.id} className="space-y-2">
        <div className={cn("flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50", level > 0 && "ml-6")}>
          <button onClick={() => onToggleStatus(task.id)} className="flex items-center gap-2">
            {task.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {level > 0 && <GitFork className="h-4 w-4 -rotate-90 text-muted-foreground" />}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
                {task.title}
              </span>
              {task.isFrog && <span className="text-destructive">🐸</span>}
            </div>
            {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{task.difficulty} points</span>
            <GitCommit className="h-4 w-4" />
          </div>
        </div>

        {childTasks.length > 0 && (
          <div className="space-y-2">{childTasks.map((childTask) => renderTask(childTask, level + 1))}</div>
        )}
      </div>
    )
  }

  const rootTasks = tasks.filter((task) => !task.parentId)

  return <div className="space-y-4">{rootTasks.map((task) => renderTask(task))}</div>
}

