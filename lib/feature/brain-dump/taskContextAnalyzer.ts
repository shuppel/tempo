/**
 * Task Context Analyzer
 * 
 * This utility analyzes tasks to determine their context and provides
 * optimized time suggestions based on task type, complexity, and other factors.
 */

import type { Task, TaskCategory, DifficultyLevel } from '@/lib/types';
import type { ProcessedTask } from '@/app/features/brain-dump/types';

// Define the extended task context types
export type TaskContextType = 
  // Core types from TaskCategory
  | 'focus'
  | 'learning'
  | 'review'
  | 'research'
  // Extended context types
  | 'meeting'
  | 'creative'
  | 'admin'
  | 'planning'
  | 'reading'
  | 'writing'
  | 'coding';

/**
 * Context-specific duration recommendations for tasks
 */
export interface TaskContextRecommendation {
  type: TaskContextType;
  minDuration: number; // Minimum recommended duration in minutes
  maxDuration: number; // Maximum recommended duration in minutes
  idealBreakInterval: number; // Ideal time between breaks in minutes
  breakDuration: number; // Recommended break duration in minutes
  flowStateThreshold: number; // Minutes until flow state is likely to develop
  description: string; // Description of this task type
  examples: string[]; // Example activities
}

/**
 * Recommended durations for different task contexts
 */
export const TASK_CONTEXT_RECOMMENDATIONS: Record<TaskContextType, TaskContextRecommendation> = {
  focus: {
    type: 'focus',
    minDuration: 25,
    maxDuration: 90,
    idealBreakInterval: 45,
    breakDuration: 10,
    flowStateThreshold: 15,
    description: "Deep work that requires full concentration",
    examples: ["coding complex features", "data analysis", "problem-solving"]
  },
  meeting: {
    type: 'meeting',
    minDuration: 15,
    maxDuration: 60,
    idealBreakInterval: 45,
    breakDuration: 15,
    flowStateThreshold: 30,
    description: "Synchronous communication with others",
    examples: ["1:1s", "team meetings", "presentations"]
  },
  learning: {
    type: 'learning',
    minDuration: 20,
    maxDuration: 50,
    idealBreakInterval: 25,
    breakDuration: 5,
    flowStateThreshold: 15,
    description: "Acquiring new knowledge or skills",
    examples: ["tutorials", "courses", "educational reading"]
  },
  creative: {
    type: 'creative',
    minDuration: 30,
    maxDuration: 120,
    idealBreakInterval: 60,
    breakDuration: 15,
    flowStateThreshold: 20,
    description: "Work requiring imagination and innovation",
    examples: ["design", "brainstorming", "content creation"]
  },
  admin: {
    type: 'admin',
    minDuration: 15,
    maxDuration: 45,
    idealBreakInterval: 25,
    breakDuration: 5,
    flowStateThreshold: 20,
    description: "Routine administrative tasks",
    examples: ["email", "scheduling", "expense reports"]
  },
  planning: {
    type: 'planning',
    minDuration: 20,
    maxDuration: 60,
    idealBreakInterval: 40,
    breakDuration: 10,
    flowStateThreshold: 25,
    description: "Organizing work and setting priorities",
    examples: ["roadmapping", "sprint planning", "goal setting"]
  },
  reading: {
    type: 'reading',
    minDuration: 20,
    maxDuration: 60,
    idealBreakInterval: 30,
    breakDuration: 10,
    flowStateThreshold: 15,
    description: "Consuming written content",
    examples: ["documentation", "articles", "books"]
  },
  writing: {
    type: 'writing',
    minDuration: 25,
    maxDuration: 75,
    idealBreakInterval: 40,
    breakDuration: 10,
    flowStateThreshold: 20,
    description: "Creating written content",
    examples: ["documentation", "blog posts", "reports"]
  },
  coding: {
    type: 'coding',
    minDuration: 30,
    maxDuration: 90,
    idealBreakInterval: 50,
    breakDuration: 10,
    flowStateThreshold: 20,
    description: "Software development work",
    examples: ["programming", "debugging", "code review"]
  },
  review: {
    type: 'review',
    minDuration: 15,
    maxDuration: 60,
    idealBreakInterval: 30,
    breakDuration: 10,
    flowStateThreshold: 20,
    description: "Examining and providing feedback",
    examples: ["code reviews", "document editing", "quality checks"]
  },
  research: {
    type: 'research',
    minDuration: 25,
    maxDuration: 75,
    idealBreakInterval: 45,
    breakDuration: 15,
    flowStateThreshold: 25,
    description: "Gathering and analyzing information",
    examples: ["market research", "literature reviews", "data exploration"]
  }
};

/**
 * Analyze task context based on title, description, and metadata
 */
