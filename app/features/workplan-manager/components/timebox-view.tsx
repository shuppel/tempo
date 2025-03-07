import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoryBlock, TimeBox } from "@/lib/types";

type TimeboxViewProps = {
  storyBlocks: StoryBlock[];
  isCurrentTimeBox: (timeBox: TimeBox) => boolean;
  onStartTimeBox?: (storyId: string, timeBoxIndex: number, duration: number) => void;
  hideOverview?: boolean;
};

const timeboxTypeConfig = {
  work: { icon: CheckCircle2, color: "text-indigo-700", title: "Focus Session" },
  "short-break": { icon: CheckCircle2, color: "text-teal-700", title: "Short Break" },
  "long-break": { icon: CheckCircle2, color: "text-violet-800", title: "Long Break" },
};

export const TimeboxView: React.FC<TimeboxViewProps> = ({
  storyBlocks,
  isCurrentTimeBox,
  onStartTimeBox,
  hideOverview = false,
}) => {
  const [nextActionTimebox, setNextActionTimebox] = useState<{
    storyId: string;
    timeBoxIndex: number;
    timeBox: TimeBox;
  } | null>(null);

  useEffect(() => {
    const firstTodo = storyBlocks
      .flatMap((story) =>
        story.timeBoxes.map((timeBox, index) => ({
          storyId: story.id || "",
          timeBoxIndex: index,
          timeBox,
        }))
      )
      .find(({ timeBox }) => timeBox.status === "todo" && !isCurrentTimeBox(timeBox));

    setNextActionTimebox(firstTodo || null);
  }, [storyBlocks, isCurrentTimeBox]);

  return (
    <div className="space-y-8">
      {!hideOverview && <div>{/* Overview content */}</div>}
      {storyBlocks.map((story, sIndex) => (
        <div key={story.id || `story-${sIndex}`} className="space-y-4">
          <h3 className="text-lg font-semibold">{story.title}</h3>
          <div className="space-y-4 ml-4 border-l-2 border-gray-200 pl-4">
            {story.timeBoxes.map((timeBox, tbIndex) => {
              const config = timeboxTypeConfig[timeBox.type as keyof typeof timeboxTypeConfig];
              const isActive = isCurrentTimeBox(timeBox);
              const isNextAction =
                nextActionTimebox?.storyId === (story.id || "") &&
                nextActionTimebox.timeBoxIndex === tbIndex;

              return (
                <div key={tbIndex} className="flex items-center gap-2">
                  <div className="flex-shrink-0">
                    <config.icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="flex-1">
                    <Badge variant="outline" className="font-normal">
                      {config.title} - {timeBox.duration} mins
                    </Badge>
                  </div>
                  {!isActive && timeBox.status === "todo" && onStartTimeBox && (
                    <Button
                      size="sm"
                      onClick={() =>
                        onStartTimeBox(story.id || "", tbIndex, timeBox.duration)
                      }
                      className="rounded-md bg-blue-100 hover:bg-blue-200"
                    >
                      Start
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
