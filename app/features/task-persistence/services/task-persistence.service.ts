import { nanoid } from "nanoid";
import type { Task } from "@/lib/types";

const STORAGE_KEY = "tempo_tasks";

interface StoredTask extends Omit<Task, "lastUpdated"> {
  lastUpdated: string;
}

export class TaskPersistenceService {
  /**
   * Save tasks to persistent storage
   */
  static async saveTasks(tasks: Task[]): Promise<void> {
    try {
      const now = new Date().toISOString();
      const tasksWithIds = tasks.map((task) => ({
        ...task,
        id: task.id || nanoid(),
        lastUpdated: now,
      })) as StoredTask[];

      // Get existing tasks
      const existingTasks = await this.getTasks();

      // Create a map of existing tasks by ID for quick lookup
      const existingTaskMap = new Map(
        existingTasks.map((task) => [task.id, task]),
      );

      // Merge new tasks with existing ones, updating if they exist
      const mergedTasks = tasksWithIds.map((task) => {
        const existingTask = existingTaskMap.get(task.id);
        if (existingTask) {
          return {
            ...existingTask,
            ...task,
            lastUpdated: now,
          } as StoredTask;
        }
        return task;
      });

      // Add any existing tasks that weren't in the new set
      existingTasks.forEach((task) => {
        if (!tasksWithIds.some((newTask) => newTask.id === task.id)) {
          mergedTasks.push({
            ...task,
            lastUpdated: task.lastUpdated || now,
          } as StoredTask);
        }
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedTasks));
    } catch (error) {
      console.error("Error saving tasks:", error);
      throw new Error("Failed to save tasks");
    }
  }

  /**
   * Retrieve tasks from persistent storage
   */
  static async getTasks(): Promise<Task[]> {
    try {
      const tasksJson = localStorage.getItem(STORAGE_KEY);
      if (!tasksJson) return [];
      const storedTasks = JSON.parse(tasksJson) as StoredTask[];
      return storedTasks.map((task) => ({
        ...task,
        lastUpdated: task.lastUpdated,
      }));
    } catch (error) {
      console.error("Error retrieving tasks:", error);
      throw new Error("Failed to retrieve tasks");
    }
  }

  /**
   * Update a specific task
   */
  static async updateTask(
    taskId: string,
    updates: Partial<Task>,
  ): Promise<Task> {
    const tasks = await this.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      throw new Error("Task not found");
    }

    const updatedTask = {
      ...tasks[taskIndex],
      ...updates,
      lastUpdated: new Date().toISOString(),
    } as StoredTask;

    tasks[taskIndex] = updatedTask;
    await this.saveTasks(tasks);
    return updatedTask;
  }

  /**
   * Delete a specific task
   */
  static async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getTasks();
    const filteredTasks = tasks.filter((t) => t.id !== taskId);
    await this.saveTasks(filteredTasks);
  }

  /**
   * Clear all tasks from storage
   */
  static async clearTasks(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing tasks:", error);
      throw new Error("Failed to clear tasks");
    }
  }

  /**
   * Get tasks by status
   */
  static async getTasksByStatus(status: "todo" | "completed"): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((task) => task.status === status);
  }

  /**
   * Get tasks by date range
   */
  static async getTasksByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Task[]> {
    const tasks = await this.getTasks();
    return tasks.filter((task) => {
      if (!task.lastUpdated) return false;
      const taskDate = new Date(task.lastUpdated);
      return taskDate >= startDate && taskDate <= endDate;
    });
  }
}
