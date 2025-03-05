import type { Task } from "./types";

export type TaskContextType = 
  | "focus" 
  | "meeting" 
  | "learning" 
  | "creative" 
  | "admin" 
  | "planning" 
  | "reading" 
  | "writing" 
  | "coding" 
  | "review" 
  | "research";

interface TaskContextRecommendation {
  minDuration: number;
  maxDuration: number;
  idealBreakInterval: number;
  breakDuration: number;
  flowStateThreshold: number;
  description: string;
  examples: string[];
}

export const TASK_CONTEXT_RECOMMENDATIONS: Record<TaskContextType, TaskContextRecommendation> = {
  focus: {
    minDuration: 25,
    maxDuration: 90,
    idealBreakInterval: 25,
    breakDuration: 5,
    flowStateThreshold: 45,
    description: "High-focus tasks require uninterrupted concentration. Use the Pomodoro Technique (25 min work/5 min break) or extend to longer sessions if in flow.",
    examples: ["Deep work", "Problem solving", "Analysis", "Strategic thinking"]
  },
  meeting: {
    minDuration: 15,
    maxDuration: 60,
    idealBreakInterval: 45,
    breakDuration: 10,
    flowStateThreshold: 30,
    description: "Keep meetings focused and time-boxed. Include breaks for longer sessions to maintain engagement and productivity.",
    examples: ["Team sync", "1:1s", "Client calls", "Presentations"]
  },
  learning: {
    minDuration: 30,
    maxDuration: 120,
    idealBreakInterval: 45,
    breakDuration: 15,
    flowStateThreshold: 60,
    description: "Learning sessions should be long enough to achieve understanding but include breaks to aid retention and prevent mental fatigue.",
    examples: ["Studying", "Tutorials", "Documentation", "New concepts"]
  },
  creative: {
    minDuration: 45,
    maxDuration: 120,
    idealBreakInterval: 60,
    breakDuration: 15,
    flowStateThreshold: 45,
    description: "Creative work benefits from longer sessions to achieve flow state, with breaks to refresh perspective and maintain energy.",
    examples: ["Design", "Brainstorming", "Content creation", "Problem solving"]
  },
  admin: {
    minDuration: 15,
    maxDuration: 45,
    idealBreakInterval: 30,
    breakDuration: 5,
    flowStateThreshold: 30,
    description: "Administrative tasks are best handled in focused bursts to maintain accuracy while preventing monotony.",
    examples: ["Email", "Scheduling", "Documentation", "Organization"]
  },
  planning: {
    minDuration: 30,
    maxDuration: 90,
    idealBreakInterval: 45,
    breakDuration: 10,
    flowStateThreshold: 45,
    description: "Planning requires a balance of focused thinking and strategic breaks to maintain perspective and avoid decision fatigue.",
    examples: ["Project planning", "Sprint planning", "Goal setting", "Roadmapping"]
  },
  reading: {
    minDuration: 20,
    maxDuration: 60,
    idealBreakInterval: 30,
    breakDuration: 5,
    flowStateThreshold: 40,
    description: "Reading sessions should be long enough to maintain comprehension but include breaks to prevent eye strain and maintain focus.",
    examples: ["Documentation", "Articles", "Research papers", "Books"]
  },
  writing: {
    minDuration: 30,
    maxDuration: 90,
    idealBreakInterval: 45,
    breakDuration: 10,
    flowStateThreshold: 45,
    description: "Writing benefits from sustained focus to maintain flow and coherence, with breaks to refresh creativity and perspective.",
    examples: ["Documentation", "Blog posts", "Reports", "Proposals"]
  },
  coding: {
    minDuration: 45,
    maxDuration: 120,
    idealBreakInterval: 60,
    breakDuration: 15,
    flowStateThreshold: 45,
    description: "Programming requires longer sessions to achieve and maintain flow state, with strategic breaks to prevent burnout and maintain code quality.",
    examples: ["Development", "Debugging", "Code review", "Refactoring"]
  },
  review: {
    minDuration: 20,
    maxDuration: 60,
    idealBreakInterval: 30,
    breakDuration: 10,
    flowStateThreshold: 35,
    description: "Review tasks require focused attention to detail while maintaining a fresh perspective through regular breaks.",
    examples: ["Code review", "Document review", "Quality assurance", "Feedback"]
  },
  research: {
    minDuration: 45,
    maxDuration: 120,
    idealBreakInterval: 60,
    breakDuration: 15,
    flowStateThreshold: 50,
    description: "Research benefits from extended focus periods to dive deep into topics, with breaks to process information and maintain clarity.",
    examples: ["Market research", "Technical research", "Literature review", "Analysis"]
  }
};

