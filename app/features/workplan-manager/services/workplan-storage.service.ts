/**
 * WorkPlanStorageService Utility Class
 *
 * This utility class provides a higher-level interface for managing workplan data
 * using an underlying WorkPlanDB instance. It encapsulates CRUD operations for workplans,
 * along with methods to update task and timebox statuses, manage timer state persistence,
 * and normalize workplan data. Key features include:
 *
 * - Retrieving, saving, and deleting workplans by date.
 * - Updating individual task and timebox statuses while recalculating overall progress.
 * - Persisting and retrieving timer state (active timebox, time remaining, and timer status).
 * - Normalizing workplan objects to ensure a consistent data structure.
 * - Creating a dummy workplan for development environments when no workplan is found.
 *
 * All workplan keys are formatted using a consistent date format (YYYY-MM-DD) with a common prefix.
 */

'use client';

import type { 
  TodoWorkPlan, 
  BaseStatus,
  TimeBoxStatus,
  StoryBlock
} from "@/lib/types"
import { TodoWorkPlanDB } from './workplan-db'

const VALID_BASE_STATUSES: BaseStatus[] = ['todo', 'completed', 'in-progress', 'mitigated']
const VALID_WORKPLAN_STATUSES = ['planned', 'in-progress', 'completed', 'archived']

export class WorkPlanStorageService {
  private db: TodoWorkPlanDB
  private isDestroyed = false

  constructor() {
    this.db = new TodoWorkPlanDB()
  }

  private validateWorkPlan(workplan: TodoWorkPlan): boolean {
    if (!workplan.id || !workplan.status || !workplan.storyBlocks) {
      return false
    }

    if (!VALID_WORKPLAN_STATUSES.includes(workplan.status)) {
      return false
    }

    if (!Array.isArray(workplan.storyBlocks) || workplan.storyBlocks.length === 0) {
      return false
    }

    if (!this.validateStoryBlocks(workplan.storyBlocks)) {
      return false
    }

    if (!this.validateDates(workplan.startTime, workplan.endTime)) {
      return false
    }

    return true
  }

  private validateStoryBlocks(storyBlocks: StoryBlock[]): boolean {
    return storyBlocks.every(block => {
      if (!block.id || !block.title || !block.timeBoxes) {
        return false
      }

      if (!Array.isArray(block.timeBoxes)) {
        return false
      }

      return block.timeBoxes.every(box => {
        if (!box.type || !box.duration) {
          return false
        }

        if (box.tasks && !Array.isArray(box.tasks)) {
          return false
        }

        if (box.status && !this.validateTimeBoxStatus(box.status)) {
          return false
        }

        return true
      })
    })
  }

  private validateDates(startTime: string, endTime: string): boolean {
    try {
      const start = new Date(startTime)
      const end = new Date(endTime)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return false
      }

      return start <= end
    } catch {
      return false
    }
  }

  private validateBaseStatus(status: BaseStatus): boolean {
    if (!status) {
      return false
    }
    return VALID_BASE_STATUSES.includes(status)
  }

  private validateTimeBoxStatus(status: TimeBoxStatus): boolean {
    if (!status) {
      return false
    }
    return VALID_BASE_STATUSES.includes(status)
  }

  private validateTimerState(
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): boolean {
    if (typeof isTimerRunning !== 'boolean') {
      return false
    }

    if (activeTimeBox) {
      if (!activeTimeBox.storyId || typeof activeTimeBox.timeBoxIndex !== 'number') {
        return false
      }
    }

    if (timeRemaining !== null) {
      if (typeof timeRemaining !== 'number' || timeRemaining < 0) {
        return false
      }
    }

    return true
  }

  private checkDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('Service has been destroyed')
    }
  }

  async getWorkPlan(date: string): Promise<TodoWorkPlan | null> {
    this.checkDestroyed()
    try {
      return await this.db.findByDate(date)
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting workplan for date: ${date}:`, error)
      return null
    }
  }

  async getAllWorkPlans(): Promise<TodoWorkPlan[]> {
    this.checkDestroyed()
    try {
      return await this.db.findAllWorkPlans()
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting all workplans:`, error)
      return []
    }
  }

  async saveWorkPlan(workplan: TodoWorkPlan): Promise<void> {
    this.checkDestroyed()
    if (!this.validateWorkPlan(workplan)) {
      throw new Error('Invalid workplan')
    }

    try {
      await this.db.upsertWorkPlan(workplan)
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error saving workplan for date: ${workplan.id}:`, error)
      throw error
    }
  }

  async deleteWorkPlan(date: string): Promise<void> {
    this.checkDestroyed()
    try {
      await this.db.deleteWorkPlan(date)
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error deleting workplan for date: ${date}:`, error)
      throw error
    }
  }

  async updateTaskStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<boolean> {
    this.checkDestroyed()
    if (!this.validateBaseStatus(status)) {
      return false
    }

    try {
      const updatedWorkPlan = await this.db.updateTaskStatus(workplanId, storyId, timeBoxIndex, taskIndex, status)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating task status:`, error)
      return false
    }
  }

  async updateTimeBoxStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<boolean> {
    this.checkDestroyed()
    if (!this.validateTimeBoxStatus(status)) {
      return false
    }

    try {
      const updatedWorkPlan = await this.db.updateTimeBoxStatus(workplanId, storyId, timeBoxIndex, status)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating timebox status:`, error)
      return false
    }
  }

  async updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    this.checkDestroyed()
    if (!this.validateTimerState(activeTimeBox, timeRemaining, isTimerRunning)) {
      return false
    }

    try {
      const updatedWorkPlan = await this.db.updateTimerState(workplanId, activeTimeBox, timeRemaining, isTimerRunning)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating timer state:`, error)
      return false
    }
  }

  destroy(): void {
    if (this.isDestroyed) {
      return
    }
    this.db.destroy()
    this.isDestroyed = true
  }
}
