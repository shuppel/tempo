/**
 * Brain Dump System Rules and Documentation
 *
 * This document outlines the core rules, components, and interactions of the Brain Dump system.
 * It serves as a reference for AI models and developers to understand the system's behavior.
 */

import type { TaskType, StoryType, SessionState } from "../../../../lib/types";
import { DURATION_RULES } from "../../../../lib/durationUtils";

/**
 * System Overview
 * ---------------
 * The Brain Dump system is a task management and scheduling solution that:
 * 1. Processes raw task input into structured stories
 * 2. Organizes tasks into time-boxed sessions
 * 3. Manages work/break balance
 * 4. Tracks session progress and completion
 */

/**
 * Core Components
 * --------------
 * 1. Task Processing (/api/tasks/process)
 * 2. Session Creation (/api/tasks/create-session)
 * 3. Brain Dump Service (features/brain-dump/services)
 * 4. Duration Management (durationUtils.ts)
 * 5. Session Storage (sessionStorage.ts)
 * 6. Task Management (task-manager.ts)
 * 7. AI Integration (ai.ts)
 */

/**
 * Duration Rules
 * -------------
 */
export const BRAIN_DUMP_DURATION_RULES = {
  // Core duration constraints from durationUtils
  MIN_DURATION: DURATION_RULES.MIN_DURATION, // 15 minutes
  BLOCK_SIZE: DURATION_RULES.BLOCK_SIZE, // 5 minutes
  MAX_DURATION: DURATION_RULES.MAX_DURATION, // 180 minutes (3 hours) - individual task max
  MAX_WORK_WITHOUT_BREAK: DURATION_RULES.MAX_WORK_WITHOUT_BREAK, // 90 minutes

  // Break durations
  SHORT_BREAK: DURATION_RULES.SHORT_BREAK, // 5 minutes
  LONG_BREAK: DURATION_RULES.LONG_BREAK, // 15 minutes
  DEBRIEF: DURATION_RULES.DEBRIEF, // 5 minutes

  // Task-specific rules
  SPLIT_THRESHOLD: 60, // Minutes before task splitting
  FROG_TARGET_COMPLETION: 1 / 3, // Complete frogs in first third

  // Session rules
  USER_DEFINED_SCHEDULE: true, // Users can set start/end times
  NO_TOTAL_DURATION_LIMIT: true, // No fixed limit on total session duration
  TASK_OVERFLOW_HANDLING: "reschedule", // Tasks that don't fit will be rescheduled
} as const;

/**
 * Task Processing Rules
 * --------------------
 */
export const TASK_PROCESSING_RULES = {
  // Task Types - Use the imported type
  VALID_TYPES: [
    "focus",
    "learning",
    "review",
    "break",
    "research",
  ] as Array<TaskType>,

  // Task Splitting
  SPLIT_CONDITIONS: {
    DURATION: BRAIN_DUMP_DURATION_RULES.SPLIT_THRESHOLD,
    MAX_PARTS: 3, // Maximum parts to split into
    MIN_PART_DURATION: BRAIN_DUMP_DURATION_RULES.MIN_DURATION,
  },

  // Break Insertion Rules
  BREAK_RULES: {
    SHORT_BREAK_AFTER: 40, // Minutes of work before short break
    LONG_BREAK_AFTER: 90, // Minutes of work before long break
    CONSECUTIVE_TASKS: true, // Add breaks between consecutive tasks
    BREAK_TYPES: {
      SHORT: {
        duration: BRAIN_DUMP_DURATION_RULES.SHORT_BREAK,
        reason: "Short break between tasks",
      },
      LONG: {
        duration: BRAIN_DUMP_DURATION_RULES.LONG_BREAK,
        reason: "Required break to prevent excessive work time",
      },
      DEBRIEF: {
        duration: BRAIN_DUMP_DURATION_RULES.DEBRIEF,
        reason: "Story completion debrief",
      },
    },
  },
} as const;

/**
 * Story Mapping & Task Reference Rules
 * ----------------------------------
 * These rules govern how split tasks and stories are referenced and matched
 * when generating and validating session plans.
 */
export const STORY_MAPPING_RULES = {
  // Task Splitting Patterns
  PATTERNS: {
    PART_INDICATOR: /\(part \d+ of \d+\)/i, // Pattern for detecting part indicators
    EXTRACT_BASE_TITLE: (title: string) =>
      title.replace(/\s*\(part \d+ of \d+\)\s*$/i, "").trim(),
  },

  // Reference Tracking
  REFERENCE_TRACKING: {
    PRESERVE_ORIGINAL_TITLE: true, // Store original titles when splitting
    TRACK_ORIGINAL_TASKS: true, // Maintain links to original tasks
    USE_STORY_MAPPING: true, // Send story mapping to session creation
  },

  // Matching Strategies (in priority order)
  MATCHING_STRATEGIES: [
    "exact_match", // Direct title match
    "mapping_lookup", // Use provided mapping data
    "base_title_match", // Match without part indicators
    "contains_match", // One title contains the other
    "fuzzy_word_match", // Match based on overlapping words
  ],

  // Fuzzy Matching
  FUZZY_MATCHING: {
    MIN_WORD_MATCH: 2, // Minimum words that must match
    MIN_WORD_MATCH_PERCENT: 50, // Or % of words that must match
  },
} as const;

/**
 * Story Organization Rules
 * -----------------------
 */
