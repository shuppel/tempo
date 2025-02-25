export interface SplitInfo {
  isParent: boolean
  partNumber?: number
  totalParts?: number
  originalDuration?: number
  parentTaskId?: string
  originalTitle?: string
  storyId?: string
}

// Create central types as a single source of truth
export type TaskType = "focus" | "learning" | "review" | "break" | "research"
export type TaskStatus = "todo" | "completed" | "pending" | "in-progress"
export type StoryType = "timeboxed" | "flexible" | "milestone"
export type TimeBoxType = "work" | "short-break" | "long-break" | "debrief"
export type DifficultyLevel = "low" | "medium" | "high"
export type TaskComplexity = DifficultyLevel

export interface Task {
  id: string
  title: string
  description: string
  duration: number
  difficulty: number
  type: TaskType  // Use the union type here
  isFrog: boolean
  status: "todo" | "completed"
  children: Task[]
  refined: boolean
  needsSplitting?: boolean
  splitInfo?: SplitInfo
  storyId?: string
  groupId?: string
  originalTitle?: string
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
  type: Exclude<TaskType, "break">  // Use the TaskType but exclude "break" type
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
  type: StoryType
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
  type?: Exclude<TaskType, "break">  // Use the TaskType but exclude "break" type
  isFlexible?: boolean
  splitInfo?: SplitInfo
  suggestedBreaks?: TaskBreak[]
  status?: TaskStatus
}

export interface TimeBox {
  type: TimeBoxType
  duration: number
  tasks?: TimeBoxTask[]
  estimatedStartTime?: string
  estimatedEndTime?: string
  icon?: string
  status?: TaskStatus
}

export interface StoryBlock {
  id: string
  title: string
  timeBoxes: TimeBox[]
  totalDuration: number
  progress: number
  icon?: string
  type?: StoryType
  originalTitle?: string
  parentStoryId?: string
  taskIds: string[]
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
export type SessionState = "planned" | "in-progress" | "completed"

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
  status: SessionState
  currentStoryIndex?: number
  currentTimeBoxIndex?: number
}

