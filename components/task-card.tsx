"use client"

import { useState } from "react"
import { Grip, MoreVertical, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Timer } from "./timer"
import type { Task } from "@/lib/types"

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
  onToggleComplete: (id: string) => void
}

export function TaskCard({ task, onDelete, onToggleComplete }: TaskCardProps) {
  const [isRunning, setIsRunning] = useState(false)

  return (
    <Card className="flex items-center gap-4 p-4">
      <Grip className="h-5 w-5 text-muted-foreground" />
      <Checkbox checked={task.status === "completed"} onCheckedChange={() => onToggleComplete(task.id)} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {task.isFrog && <span title="Priority Task">🐸</span>}
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {task.difficulty} pts
          </span>
        </div>
        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
      </div>
      <Timer duration={task.duration} isRunning={isRunning} onToggle={() => setIsRunning(!isRunning)} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onDelete(task.id)}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  )
}

