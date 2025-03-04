import React from "react"
import { StoryCard } from "./StoryCard"
import type { ProcessedStory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ProcessedStoriesProps {
  /** Array of processed stories to display */
  stories: ProcessedStory[]
  /** Record of edited durations for each story */
  editedDurations: Record<string, number>
  /** Whether a work plan is currently being created */
  isCreatingWorkPlan: boolean
  /** Callback when a story's duration is changed */
  onDurationChange: (storyTitle: string, newDuration: number) => void
  /** Callback to retry processing tasks */
  onRetry: () => void
  /** Callback to create a new work plan */
  onCreateWorkPlan: () => Promise<void>
}

/**
 * ProcessedStories Component
 * 
 * Displays a list of processed stories from the brain dump, allowing users to
 * review and adjust durations before creating a work plan.
 * 
 * @param props Component properties
 * @returns React component
 */
export const ProcessedStories = ({
  stories,
  editedDurations,
  isCreatingWorkPlan,
  onDurationChange,
  onRetry,
  onCreateWorkPlan
}: ProcessedStoriesProps) => {
  return (
    <div className="space-y-4">
      {stories.map((story, index) => (
        <StoryCard
          key={`${story.title}-${index}`}
          story={story}
          editedDuration={editedDurations[story.title] || story.estimatedDuration}
          onDurationChange={onDurationChange}
        />
      ))}
      {stories.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button 
            onClick={onRetry}
            variant="outline"
            size="sm"
          >
            Clear & Retry
          </Button>
          <Button 
            onClick={onCreateWorkPlan}
            disabled={isCreatingWorkPlan}
            size="sm"
          >
            {isCreatingWorkPlan ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Work Plan...
              </>
            ) : (
              'Create Work Plan'
            )}
          </Button>
        </div>
      )}
    </div>
  )
} 