export const STORY_RULES = {
  // Story Types
  TYPES: ["timeboxed", "flexible", "milestone"] as const as Array<StoryType>,

  // Story Grouping
  GROUPING: {
    KEEP_PROJECTS_SEPARATE: true, // Don't mix projects in stories
    GROUP_BY_FEATURE: true, // Group tasks by feature/component
    RESPECT_DEPENDENCIES: true, // Maintain task dependencies
    MAX_STORY_DURATION: 180, // Maximum minutes per story
    MIN_TASKS_PER_STORY: 1, // Minimum tasks per story
    MAX_TASKS_PER_STORY: 5, // Maximum tasks per story
  },

  // Story Processing
  PROCESSING: {
    VALIDATE_DURATIONS: true, // Ensure valid durations
    ROUND_TO_BLOCKS: true, // Round to 5-minute blocks
    ADD_BREAKS: true, // Add breaks between tasks
    TRACK_CUMULATIVE_WORK: true, // Track total work time
  },
} as const;

/**
 * Session Creation Rules
 * ---------------------
 */
export const SESSION_RULES = {
  // Session Validation
  VALIDATION: {
    REQUIRE_STORY_BLOCKS: true, // Must have story blocks
    VALIDATE_DURATIONS: true, // Check duration constraints
    ENSURE_BREAKS: true, // Verify break placement
    MAX_RETRIES: 5, // Max retry attempts
  },

  // Session Storage
  STORAGE: {
    USE_LOCAL_STORAGE: true, // Store in localStorage
    SESSION_PREFIX: "session-", // Storage key prefix
    STORE_METADATA: true, // Include metadata
    VALIDATE_ON_LOAD: true, // Validate when loading
  },

  // Session States
  STATES: [
    "planned",
    "in-progress",
    "completed",
  ] as const as Array<SessionState>,

  // Progress Tracking
  TRACKING: {
    TRACK_STORY_PROGRESS: true, // Track per-story progress
    TRACK_TASK_STATUS: true, // Track individual tasks
    STORE_TIMESTAMPS: true, // Store timing information
  },
} as const;

/**
 * AI Integration Rules
 * -------------------
 */
export const AI_RULES = {
  // Task Refinement
  REFINEMENT: {
    ANALYZE_DIFFICULTY: true, // Assess task difficulty
    SUGGEST_DURATION: true, // Suggest task duration
    DETECT_DEPENDENCIES: true, // Identify dependencies
    USE_FIBONACCI: true, // Use Fibonacci for scoring
  },

  // Task Organization
  ORGANIZATION: {
    RESPECT_FROGS: true, // Prioritize frog tasks
    GROUP_BY_PROJECT: true, // Group by project
    CONSIDER_DIFFICULTY: true, // Consider task difficulty
    OPTIMIZE_SEQUENCE: true, // Optimize task sequence
  },

  // Models and Endpoints
  ENDPOINTS: {
    TASK_PROCESSING: "/api/tasks/process",
    SESSION_CREATION: "/api/tasks/create-session",
    AI_REFINEMENT: "/api/ai",
  },
} as const;

/**
 * Integration Flow
 * ---------------
 * 1. Raw tasks → Task Processing API
 *    - Analyzes and structures tasks
 *    - Groups into stories
 *    - Adds metadata and suggestions
 *
 * 2. Processed Stories → Session Creation API
 *    - Creates time-boxed session plan
 *    - Validates durations and breaks
 *    - Ensures work/break balance
 *
 * 3. Session Plan → Session Storage
 *    - Saves session data
 *    - Tracks progress
 *    - Manages session state
 */

/**
 * Error Handling
 * -------------
 */
export const ERROR_HANDLING_RULES = {
  // Retry Strategies
  RETRIES: {
    MAX_ATTEMPTS: 5, // Maximum retry attempts
    BACKOFF_MS: 1000, // Base backoff time
    PARSING_BACKOFF_MS: 2000, // Parsing error backoff
  },

  // Error Categories
  CATEGORIES: {
    VALIDATION: "VALIDATION_ERROR",
    PARSING: "PARSE_ERROR",
    DURATION: "DURATION_ERROR",
    STRUCTURE: "STRUCTURE_ERROR",
    API: "API_ERROR",
  },

  // Recovery Strategies
  RECOVERY: {
    MODIFY_STORIES: true, // Modify stories on error
    SPLIT_LONG_TASKS: true, // Split tasks causing errors
    ADD_BREAKS: true, // Add breaks on work time errors
    VALIDATE_CHANGES: true, // Validate modifications
  },
} as const;

/**
 * Type Validation Rules
 * --------------------
 */
export const TYPE_VALIDATION_RULES = {
  // Required Fields
  REQUIRED: {
    TASK: ["title", "duration", "type"] as const,
    STORY: ["title", "tasks", "estimatedDuration"] as const,
    SESSION: ["storyBlocks", "totalDuration", "startTime"] as const,
  },

  // Type Constraints
  CONSTRAINTS: {
    DURATION_NUMBER: true, // Durations must be numbers
    VALID_TIMESTAMPS: true, // Validate timestamps
    ARRAY_CHECKS: true, // Validate arrays
    TYPE_ENFORCEMENT: true, // Enforce type constraints
  },
} as const;

/**
 * Usage Example:
 * -------------
 * ```typescript
 * import {
 *   BRAIN_DUMP_DURATION_RULES,
 *   TASK_PROCESSING_RULES,
 *   STORY_RULES,
 *   SESSION_RULES,
 *   AI_RULES,
 *   ERROR_HANDLING_RULES,
 *   TYPE_VALIDATION_RULES
 * } from "./brain-dump-rules"
 *
 * // Use rules for validation, processing, and error handling
 * if (duration > BRAIN_DUMP_DURATION_RULES.SPLIT_THRESHOLD) {
 *   // Split task according to rules
 * }
 * ```
 */
