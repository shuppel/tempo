"use client"

import { useState } from "react"
import { Grip, MoreVertical, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Timer } from "./timer"
import type { Task } from "@/lib/types"
import { DifficultyBadge } from "@/app/features/brain-dump/components/DifficultyBadge"

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
  onToggleComplete: (id: string) => void
}

export function TaskCard({ task, onDelete, onToggleComplete }: TaskCardProps) {
  const [isRunning, setIsRunning] = useState(false)

  return (
    <Card className="flex items-center gap-3 p-4">
      <Grip className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      
      <Checkbox 
        checked={task.status === "completed"} 
        onCheckedChange={() => onToggleComplete(task.id)}
        className="flex-shrink-0" 
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {task.isFrog && <span title="Priority Task">🐸</span>}
          <Badge variant="outline" className="text-xs capitalize">
            {task.taskCategory}
          </Badge>
          {task.projectType && (
            <Badge variant="secondary" className="text-xs">
              {task.projectType}
            </Badge>
          )}
          {task.duration > 0 && (
            <span className="text-xs text-muted-foreground">
              ({task.duration} mins)
            </span>
          )}
        </div>
        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
      </div>
      
      <div className="flex-shrink-0 mx-1">
        <DifficultyBadge 
          difficulty={task.difficulty} 
          duration={task.duration}
        />
      </div>
      
      {task.duration > 0 && (
        <div className="flex-shrink-0">
          <Timer 
            duration={task.duration} 
            isRunning={isRunning} 
            onToggle={() => setIsRunning(!isRunning)}
          />
        </div>
      )}
      
      <div className="flex-shrink-0">
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
      </div>
    </Card>
  )
}

