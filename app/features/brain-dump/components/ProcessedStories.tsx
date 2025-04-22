// /features/brain-dump/components/ProcessedStories.tsx
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryCard } from "./StoryCard";
import type { ProcessedStory, APISessionResponse } from "@/lib/types";

interface ProcessedStoriesProps {
  stories: ProcessedStory[];
  editedDurations: Record<string, number>;
  onDurationChange: (storyTitle: string, newDuration: number) => void;
  isCreatingSession?: boolean;
  onRetry?: () => void;
  onCreateSession?: () => Promise<APISessionResponse>;
}

export const ProcessedStories = ({
  stories,
  editedDurations,
  onDurationChange,
  isCreatingSession = false,
  onRetry,
  onCreateSession,
}: ProcessedStoriesProps) => {
  // Check for potential session planning issues
  const hasLongStories = stories.some((story) => story.estimatedDuration > 90);
  const hasLongTasks = stories.some((story) =>
    story.tasks.some((task) => task.duration > 60),
  );

  // Only render if there are stories
  if (stories.length === 0) return null;

  return (
    <div className="space-y-4">
      {(hasLongStories || hasLongTasks) && (
        <Alert className="bg-amber-50 border-amber-200">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Productivity Optimization</AlertTitle>
          <AlertDescription>
            <p className="text-sm">
              Duration adjustments recommended to optimize focus and efficiency:
            </p>
            <ul className="mt-2 text-xs space-y-1">
              {hasLongStories && (
                <li>
                  • Work blocks exceeding 90 minutes require strategic breaks to
                  maintain cognitive performance
                </li>
              )}
              {hasLongTasks && (
                <li>
                  • Tasks over 60 minutes benefit from division into focused,
                  manageable segments
                </li>
              )}
              <li>
                • Consider refining durations or restructuring complex tasks for
                optimal session planning
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {onRetry && onCreateSession && (
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Focus Block Analysis</h3>
          <div className="flex gap-2">
            <Button onClick={onRetry} variant="outline" size="sm">
              Reset Analysis
            </Button>
            <Button
              onClick={onCreateSession}
              size="sm"
              disabled={isCreatingSession}
            >
              {isCreatingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Schedule Work Session"
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {stories.map((story, index) => (
          <StoryCard
            key={index}
            story={story}
            editedDuration={
              editedDurations[story.title] || story.estimatedDuration
            }
            onDurationChange={onDurationChange}
          />
        ))}
      </div>
    </div>
  );
};
