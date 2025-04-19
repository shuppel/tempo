"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"

interface TaskCardProps {
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onDelete: () => void
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const handleStatusToggle = () => {
    onUpdate({
      status: task.status === "completed" ? "todo" : "completed"
    })
  }

  return (
    <Card className="p-4 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <input
            type="checkbox"
            checked={task.status === "completed"}
            onChange={handleStatusToggle}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div>
            <h3 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={task.isFrog ? "default" : "outline"}>
                {task.taskCategory}
              </Badge>
              {task.projectType && (
                <Badge variant="secondary" className="text-xs">
                  {task.projectType}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {task.duration} mins
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

