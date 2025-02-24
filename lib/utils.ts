import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Task } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fibonacciNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55, 60, 75, 100]

export function findClosestFibonacci(num: number): number {
  return fibonacciNumbers.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev))
}

export function calculateTotalDifficulty(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + task.difficulty, 0)
}

interface GitStyleTask extends Omit<Task, 'children'> {
  parentId?: string
  children: string[] // Store child IDs as strings
}

export function formatGitStyle(tasks: GitStyleTask[]): GitStyleTask[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const rootTasks = tasks.filter((task) => !task.parentId)

  const processChildren = (task: GitStyleTask): GitStyleTask => {
    return {
      ...task,
      children: task.children
        .map((childId) => taskMap.get(childId))
        .filter((child): child is GitStyleTask => !!child)
        .map(processChildren)
        .map(child => child.id)
    }
  }

  return rootTasks.map(processChildren)
}

