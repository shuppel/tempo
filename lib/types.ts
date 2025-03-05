/**
* Domain Types for Task and Time Management System
* 
* This file contains the core domain model for the application's task management system.
* It follows the Single Source of Truth principle by centralizing all type definitions
* used throughout the application, ensuring consistency and reducing duplication.
*/

/**
* UserPreferences - Configuration settings for user's work and break patterns
* 
* Defines user-specific settings for managing work duration, break intervals,
* and notification preferences to maintain optimal productivity.
*/
export interface UserPreferences {
  durationRules: {
    maxWorkWithoutBreak: number;  // minutes
    minBreakDuration: number;     // minutes
    shortBreakDuration: number;   // minutes
    longBreakDuration: number;    // minutes
    blockSize: number;            // minutes (for rounding)
  };
  breakReminders: boolean;
  breakSuggestionFrequency: 'low' | 'medium' | 'high';
}

/**
* SplitInfo - Metadata for tasks that have been divided into smaller parts
* 
* When a task is too large for a single work session, it gets split into multiple parts.
* This interface tracks the relationship between the original task and its parts.
*/
export interface SplitInfo {
  isParent: boolean                // Whether this is the original task (true) or a split part (false)
  partNumber?: number              // For child tasks: which part number in the sequence (1, 2, 3...)
  totalParts?: number              // For child tasks: total number of parts the original was split into
  originalDuration?: number        // Original task's duration before splitting
  parentTaskId?: string            // For child tasks: reference to the original task's ID
  originalTitle?: string           // Original task title before part number was appended
  storyId?: string                 // ID of the story block this task belongs to
 }
 
 /**
 * Task Category Types
 * 
 * These define the nature of work involved in a task, which affects how it's
 * scheduled and what UI elements are shown.
 */
 export type TaskType = "focus" | "learning" | "review" | "break" | "research"
 export type TaskCategory = TaskType // Alias for backward compatibility
 
 /**
 * Status Types - Track progress states across the system
 * 
 * These status types are used throughout the application to represent the
 * current state of various entities (tasks, timeboxes, workplans).
 */
 export type BaseStatus = "todo" | "completed" | "in-progress" | "mitigated"
 export type TaskStatus = BaseStatus | "pending" // TaskStatus adds "pending" for tasks awaiting action
 export type TimeBoxStatus = BaseStatus          // TimeBox uses the base status types directly
 export type WorkPlanStatus = "planned" | "in-progress" | "completed" | "archived" // WorkPlan adds "planned"/"archived"
 
 /**
 * Structural Type Definitions
 * 
 * These define how tasks are organized and scheduled.
 */
 export type StoryType = "timeboxed" | "flexible" | "milestone" // How stories are scheduled
 export type TimeBoxType = "work" | "short-break" | "long-break" | "debrief" // Types of time blocks
 
 /**
 * Difficulty Classification
 * 
 * Tasks are categorized by complexity/difficulty to aid in scheduling
 * and to provide visual indicators to the user.
 */
 export type DifficultyLevel = "low" | "medium" | "high"
 export type TaskComplexity = DifficultyLevel // Alias for backward compatibility
 
 /**
 * UI Configuration for Visual Indicators
 * 
 * These settings define how difficulty levels are visually represented in the UI.
 */
 export interface BadgeConfig {
  color: string   // CSS color class for the badge
  label: string   // Human-readable label 
  icon?: string   // Optional icon to display
 }
 
 /**
 * Standard color and label mappings for difficulty levels
 * These provide consistent visual cues across the application.
 */
 export const DIFFICULTY_BADGES: Record<DifficultyLevel, BadgeConfig> = {
  low: { color: 'bg-green-100 text-green-800', label: 'Easy' },
  medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
  high: { color: 'bg-red-100 text-red-800', label: 'Hard' }
 } as const
 
 /**
 * Task - Core entity representing a unit of work
 * 
 * Tasks are the fundamental building blocks of the system. They represent
 * discrete units of work that a user needs to complete.
 */
 export interface Task {
  id: string;
  title: string;
  description?: string;
  duration?: number; // in minutes
  taskCategory?: string;
  createdAt: Date;
  updatedAt: Date;
  status: "todo" | "in-progress" | "completed";
  priority: "low" | "medium" | "high";
  tags?: string[];
  dueDate?: Date;
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  assignedTo?: string;
  parentTaskId?: string;
  subtasks?: Task[];
  notes?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
 }
 
 /**
 * TaskBreak - Recommends pauses during task execution
 * 
 * Defines when and how long to take breaks during a task to maintain productivity.
 */
 export interface TaskBreak {
  after: number   // When to take the break (minutes from start)
  duration: number // How long the break should be (minutes)
  reason: string  // Explanation for why a break is needed at this point
 }
 
 /**
 * ProcessedTask - Task after AI analysis and preparation
 * 
 * Represents a task that has been analyzed by the AI and prepared for scheduling.
 * Contains additional metadata to help with optimal scheduling.
 */
 export interface ProcessedTask {
  id?: string                                    // Optional ID (may be assigned later)
  title: string                                  // Task description
  duration: number                               // Estimated time in minutes
  isFrog: boolean                                // High priority flag
  taskCategory: Exclude<TaskCategory, "break">   // Type of task (excluding breaks)
  projectType?: string                           // Optional project/category
  isFlexible: boolean                            // Whether timing can be adjusted
  needsSplitting?: boolean                       // If task is too large and should be divided
  splitInfo?: SplitInfo                          // Metadata for split tasks
  suggestedBreaks: TaskBreak[]                   // Recommended pauses during this task
  originalTitle?: string                         // Title before any modifications
 }
 
 /**
 * TaskGroup - Collection of related tasks
 * 
 * Used to group related tasks together for organizational purposes.
 */
 export interface TaskGroup {
  id: string                 // Unique identifier for the group
  tasks: string[]            // Array of task IDs belonging to this group
  totalDifficulty: number    // Aggregate difficulty score for all tasks
  completed: boolean         // Whether all tasks in the group are done
  estimatedDuration?: number // Total estimated time for all tasks
 }
 
 /**
 * ProcessedStory - Thematic group of tasks after AI processing
 * 
 * A story is a collection of related tasks that form a cohesive work unit.
 * The AI analyzes raw tasks and groups them into stories.
 */
 export interface ProcessedStory {
  title: string               // Name of the story
  summary: string             // Brief description of the story's purpose
  icon: string                // Visual representation (emoji)
  estimatedDuration: number   // Total time in minutes
  type: StoryType             // How this story should be scheduled
  projectType: string         // Project or category
  category: string            // General category (e.g., Development, Research)
  tasks: ProcessedTask[]      // Component tasks in this story
  needsBreaks?: boolean       // Whether to add breaks between tasks
  originalTitle?: string      // Original title before any modifications
 }
 
 /**
 * TimeBoxTask - Task as scheduled in a specific time block
 * 
 * Represents a task that has been scheduled into a specific time box.
 * Contains a subset of task properties relevant for execution.
 */
 export interface TimeBoxTask {
  title: string                               // Task description
  duration: number                            // Time allocation in minutes
  isFrog?: boolean                            // Optional priority flag
  taskCategory?: Exclude<TaskCategory, "break"> // Type of task (excluding breaks)
  projectType?: string                        // Optional project/category
  isFlexible?: boolean                        // Whether timing can be adjusted
  splitInfo?: SplitInfo                       // Metadata for split tasks
  suggestedBreaks?: TaskBreak[]               // Recommended pauses
  status?: TimeBoxStatus                      // Current execution status
 }
 
 /**
 * TimeBox - Discrete time block in a schedule
 * 
 * Represents a specific block of time dedicated to work or breaks.
 * The fundamental unit of time scheduling in the application.
 */
 export interface TimeBox {
  type: TimeBoxType           // Kind of time block (work, break, etc.)
  duration: number            // Length in minutes
  tasks?: TimeBoxTask[]       // Tasks assigned to this time block (for work blocks)
  estimatedStartTime?: string // Expected start time
  estimatedEndTime?: string   // Expected end time
  icon?: string               // Visual representation
  status?: TimeBoxStatus      // Current execution status
 }
 
 /**
 * StoryBlock - Story as scheduled with specific time blocks
 * 
 * Represents a story that has been scheduled into specific time blocks.
 * Contains both the story metadata and its constituent time boxes.
 */
 export interface StoryBlock {
  id: string                // Unique identifier
  title: string             // Name of the story
  timeBoxes: TimeBox[]      // Sequence of time blocks for this story
  totalDuration: number     // Total time in minutes for all time boxes
  progress: number          // Completion percentage (0-100)
  icon?: string             // Visual representation
  type?: StoryType          // How this story is scheduled
  originalTitle?: string    // Title before any modifications
  parentStoryId?: string    // For split stories: reference to original
  taskIds: string[]         // IDs of tasks in this story block
 }
 
 /**
 * FrogMetrics - Tracking for high-priority task scheduling
 * 
 * Tracks statistics about high-priority "frog" tasks to ensure they're
 * properly scheduled (preferably early in the day).
 */
 export interface FrogMetrics {
  total: number              // Total number of frog tasks
  scheduled: number          // How many have been scheduled
  scheduledWithinTarget: number // How many were scheduled early as recommended
 }
 
 /**
 * WorkPlan - Core scheduling plan for tasks
 * 
 * The central data structure that represents a planned schedule of work.
 * Contains all story blocks, their time allocations, and metrics.
 */
 export interface WorkPlan {
  storyBlocks: StoryBlock[]  // Ordered sequence of story blocks
  totalDuration: number      // Total duration in minutes for all blocks
  startTime?: string         // When the work plan begins
  endTime?: string           // When the work plan ends
  frogMetrics: FrogMetrics   // Statistics on high-priority task scheduling
 }
 
 /**
 * WorkPlan State Management
 */
 export type WorkPlanState = "planned" | "in-progress" | "completed"
 
 /**
 * WorkPlanSummary - Statistical overview of work plans
 * 
 * Provides aggregated data about work plans for reporting purposes.
 */
 export interface WorkPlanSummary {
  totalWorkPlans: number      // Number of work plans included
  startTime: string           // Earliest start time across all plans
  endTime: string             // Latest end time across all plans
  totalDuration: number       // Aggregated duration across all plans
 }
 
 /**
 * IncompleteTasks - Tracking for unfinished tasks
 * 
 * Records which tasks were not completed in a work plan, including
 * whether they were addressed (mitigated or rolled over).
 */
 export interface IncompleteTasks {
  count: number;              // Total number of incomplete tasks
  tasks: Array<{              // Details about each incomplete task
    title: string;            // Task name
    storyTitle: string;       // Story it belonged to
    duration: number;         // Estimated time
    taskCategory?: string;    // Type of task
    mitigated: boolean;       // Whether it was addressed despite not being completed
    rolledOver: boolean;      // Whether it was moved to a future work plan
  }>;
 }
 
 /**
 * TodoWorkPlan Status Types
 */
 export type TodoWorkPlanStatus = "planned" | "in-progress" | "completed" | "archived"
 
 /**
 * TodoWorkPlan - Concrete daily planning instance
 * 
 * Represents an actual day's plan with tasks, time blocks, and execution state.
 * Includes timer state and tracking for incomplete tasks.
 */
 export interface TodoWorkPlan {
  id: string                  // Unique identifier (typically YYYY-MM-DD date)
  storyBlocks: StoryBlock[]   // Ordered sequence of story blocks
  status: TodoWorkPlanStatus  // Current execution state
  totalDuration: number       // Total duration in minutes
  startTime: string           // When the work plan begins
  endTime: string             // When the work plan ends
  lastUpdated: string         // Timestamp of last modification
  
  // Timer state - tracks current execution
  activeTimeBox: { storyId: string; timeBoxIndex: number } | null // Currently active time block
  timeRemaining: number | null // Seconds remaining in current time block
  isTimerRunning: boolean     // Whether timer is currently running
  
  // Task tracking
  incompleteTasks?: IncompleteTasks // Information about unfinished tasks
 }
 
 /**
 * API Response Types
 * 
 * These types define the structure of data exchanged with the API.
 */
 
 /**
 * APIWorkPlanResponse - WorkPlan with additional API metadata
 * 
 * Extends the WorkPlan interface with additional fields needed for API communication.
 */
 export interface APIWorkPlanResponse extends WorkPlan {
  storyMapping?: Array<{      // Maps between possible titles and original titles
    possibleTitle: string;    // Title that might be used in the response
    originalTitle: string;    // Original title from the request
  }>;
 }
 
 /**
 * API Task Representation
 * 
 * Represents a task as received from the API, with support for legacy field names.
 */
 export interface APIProcessedTask {
  id?: string;                // Optional task ID
  title: string;              // Task name
  duration: number;           // Time in minutes
  isFrog: boolean;            // Priority flag
  taskCategory?: Exclude<TaskCategory, "break">; // Modern field name
  type?: string;              // Legacy field name for taskCategory
  projectType?: string;       // Modern field name
  project?: string;           // Legacy field name for projectType
  isFlexible: boolean;        // Whether timing can be adjusted
  needsSplitting?: boolean;   // If task is too large
  splitInfo?: SplitInfo;      // Split task metadata
  suggestedBreaks: TaskBreak[]; // Recommended pauses
  originalTitle?: string;     // Title before modification
 }
 
 /**
 * API Story Representation
 * 
 * Represents a story as received from the API, with support for legacy field names.
 */
 export interface APIProcessedStory {
  title: string;              // Story name
  summary: string;            // Brief description
  icon: string;               // Visual representation
  estimatedDuration: number;  // Total time in minutes
  type?: StoryType;           // Legacy field name for type
  storyType?: StoryType;      // Modern field name
  projectType?: string;       // Modern field name
  project?: string;           // Legacy field name for projectType
  category: string;           // General category
  tasks: APIProcessedTask[];  // Component tasks
  needsBreaks?: boolean;      // Whether to add breaks
  originalTitle?: string;     // Original title
 }
 
 /**
 * API Process Endpoint Response
 * 
 * The structure returned by the task processing API endpoint.
 */
 export interface APIProcessResponse {
  stories: APIProcessedStory[]; // Processed stories from raw tasks
 }
 
 /**
 * Legacy API Session Response
 * 
 * Maintains backward compatibility with previous API naming.
 */
 export interface APISessionResponse extends WorkPlan {
  storyMapping?: Array<{     // Maps between possible titles and original titles
    possibleTitle: string;   // Title that might be used in the response
    originalTitle: string;   // Original title from the request
  }>;
 }