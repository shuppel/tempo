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
export type TaskCategory = TaskType

// Consolidated status types
export type BaseStatus = "todo" | "completed" | "in-progress" | "mitigated"
export type TaskStatus = BaseStatus | "pending" // TaskStatus extends base Status with additional states
export type TimeBoxStatus = BaseStatus // TimeBox uses base Status
export type SessionStatus = "planned" | "in-progress" | "completed" | "archived" // Session has a special 'planned' state and 'archived' state

export type StoryType = "timeboxed" | "flexible" | "milestone"
export type TimeBoxType = "work" | "short-break" | "long-break" | "debrief"

// Consolidated difficulty types
export type DifficultyLevel = "low" | "medium" | "high"
export type TaskComplexity = DifficultyLevel

// Badge configurations
export interface BadgeConfig {
  color: string
  label: string
  icon?: string
}

export const DIFFICULTY_BADGES: Record<DifficultyLevel, BadgeConfig> = {
  low: { color: 'bg-green-100 text-green-800', label: 'Easy' },
  medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
  high: { color: 'bg-red-100 text-red-800', label: 'Hard' }
} as const

export interface Task {
  id: string
  title: string
  description: string
  duration: number
  difficulty: DifficultyLevel
  taskCategory: TaskCategory
  projectType?: string
  isFrog: boolean
  status: BaseStatus
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
  id?: string
  title: string
  duration: number
  isFrog: boolean
  taskCategory: Exclude<TaskCategory, "break">  // Renamed from type
  projectType?: string
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
  projectType: string  // Renamed from project
  category: string
  tasks: ProcessedTask[]
  needsBreaks?: boolean
  originalTitle?: string
}

export interface TimeBoxTask {
  title: string
  duration: number
  isFrog?: boolean
  taskCategory?: Exclude<TaskCategory, "break">
  projectType?: string
  isFlexible?: boolean
  splitInfo?: SplitInfo
  suggestedBreaks?: TaskBreak[]
  status?: TimeBoxStatus
}

export interface TimeBox {
  type: TimeBoxType
  duration: number
  tasks?: TimeBoxTask[]
  estimatedStartTime?: string
  estimatedEndTime?: string
  icon?: string
  status?: TimeBoxStatus
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

export interface Session {
  date: string
  storyBlocks: StoryBlock[]
  status: SessionStatus
  totalDuration: number
  lastUpdated?: string
}

/**
 * API Extended Types - these types extend the base types with legacy field names
 * to support APIs that might send data with old property names
 */

// Define the API task interface from scratch instead of extending
export interface APIProcessedTask {
  id?: string;
  title: string;
  duration: number;
  isFrog: boolean;
  taskCategory?: Exclude<TaskCategory, "break">;
  type?: string;
  projectType?: string;
  project?: string;
  isFlexible: boolean;
  needsSplitting?: boolean;
  splitInfo?: SplitInfo;
  suggestedBreaks: TaskBreak[];
  originalTitle?: string;
}

// Define the API story interface from scratch
export interface APIProcessedStory {
  title: string;
  summary: string;
  icon: string;
  estimatedDuration: number;
  // Allow either of these field names
  type?: StoryType;
  storyType?: StoryType;
  // Allow either of these field names
  projectType?: string;
  project?: string;
  category: string;
  tasks: APIProcessedTask[];
  needsBreaks?: boolean;
  originalTitle?: string;
}

// API response format for the process endpoint
export interface APIProcessResponse {
  stories: APIProcessedStory[];
}

// API response format for the session creation endpoint
export interface APISessionResponse extends SessionPlan {
  // Include any API-specific fields here
  storyMapping?: Array<{
    possibleTitle: string;
    originalTitle: string;
  }>;
}