export function analyzeTaskContext(task: ProcessedTask): TaskContextType {
  // Start with the task category if it's one of our context types
  let context: TaskContextType = task.taskCategory as TaskContextType;
  
  // Look for context clues in the title
  const text = task.title.toLowerCase();
  
  // Check for meeting indicators
  if (
    text.includes('meeting') || 
    text.includes('sync') || 
    text.includes('1:1') ||
    text.includes('call') ||
    text.includes('presentation')
  ) {
    return 'meeting';
  }
  
  // Check for creative work
  if (
    text.includes('design') ||
    text.includes('create') ||
    text.includes('brainstorm') ||
    text.includes('ideate')
  ) {
    return 'creative';
  }
  
  // Check for administrative tasks
  if (
    text.includes('email') ||
    text.includes('schedule') ||
    text.includes('organize') ||
    text.includes('update') ||
    text.includes('report')
  ) {
    return 'admin';
  }
  
  // Check for planning activities
  if (
    text.includes('plan') ||
    text.includes('strategy') ||
    text.includes('roadmap') ||
    text.includes('prioritize') ||
    text.includes('goal')
  ) {
    return 'planning';
  }
  
  // Check for reading tasks
  if (
    text.includes('read') ||
    text.includes('review') ||
    text.includes('document')
  ) {
    return 'reading';
  }
  
  // Check for writing tasks
  if (
    text.includes('write') ||
    text.includes('draft') ||
    text.includes('author') ||
    text.includes('blog') ||
    text.includes('post')
  ) {
    return 'writing';
  }
  
  // Check for coding tasks
  if (
    text.includes('code') ||
    text.includes('develop') ||
    text.includes('implement') ||
    text.includes('program') ||
    text.includes('debug') ||
    text.includes('test')
  ) {
    return 'coding';
  }
  
  // Return the best match
  return context;
}

/**
 * Get recommended duration and break schedule for a task
 */
export function getContextRecommendations(task: ProcessedTask): TaskContextRecommendation {
  const context = analyzeTaskContext(task);
  const recommendations = TASK_CONTEXT_RECOMMENDATIONS[context];
  
  // Apply difficulty level adjustments
  const adjustedRecommendations = { ...recommendations };
  
  switch (task.difficulty) {
    case 'high':
      // For high difficulty tasks, reduce max duration and break interval
      adjustedRecommendations.maxDuration = Math.min(
        recommendations.maxDuration,
        Math.max(recommendations.minDuration + 15, recommendations.maxDuration * 0.8)
      );
      adjustedRecommendations.idealBreakInterval = Math.min(
        recommendations.idealBreakInterval,
        Math.max(15, recommendations.idealBreakInterval * 0.7)
      );
      break;
      
    case 'low':
      // For low difficulty tasks, allow longer sessions
      adjustedRecommendations.maxDuration = Math.min(
        recommendations.maxDuration * 1.25,
        120 // Cap at 2 hours
      );
      adjustedRecommendations.idealBreakInterval = Math.min(
        recommendations.idealBreakInterval * 1.25,
        75 // Cap at 75 minutes
      );
      break;
  }
  
  return adjustedRecommendations;
}

/**
 * Determine if a task duration is appropriate for its context
 */
export function isTaskDurationAppropriate(task: ProcessedTask): {
  appropriate: boolean;
  recommendation?: Partial<TaskContextRecommendation>;
  message?: string;
} {
  const recommendations = getContextRecommendations(task);
  const duration = task.duration ?? recommendations.minDuration;
  
  if (duration < recommendations.minDuration) {
    return {
      appropriate: false,
      recommendation: {
        minDuration: recommendations.minDuration
      },
      message: `This task may be too short for a ${recommendations.type} task. Consider at least ${recommendations.minDuration} minutes to achieve flow state.`
    };
  }
  
  if (duration > recommendations.maxDuration) {
    return {
      appropriate: false,
      recommendation: {
        maxDuration: recommendations.maxDuration,
        breakDuration: recommendations.breakDuration
      },
      message: `This task may be too long for sustained ${recommendations.type} work. Consider breaking it up with a ${recommendations.breakDuration}-minute break every ${recommendations.idealBreakInterval} minutes.`
    };
  }
  
  return { appropriate: true };
}

/**
 * Suggest break schedule for a task based on its context and duration
 */
export function suggestBreakSchedule(task: ProcessedTask): {
  breakPoints: number[]; // Minutes into the task when breaks should occur
  breakDurations: number[]; // Duration of each break in minutes
} {
  const recommendations = getContextRecommendations(task);
  const duration = task.duration ?? recommendations.minDuration;
  const breakPoints: number[] = [];
  const breakDurations: number[] = [];
  
  // No breaks needed for short tasks
  if (duration <= recommendations.idealBreakInterval) {
    return { breakPoints, breakDurations };
  }
  
  // Calculate break points
  let timeElapsed = recommendations.idealBreakInterval;
  while (timeElapsed < duration) {
    breakPoints.push(timeElapsed);
    
    // Alternate between short and long breaks
    const isLongBreak = breakPoints.length % 3 === 0;
    const breakDuration = isLongBreak ? 
      Math.min(15, recommendations.breakDuration * 1.5) : 
      recommendations.breakDuration;
      
    breakDurations.push(breakDuration);
    
    // Next break point
    timeElapsed += recommendations.idealBreakInterval;
  }
  
  return { breakPoints, breakDurations };
} 