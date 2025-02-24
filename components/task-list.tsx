import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"
import type { ProcessedTask } from "../app/features/brain-dump/lib/types"

interface TaskListProps {
  tasks: ProcessedTask[]
}

export function TaskList({ tasks }: TaskListProps) {
  const renderTaskBreaks = (task: ProcessedTask) => {
    if (!task.suggestedBreaks?.length) return null

    return (
      <div className="ml-6 mt-1 text-xs text-muted-foreground">
        {task.suggestedBreaks.map((breakInfo, i) => (
          <div key={i} className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>
              After {breakInfo.after}m: {breakInfo.duration}m break
              {breakInfo.reason && ` - ${breakInfo.reason}`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ul className="mt-2 space-y-1">
      {tasks.map((task, i) => (
        <li key={i}>
          <div className="flex items-center gap-2">
            <span>•</span>
            <span>{task.title}</span>
            {task.isFrog && <span title="Priority Task">🐸</span>}
            {task.isFlexible ? (
              <Badge variant="outline" className="text-xs">flexible</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                ({task.duration} mins)
              </span>
            )}
          </div>
          {renderTaskBreaks(task)}
        </li>
      ))}
    </ul>
  )
} 