import React from "react"
import { StoryCard } from "./StoryCard"
import type { ProcessedStory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Loader2, Info } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useUserPreferences } from "@/lib/userPreferences"

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
  // Access user preferences
  const { preferences } = useUserPreferences();
  
  // Calculate if total duration exceeds the max work time without breaks
  const totalDuration = Object.values(editedDurations).reduce((sum, duration) => sum + duration, 0);
  const maxWorkWithoutBreak = preferences.durationRules.maxWorkWithoutBreak;
  const needsMoreBreaks = totalDuration > maxWorkWithoutBreak * 1.5;

  return (
    <div className="space-y-4">
      {/* Show a suggestion if the plan might need more breaks */}
      {needsMoreBreaks && (
        <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300">
          <AlertTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Consider adding more breaks
          </AlertTitle>
          <AlertDescription>
            Your total work plan is {totalDuration} minutes, which is quite long. 
            Consider adding breaks between tasks or splitting up longer tasks for better productivity.
          </AlertDescription>
        </Alert>
      )}

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