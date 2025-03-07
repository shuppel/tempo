/**
 * TodoWorkPlanDB
 * 
 * A simple database service for managing WorkPlans using browser localStorage.
 *
 * Main Functions:
 * - Find a single workplan by date.
 * - Find all stored workplans.
 * - Save or update (upsert) a workplan.
 * - Delete a workplan by date.
 * - Update task or timebox statuses within workplans.
 */

'use client';

import type { 
  TodoWorkPlan, 
  TimeBoxStatus,
  BaseStatus
} from "@/lib/types"

// Storage key prefix for localStorage
const WORKPLAN_STORAGE_PREFIX = 'todo_workplans-todo_workplans-';

export class TodoWorkPlanDB {

  /** Retrieve a workplan by its date identifier. */
  async findByDate(date: string): Promise<TodoWorkPlan | null> {
    const key = `${WORKPLAN_STORAGE_PREFIX}${date}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  /** Retrieve all stored workplans. */
  async findAllWorkPlans(): Promise<TodoWorkPlan[]> {
    const workplans: TodoWorkPlan[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(WORKPLAN_STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) workplans.push(JSON.parse(data));
      }
    }

    return workplans;
  }

  /** Save or update a workplan entry. */
  async upsertWorkPlan(workplan: TodoWorkPlan): Promise<TodoWorkPlan> {
    const key = `${WORKPLAN_STORAGE_PREFIX}${workplan.id}`;
    const updatedWorkplan = {
      ...workplan,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(updatedWorkplan));
    return updatedWorkplan;
  }

  /** Delete a workplan by its date identifier. */
  async deleteWorkPlan(date: string): Promise<void> {
    const key = `${WORKPLAN_STORAGE_PREFIX}${date}`;
    localStorage.removeItem(key);
  }

  /** Update the status of a specific task within a timebox. */
  async updateTaskStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<TodoWorkPlan | null> {

    const workplan = await this.findByDate(workplanId);
    if (!workplan) return null;

    const storyBlock = workplan.storyBlocks.find(story => story.id === storyId);
    if (!storyBlock) return null;

    const timeBox = storyBlock.timeBoxes[timeBoxIndex];
    if (!timeBox?.tasks) return null;

    const task = timeBox.tasks[taskIndex];
    if (!task) return null;

    task.status = status;

    return this.upsertWorkPlan(workplan);
  }

  /** Update the status of a specific timebox within a story block. */
  async updateTimeBoxStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<TodoWorkPlan | null> {

    const workplan = await this.findByDate(workplanId);
    if (!workplan) return null;

    const storyBlock = workplan.storyBlocks.find(story => story.id === storyId);
    if (!storyBlock) return null;

    const timeBox = storyBlock.timeBoxes[timeBoxIndex];
    if (!timeBox) return null;

    timeBox.status = status;

    return this.upsertWorkPlan(workplan);
  }

  /** Update timer state metadata within a workplan. */
  async updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<TodoWorkPlan | null> {

    const workplan = await this.findByDate(workplanId);
    if (!workplan) return null;

    workplan.activeTimeBox = activeTimeBox;
    workplan.timeRemaining = timeRemaining;
    workplan.isTimerRunning = isTimerRunning;

    return this.upsertWorkPlan(workplan);
  }
}