interface TaskContextAnalysis {
  context: TaskContextType;
  confidence: number;
}

interface TaskDurationCheck {
  appropriate: boolean;
  message?: string;
  recommendation?: TaskContextRecommendation;
}

// Keywords associated with each context type
const CONTEXT_KEYWORDS: Record<TaskContextType, string[]> = {
  focus: ["focus", "concentrate", "deep work", "analysis", "solve", "think"],
  meeting: ["meet", "call", "sync", "discuss", "present", "interview"],
  learning: ["learn", "study", "tutorial", "course", "understand", "practice"],
  creative: ["design", "create", "brainstorm", "ideate", "sketch", "innovate"],
  admin: ["admin", "organize", "schedule", "email", "process", "document"],
  planning: ["plan", "strategy", "roadmap", "outline", "prepare", "coordinate"],
  reading: ["read", "review", "document", "article", "book", "digest"],
  writing: ["write", "draft", "compose", "document", "report", "blog"],
  coding: ["code", "program", "develop", "implement", "debug", "refactor"],
  review: ["review", "feedback", "check", "assess", "evaluate", "verify"],
  research: ["research", "investigate", "explore", "analyze", "study", "discover"]
};

/**
 * Analyzes a task to determine its context based on title, description, and category
 */
export function analyzeTaskContext(task: Task): TaskContextType {
  const analysisResults = Object.entries(CONTEXT_KEYWORDS).map(([context, keywords]) => {
    const text = `${task.title} ${task.description || ""} ${task.taskCategory || ""}`.toLowerCase();
    const matchCount = keywords.reduce((count, keyword) => 
      count + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    
    return {
      context: context as TaskContextType,
      confidence: matchCount / keywords.length
    };
  });
  
  // Sort by confidence and return the highest scoring context
  const bestMatch = analysisResults.sort((a, b) => b.confidence - a.confidence)[0];
  return bestMatch.context;
}

/**
 * Gets context-specific recommendations for a task
 */
export function getContextRecommendations(task: Task): TaskContextRecommendation {
  const context = analyzeTaskContext(task);
  return TASK_CONTEXT_RECOMMENDATIONS[context];
}

/**
 * Checks if a task's duration is appropriate for its context
 */
export function isTaskDurationAppropriate(task: Task): TaskDurationCheck {
  if (!task.duration) {
    return { appropriate: true };
  }
  
  const context = analyzeTaskContext(task);
  const recommendations = TASK_CONTEXT_RECOMMENDATIONS[context];
  
  if (task.duration < recommendations.minDuration) {
    return {
      appropriate: false,
      message: `This duration may be too short for a ${context} task. Consider allocating at least ${recommendations.minDuration} minutes to achieve your goals effectively.`,
      recommendation: recommendations
    };
  }
  
  if (task.duration > recommendations.maxDuration) {
    return {
      appropriate: false,
      message: `This duration may be too long for a ${context} task. Consider breaking it into smaller sessions of ${recommendations.maxDuration} minutes or less to maintain effectiveness.`,
      recommendation: recommendations
    };
  }
  
  return { appropriate: true };
}

/**
 * Suggests a break schedule for a task based on its context and duration
 */
export function suggestBreakSchedule(task: Task) {
  if (!task.duration) return null;
  
  const context = analyzeTaskContext(task);
  const recommendations = TASK_CONTEXT_RECOMMENDATIONS[context];
  
  const breakPoints = [];
  let currentTime = recommendations.idealBreakInterval;
  
  while (currentTime < task.duration) {
    breakPoints.push({
      time: currentTime,
      duration: recommendations.breakDuration
    });
    currentTime += recommendations.idealBreakInterval;
  }
  
  return breakPoints;
} 