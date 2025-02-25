export interface SplitInfo {
  isParent: boolean
  partNumber?: number
  totalParts?: number
  originalDuration?: number
  parentTaskId?: string
}

export interface Task {
  id: string
  title: string
  description: string
  duration: number
  difficulty: number
  type: "focus" | "learning" | "review" | "break"
  isFrog: boolean
  status: "todo" | "completed"
  children: Task[]
  refined: boolean
  needsSplitting?: boolean
  splitInfo?: SplitInfo
}

export interface TaskBreak {
  after: number
  duration: number
  reason: string
}

export interface ProcessedTask {
  title: string
  duration: number
  isFrog: boolean
  type: "focus" | "learning" | "review"
  isFlexible: boolean
  needsSplitting?: boolean
  splitInfo?: SplitInfo
  suggestedBreaks: TaskBreak[]
  originalTitle?: string
}

export interface TaskGroup {
  id: string
  tasks: string[] // Array of task IDs
  totalDifficulty: number
  completed: boolean
  estimatedDuration?: number
}

export interface ProcessedStory {
  title: string
  summary: string
  icon: string
  estimatedDuration: number
  type: "timeboxed" | "flexible" | "milestone"
  project: string
  category: string
  tasks: ProcessedTask[]
  needsBreaks?: boolean
  originalTitle?: string
}

export interface TimeBoxTask {
  title: string
  duration: number
  isFrog?: boolean
  type?: "focus" | "learning" | "review"
  isFlexible?: boolean
  splitInfo?: SplitInfo
  suggestedBreaks?: TaskBreak[]
  status?: "pending" | "in-progress" | "completed"
}

export interface TimeBox {
  type: 'work' | 'short-break' | 'long-break' | 'debrief'
  duration: number
  tasks?: TimeBoxTask[]
  estimatedStartTime?: string
  estimatedEndTime?: string
  icon?: string
  status?: "pending" | "in-progress" | "completed"
}

export interface StoryBlock {
  id: string
  title: string
  timeBoxes: TimeBox[]
  totalDuration: number
  progress: number
  icon?: string
  type?: "timeboxed" | "flexible" | "milestone"
}

export interface FrogMetrics {
  total: number
  scheduled: number
  scheduledWithinTarget: number
}

export interface SessionPlan {
  storyBlocks: StoryBlock[]
  totalDuration: number
  startTime?: string
  endTime?: string
  frogMetrics: FrogMetrics
}

// Add session-specific types
export interface SessionSummary {
  totalSessions: number
  startTime: string
  endTime: string
  totalDuration: number
}

export interface SessionStatus {
  isActive: boolean
  isPaused: boolean
  currentTimeBox?: TimeBox
  currentTaskIndex: number
  elapsedTime: number
  remainingTime: number
  startTime?: string
  pausedAt?: string
  totalPausedTime: number
  estimatedEndTime?: string
}

export interface Session {
  summary: SessionSummary
  storyBlocks: StoryBlock[]
  date: string
  status: "planned" | "in-progress" | "completed"
  currentStoryIndex?: number
  currentTimeBoxIndex?: number
}

