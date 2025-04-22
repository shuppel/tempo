import type { Task, TaskGroup, DifficultyLevel } from "./types";
import { calculateTotalDifficulty } from "./utils";

const DURATION_RULES = {
  SPLIT_THRESHOLD: 60,
  MIN_DURATION: 20,
  MAX_SINGLE_DURATION: 60,
} as const;

export interface AITaskGroup {
  id: string;
  tasks: string[];
  name: string;
  estimatedDuration?: number;
}

export async function refineTask(taskInput: string): Promise<Partial<Task>> {
  const response = await fetch("/api/ai/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "refineTask",
      data: { taskInput },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to refine task");
  }

  if (!data.content) {
    throw new Error("No content received from AI");
  }

  const refined = JSON.parse(data.content);
  const duration = refined.duration || 0;

  // Convert numeric difficulty to DifficultyLevel
  let difficultyLevel: DifficultyLevel = "medium";
  const numericDifficulty = refined.difficulty ? Number(refined.difficulty) : 0;

  if (numericDifficulty >= 75) {
    difficultyLevel = "high";
  } else if (numericDifficulty >= 30) {
    difficultyLevel = "medium";
  } else {
    difficultyLevel = "low";
  }

  return {
    ...refined,
    difficulty: difficultyLevel,
    needsSplitting: duration > DURATION_RULES.SPLIT_THRESHOLD,
    duration: Math.max(duration, DURATION_RULES.MIN_DURATION), // Ensure minimum duration
  };
}

export async function organizeTaskGroups(tasks: Task[]): Promise<TaskGroup[]> {
  const response = await fetch("/api/ai/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "organizeTasks",
      data: {
        tasks,
        durationRules: DURATION_RULES, // Pass duration rules to AI
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to organize tasks");
  }

  if (!data.content) {
    throw new Error("No content received from AI");
  }

  const groups = JSON.parse(data.content);

  // Calculate total difficulty and duration for each group
  return groups.map((group: AITaskGroup) => {
    const groupTasks = tasks.filter((task) => group.tasks.includes(task.id));
    return {
      id: group.id,
      tasks: group.tasks,
      totalDifficulty: calculateTotalDifficulty(groupTasks),
      completed: false,
      estimatedDuration:
        group.estimatedDuration ||
        groupTasks.reduce((sum, task) => sum + task.duration, 0),
    };
  });
}
