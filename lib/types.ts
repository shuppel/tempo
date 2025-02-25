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
  taskCategory: TaskCategory  // Renamed from type
  projectType?: string
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
  taskCategory?: Exclude<TaskCategory, "break">  // Renamed from type
  projectType?: string
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
  // Allow either of these field names
  taskCategory?: Exclude<TaskCategory, "break">;
  type?: string;
  // Allow either of these field names
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

