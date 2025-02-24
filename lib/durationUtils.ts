export const DURATION_RULES = {
  MIN_DURATION: 15,    // Minimum duration for any task
  BLOCK_SIZE: 5,      // All durations must be multiples of 5
  MAX_DURATION: 180,  // Maximum duration for a single task
  SHORT_BREAK: 5,
  LONG_BREAK: 15,
  DEBRIEF: 5,
  MAX_WORK_WITHOUT_BREAK: 90,
  DURATION_TOLERANCE: 5  // Allow 5-minute tolerance for duration matching
} as const

export interface TimeBox {
  type: 'work' | 'short-break' | 'long-break' | 'debrief'
  startTime?: string
  duration: number
  tasks?: Array<{ title: string; duration: number }>
}

export interface DurationSummary {
  workDuration: number
  breakDuration: number
  totalDuration: number
}

export function calculateWorkDuration(timeBoxes: TimeBox[]): number {
  return timeBoxes
    .filter(box => box.type === 'work')
    .reduce((sum, box) => sum + box.duration, 0)
}

export function calculateBreakDuration(timeBoxes: TimeBox[]): number {
  return timeBoxes
    .filter(box => box.type !== 'work')
    .reduce((sum, box) => sum + box.duration, 0)
}

export function calculateTotalDuration(timeBoxes: TimeBox[]): number {
  return calculateWorkDuration(timeBoxes) + calculateBreakDuration(timeBoxes)
}

export function calculateDurationSummary(timeBoxes: TimeBox[]): DurationSummary {
  const workDuration = calculateWorkDuration(timeBoxes)
  const breakDuration = calculateBreakDuration(timeBoxes)
  return {
    workDuration,
    breakDuration,
    totalDuration: workDuration + breakDuration
  }
}

export function roundToNearestBlock(duration: number): number {
  return Math.max(
    DURATION_RULES.MIN_DURATION,
    Math.round(duration / DURATION_RULES.BLOCK_SIZE) * DURATION_RULES.BLOCK_SIZE
  )
}

export function validateTaskDuration(duration: number): boolean {
  return duration >= DURATION_RULES.MIN_DURATION && 
         duration % DURATION_RULES.BLOCK_SIZE === 0 &&
         duration <= DURATION_RULES.MAX_DURATION
}

export function generateSchedulingSuggestion(duration: number): string {
  const suggestions: string[] = []
  
  if (duration < DURATION_RULES.MIN_DURATION) {
    suggestions.push(`Task duration (${duration}m) is less than the minimum recommended time (${DURATION_RULES.MIN_DURATION}m) for effective focus`)
  }
  
  if (duration > DURATION_RULES.MAX_DURATION) {
    suggestions.push(`Consider splitting this ${duration}m task into smaller sessions (${DURATION_RULES.MIN_DURATION}-${DURATION_RULES.MAX_DURATION}m each)`)
  }
  
  if (duration % DURATION_RULES.BLOCK_SIZE !== 0) {
    const roundedDuration = roundToNearestBlock(duration)
    suggestions.push(`Consider adjusting to ${roundedDuration}m to align with ${DURATION_RULES.BLOCK_SIZE}-minute scheduling blocks`)
  }
  
  return suggestions.join('. ')
}

export function suggestSplitAdjustment(originalDuration: number, splitDuration: number, parts: number): string {
  const remaining = originalDuration - splitDuration
  const suggestedParts = Math.ceil(remaining / DURATION_RULES.MAX_DURATION)
  
  return `Consider adding ${suggestedParts} more part${suggestedParts > 1 ? 's' : ''} ` +
         `to cover the remaining ${remaining} minutes`
} 