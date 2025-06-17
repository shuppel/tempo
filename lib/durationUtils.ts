export const DURATION_RULES = {
  MIN_DURATION: 15, // Minimum duration for any task
  BLOCK_SIZE: 5, // All durations must be multiples of 5
  MAX_DURATION: 180, // Maximum duration for a single task
  SHORT_BREAK: 5,
  LONG_BREAK: 15,
  DEBRIEF: 5,
  MAX_WORK_WITHOUT_BREAK: 90,
  SHORT_BREAK_WORK_REDUCTION: 30, // A short break reduces accumulated work time by this amount
  WORK_TIME_TOLERANCE: 5, // 5-minute tolerance for work time limits
  DURATION_TOLERANCE: 5, // Allow 5-minute tolerance for duration matching
} as const;

export interface TimeBox {
  type: "work" | "short-break" | "long-break" | "debrief";
  startTime?: string;
  duration: number;
  tasks?: Array<{ title: string; duration: number }>;
}

export interface DurationSummary {
  workDuration: number;
  breakDuration: number;
  totalDuration: number;
}

export function calculateWorkDuration(timeBoxes: TimeBox[]): number {
  return timeBoxes
    .filter((box) => box.type === "work")
    .reduce((sum, box) => sum + box.duration, 0);
}

export function calculateBreakDuration(timeBoxes: TimeBox[]): number {
  return timeBoxes
    .filter((box) => box.type !== "work")
    .reduce((sum, box) => sum + box.duration, 0);
}

export function calculateTotalDuration(timeBoxes: TimeBox[]): number {
  return calculateWorkDuration(timeBoxes) + calculateBreakDuration(timeBoxes);
}

export function calculateDurationSummary(
  timeBoxes: TimeBox[],
): DurationSummary {
  const workDuration = calculateWorkDuration(timeBoxes);
  const breakDuration = calculateBreakDuration(timeBoxes);
  return {
    workDuration,
    breakDuration,
    totalDuration: workDuration + breakDuration,
  };
}

export function roundToNearestBlock(duration: number): number {
  return Math.max(
    DURATION_RULES.MIN_DURATION,
    Math.round(duration / DURATION_RULES.BLOCK_SIZE) *
      DURATION_RULES.BLOCK_SIZE,
  );
}

export function validateTaskDuration(duration: number): boolean {
  return (
    duration >= DURATION_RULES.MIN_DURATION &&
    duration % DURATION_RULES.BLOCK_SIZE === 0 &&
    duration <= DURATION_RULES.MAX_DURATION
  );
}

export function generateSchedulingSuggestion(duration: number): string {
  const suggestions: string[] = [];

  if (duration < DURATION_RULES.MIN_DURATION) {
    suggestions.push(
      `Task duration (${duration}m) is less than the minimum recommended time (${DURATION_RULES.MIN_DURATION}m) for effective focus`,
    );
  }

  if (duration > DURATION_RULES.MAX_DURATION) {
    suggestions.push(
      `Consider splitting this ${duration}m task into smaller sessions (${DURATION_RULES.MIN_DURATION}-${DURATION_RULES.MAX_DURATION}m each)`,
    );
  }

  if (duration % DURATION_RULES.BLOCK_SIZE !== 0) {
    const roundedDuration = roundToNearestBlock(duration);
    suggestions.push(
      `Consider adjusting to ${roundedDuration}m to align with ${DURATION_RULES.BLOCK_SIZE}-minute scheduling blocks`,
    );
  }

  return suggestions.join(". ");
}

export function suggestSplitAdjustment(
  originalDuration: number,
  splitDuration: number,
): string {
  const remaining = originalDuration - splitDuration;
  const suggestedParts = Math.ceil(remaining / DURATION_RULES.MAX_DURATION);

  return (
    `Consider adding ${suggestedParts} more part${suggestedParts > 1 ? "s" : ""} ` +
    `to cover the remaining ${remaining} minutes`
  );
}

/**
 * Formats a duration in minutes to a human-readable string
 * @param totalMinutes Total duration in minutes
 * @returns Formatted string like "2 hrs 30 min" or "45 min"
 */
export function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || isNaN(totalMinutes)) return "0 min";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}${minutes > 0 ? ` ${minutes} min` : ""}`;
  } else {
    return `${minutes} min`;
  }
}

/**
 * Calculates the estimated end time given a duration in minutes
 * @param durationInMinutes Duration in minutes
 * @param startTime Optional start time, defaults to now
 * @returns Formatted end time string (e.g., "3:45 PM")
 */
export function calculateEstimatedEndTime(
  durationInMinutes: number,
  startTime: Date = new Date(),
): string {
  if (!durationInMinutes || isNaN(durationInMinutes)) return "N/A";

  const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);

  // Format as h:mm a (e.g., 3:45 PM)
  return endTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get time estimates for a session
 * @param totalDurationInMinutes Total duration in minutes
 * @returns Object with formatted total time and estimated completion time
 */
export function getSessionTimeEstimates(totalDurationInMinutes: number) {
  return {
    totalTime: formatDuration(totalDurationInMinutes),
    estimatedEnd: calculateEstimatedEndTime(totalDurationInMinutes),
  };
}
