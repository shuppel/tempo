// /features/brain-dump/components/ProcessedStories.tsx
import React from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { StoryCard } from "./StoryCard"
import type { ProcessedStory } from "@/lib/types"

interface ProcessedStoriesProps {
  stories: ProcessedStory[]
  editedDurations: Record<string, number>
  isCreatingSession: boolean
  onDurationChange: (storyTitle: string, newDuration: number) => void
  onRetry: () => void
  onCreateSession: () => void
}

export const ProcessedStories = ({ 
  stories, 
  editedDurations,
  isCreatingSession,
  onDurationChange,
  onRetry,
  onCreateSession
}: ProcessedStoriesProps) => {
  if (stories.length === 0) return null

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Processed Stories</h3>
        <div className="flex gap-2">
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
          <Button 
            onClick={onCreateSession} 
            size="sm"
            disabled={isCreatingSession}
          >
            {isCreatingSession ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Session'
            )}
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        {stories.map((story, index) => (
          <StoryCard 
            key={index}
            story={story}
            editedDuration={editedDurations[story.title] || story.estimatedDuration}
            onDurationChange={onDurationChange}
          />
        ))}
      </div>
    </div>
  )
}