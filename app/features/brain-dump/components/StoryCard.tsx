// /features/brain-dump/components/StoryCard.tsx
import React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Clock, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { ProcessedStory, ProcessedTask } from "@/lib/types"


interface StoryCardProps {
  story: ProcessedStory
  editedDuration: number
  onDurationChange: (storyTitle: string, newDuration: number) => void
}

export const StoryCard = ({ story, editedDuration, onDurationChange }: StoryCardProps) => {
  const renderTaskBreaks = (task: ProcessedTask) => {
    if (!task.suggestedBreaks?.length) return null

    return (
      <div className="ml-6 mt-1 text-xs text-muted-foreground">
        {task.suggestedBreaks.map((breakInfo, i) => (
          <div key={i} className="flex items-center gap-1">
            <Info className="h-3 w-3" />
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
    <Alert>
      <div className="flex items-start gap-2">
        <span className="text-2xl">{story.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AlertTitle>{story.title}</AlertTitle>
            <Badge variant={story.type === "flexible" ? "outline" : "default"}>
              {story.type}
            </Badge>
            {story.projectType && (
              <Badge variant="secondary" className="text-xs">
                {story.projectType}
              </Badge>
            )}
          </div>
          <AlertDescription>
            <p className="mt-1 text-muted-foreground">{story.summary}</p>
            <ul className="mt-2 space-y-1">
              {story.tasks.map((task, i) => (
                <li key={i}>
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <span className={task.isFrog ? "font-medium text-primary" : ""}>
                      {task.title}
                    </span>
                    {task.isFrog && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-2 py-0 h-5">
                        <span className="mr-1">🐸</span>
                        FROG
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.taskCategory}
                    </Badge>
                    {task.projectType && (
                      <Badge variant="secondary" className="text-xs">
                        {task.projectType}
                      </Badge>
                    )}
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
            {story.type !== "milestone" && (
              <div className="mt-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editedDuration || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const duration = parseInt(value, 10);
                      if (!isNaN(duration) && duration > 0) {
                        onDurationChange(story.title, duration);
                      }
                    }}
                    className="w-20 h-7 text-sm"
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}