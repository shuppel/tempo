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

import type { 
  TodoWorkPlan, 
  StoryBlock, 
  TimeBox, 
  TimeBoxTask,
  BaseStatus,
  TimeBoxStatus,
  TodoWorkPlanStatus
} from "@/lib/types"
import { TodoWorkPlanDB } from './workplan-db'

export class WorkPlanStorageService {
  private db: TodoWorkPlanDB

  constructor() {
    this.db = new TodoWorkPlanDB()
  }

  /**
   * Get a workplan by date.
   */
  async getWorkPlan(date: string): Promise<TodoWorkPlan | null> {
    console.log(`[WorkPlanStorageService] Getting workplan for date: ${date}`)
    
    try {
      const workplan = await this.db.findByDate(date)
      
      if (!workplan) {
        console.log(`[WorkPlanStorageService] No workplan found for date: ${date}`)
        
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WorkPlanStorageService] Creating dummy workplan for development`)
          const dummyWorkPlan = this.createDummyWorkPlan(date)
          await this.saveWorkPlan(dummyWorkPlan)
          return dummyWorkPlan
        }
        
        return null
      }
      
      console.log(`[WorkPlanStorageService] Found workplan for date: ${date} with ${workplan.storyBlocks?.length || 0} story blocks`)
      return workplan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting workplan for date: ${date}:`, error)
      return null
    }
  }

  /**
   * Get all workplans.
   */
  async getAllWorkPlans(): Promise<TodoWorkPlan[]> {
    console.log(`[WorkPlanStorageService] Getting all workplans`)
    
    try {
      const workplans = await this.db.findAllWorkPlans()
      console.log(`[WorkPlanStorageService] Found ${workplans.length} workplans`)
      return workplans
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting all workplans:`, error)
      return []
    }
  }

  /**
   * Save a workplan.
   */
  async saveWorkPlan(workplan: TodoWorkPlan): Promise<void> {
    console.log(`[WorkPlanStorageService] Saving workplan for date: ${workplan.id} with ${workplan.storyBlocks?.length || 0} story blocks`)
    
    try {
      await this.db.upsertWorkPlan(workplan)
      console.log(`[WorkPlanStorageService] Successfully saved workplan for date: ${workplan.id}`)
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error saving workplan for date: ${workplan.id}:`, error)
      throw error
    }
  }

  /**
   * Delete a workplan.
   */
  async deleteWorkPlan(date: string): Promise<void> {
    try {
      await this.db.deleteWorkPlan(date)
      console.log(`[WorkPlanStorageService] Deleted workplan for date: ${date}`)
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error deleting workplan for date: ${date}:`, error)
      throw error
    }
  }

  /**
   * Update task status.
   */
  async updateTaskStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<boolean> {
    try {
      const updatedWorkPlan = await this.db.updateTaskStatus(workplanId, storyId, timeBoxIndex, taskIndex, status)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating task status:`, error)
      return false
    }
  }

  /**
   * Update timebox status.
   */
  async updateTimeBoxStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<boolean> {
    try {
      const updatedWorkPlan = await this.db.updateTimeBoxStatus(workplanId, storyId, timeBoxIndex, status)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating timebox status:`, error)
      return false
    }
  }

  /**
   * Update timer state.
   */
  async updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    try {
      const updatedWorkPlan = await this.db.updateTimerState(workplanId, activeTimeBox, timeRemaining, isTimerRunning)
      return !!updatedWorkPlan
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error updating timer state:`, error)
      return false
    }
  }

  /**
   * Create a dummy workplan for development environments.
   */
  private createDummyWorkPlan(date: string): TodoWorkPlan {
    return {
      id: date,
      storyBlocks: [],
      status: 'planned',
      totalDuration: 0,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      activeTimeBox: null,
      timeRemaining: null,
      isTimerRunning: false
    }
  }
}
