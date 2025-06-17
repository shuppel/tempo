import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { DifficultyLevel } from "@/lib/types";
import {
  calculatePomodoros,
  getDifficultyEmoji,
} from "../services/badge-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DifficultyBadgeProps {
  difficulty: DifficultyLevel;
  duration: number;
  showPomodoro?: boolean;
  className?: string;
}

/**
 * A compact badge component that displays task complexity level with tooltip
 * - Shows only complexity indicator (dots) by default
 * - Displays full information including pomodoro count on hover
 */
export const DifficultyBadge = ({
  difficulty,
  duration,
  showPomodoro = true,
  className = "",
}: DifficultyBadgeProps) => {
  const pomodoros = calculatePomodoros(duration);
  const complexitySymbol = getDifficultyEmoji(difficulty);

  // Classes based on difficulty level
  const difficultyClasses = {
    low: "text-green-600",
    medium: "text-amber-600",
    high: "text-red-600",
  };

  // Get descriptive text for difficulty level
  const getDifficultyText = (level: DifficultyLevel): string => {
    switch (level) {
      case "low":
        return "Low complexity";
      case "medium":
        return "Medium complexity";
      case "high":
        return "High complexity";
      default:
        return "Complexity";
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 h-5 flex items-center ${difficultyClasses[difficulty] || ""} ${className}`}
          >
            <span className="font-medium">{complexitySymbol}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="px-3 py-2">
          <div className="text-xs">
            <div className="font-medium">{getDifficultyText(difficulty)}</div>
            {showPomodoro && duration > 0 && (
              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {pomodoros} {pomodoros === 1 ? "pomodoro" : "pomodoros"}
                </span>
                <span className="text-xs">({duration} mins)</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
