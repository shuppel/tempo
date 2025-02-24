import type { Task, TaskGroup, ProcessedTask } from "./types"
import { findClosestFibonacci } from "./utils"

const DURATION_RULES = {
  SPLIT_THRESHOLD: 60,
  MIN_DURATION: 20,
  MAX_SINGLE_DURATION: 60
} as const

export interface AITaskGroup {
  id: string
  tasks: string[]
  name: string
  estimatedDuration?: number
}

export async function refineTask(taskInput: string): Promise<Partial<Task>> {
  const response = await fetch('/api/ai/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'refineTask',
      data: { taskInput }
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to refine task');
  }

  if (!data.content) {
    throw new Error('No content received from AI');
  }

  const refined = JSON.parse(data.content);
  const duration = refined.duration || 0;

  return {
    ...refined,
    difficulty: findClosestFibonacci(refined.difficulty),
    needsSplitting: duration > DURATION_RULES.SPLIT_THRESHOLD,
    duration: Math.max(duration, DURATION_RULES.MIN_DURATION) // Ensure minimum duration
  }
}

export async function organizeTaskGroups(tasks: Task[]): Promise<TaskGroup[]> {
  const response = await fetch('/api/ai/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'organizeTasks',
      data: { 
        tasks,
        durationRules: DURATION_RULES // Pass duration rules to AI
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to organize tasks');
  }

  if (!data.content) {
    throw new Error('No content received from AI');
  }

  const groups = JSON.parse(data.content);
  
  // Calculate total duration and difficulty for each group
  return groups.map((group: AITaskGroup) => ({
    id: group.id,
    tasks: group.tasks,
    totalDifficulty: tasks
      .filter(task => group.tasks.includes(task.id))
      .reduce((sum, task) => sum + task.difficulty, 0),
    completed: false,
    estimatedDuration: group.estimatedDuration || tasks
      .filter(task => group.tasks.includes(task.id))
      .reduce((sum, task) => sum + task.duration, 0)
  }));
}

