import { DifficultyLevel, DIFFICULTY_BADGES } from "@/lib/types";

/**
 * Calculates the number of pomodoros needed for a given duration.
 * A standard pomodoro is 25 minutes of focused work.
 *
 * @param duration Duration in minutes
 * @returns Number of pomodoros (rounded up)
 */
export const calculatePomodoros = (duration: number): number => {
  // Standard pomodoro duration is 25 minutes
  const POMODORO_DURATION = 25;
  return Math.ceil(duration / POMODORO_DURATION);
};

/**
 * Gets badge color based on difficulty level
 *
 * @param difficulty The difficulty level
 * @returns Badge color class from DIFFICULTY_BADGES
 */
export const getDifficultyBadgeColor = (
  difficulty: DifficultyLevel,
): string => {
  return DIFFICULTY_BADGES[difficulty]?.color || "bg-gray-100 text-gray-800";
};

/**
 * Generates symbol for task complexity level
 *
 * @param difficulty The complexity level
 * @returns Symbol representing the complexity level
 */
export const getDifficultyEmoji = (difficulty: DifficultyLevel): string => {
  switch (difficulty) {
    case "low":
      return "•"; // Simple dot for low complexity
    case "medium":
      return "••"; // Double dot for medium complexity
    case "high":
      return "•••"; // Triple dot for high complexity
    default:
      return "•"; // Default
  }
};
