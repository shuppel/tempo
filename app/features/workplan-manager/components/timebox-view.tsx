import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Coffee, Clock, Play } from "lucide-react";
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
  work: { icon: CheckCircle2, color: "text-indigo-700 dark:text-indigo-400", title: "Focus Session", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  "short-break": { icon: Coffee, color: "text-teal-700 dark:text-teal-400", title: "Short Break", bg: "bg-teal-50 dark:bg-teal-950/30" },
  "long-break": { icon: Coffee, color: "text-violet-800 dark:text-violet-400", title: "Long Break", bg: "bg-violet-50 dark:bg-violet-950/30" },
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
          <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-400">{story.title}</h3>
          <div className="space-y-4 ml-4 border-l-2 border-indigo-200 dark:border-indigo-800/50 pl-4">
            {story.timeBoxes.map((timeBox, tbIndex) => {
              const config = timeboxTypeConfig[timeBox.type as keyof typeof timeboxTypeConfig] || timeboxTypeConfig.work;
              const isActive = isCurrentTimeBox(timeBox);
              const isNextAction =
                nextActionTimebox?.storyId === (story.id || "") &&
                nextActionTimebox.timeBoxIndex === tbIndex;
              const isCompleted = timeBox.status === "completed";

              return (
                <div 
                  key={tbIndex} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    isActive ? "bg-indigo-50/80 dark:bg-indigo-950/40 shadow-sm border border-indigo-200 dark:border-indigo-800/50" : 
                    isCompleted ? "bg-green-50/80 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50" :
                    isNextAction ? "bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 shadow-sm" :
                    "bg-white/80 dark:bg-gray-950/80 hover:bg-gray-50 dark:hover:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50",
                    "backdrop-blur-sm"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    config.bg,
                    "border border-gray-200 dark:border-gray-800/50 shadow-sm"
                  )}>
                    <config.icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        "font-medium px-2 py-1 text-sm",
                        isActive ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/50" :
                        isCompleted ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50" :
                        "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                      )}>
                        {config.title}
                      </Badge>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">{timeBox.duration} mins</span>
                      </div>
                      {isActive && (
                        <Badge className="bg-indigo-500 text-white dark:bg-indigo-600 text-xs">Active</Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-500 text-white dark:bg-green-600 text-xs">Completed</Badge>
                      )}
                      {isNextAction && !isActive && !isCompleted && (
                        <Badge className="bg-purple-500 text-white dark:bg-purple-600 text-xs">Next Up</Badge>
                      )}
                    </div>
                    {timeBox.tasks && timeBox.tasks.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {timeBox.tasks.filter(t => t.status === "completed").length} of {timeBox.tasks.length} tasks completed
                      </div>
                    )}
                  </div>
                  {!isActive && timeBox.status === "todo" && onStartTimeBox && (
                    <Button
                      size="sm"
                      onClick={() =>
                        onStartTimeBox(story.id || "", tbIndex, timeBox.duration)
                      }
                      className={cn(
                        "rounded-lg shadow-sm h-9 px-3",
                        isNextAction ? 
                          "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white" :
                          "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 hover:from-indigo-100 hover:to-indigo-200 dark:from-indigo-950/30 dark:to-indigo-900/40 dark:border-indigo-800 dark:text-indigo-400 dark:hover:from-indigo-900/50 dark:hover:to-indigo-800/60"
                      )}
                    >
                      <Play className="h-4 w-4 mr-1.5" />
                      <span>Start</span>
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
