/**
 * WorkPlanStorageService Utility Class
 * Provides a unified storage interface for workplan data management
 */

'use client';

import type { 
  TodoWorkPlan, 
  BaseStatus,
  TimeBoxStatus,
  StoryBlock
} from "@/lib/types"
import { TodoWorkPlanDB } from './workplan-db'

/**
 * Defines all possible statuses a workplan can have:
 * - planned: Initial state when created
 * - in-progress: Work has started
 * - completed: All work is done
 * - archived: Workplan is no longer active
 */
export type WorkPlanStatus = 'planned' | 'in-progress' | 'completed' | 'archived';

/**
 * Defines the structure of storage-related errors
 * - NOT_FOUND: The requested workplan doesn't exist
 * - VALIDATION_ERROR: The workplan data is invalid
 * - STORAGE_ERROR: Something went wrong with the storage system
 */
export type StorageError = {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'STORAGE_ERROR';
  message: string;
  details?: unknown;
}

/**
 * Interface defining all operations that can be performed on workplans
 * This ensures consistent functionality across different storage implementations
 */
export interface IWorkPlanStorage {
  /** Get a specific workplan by date */
  getWorkPlan(date: string): Promise<TodoWorkPlan | null>;
  
  /** Get all workplans from storage */
  getAllWorkPlans(): Promise<TodoWorkPlan[]>;
  
  /** Save or update a workplan */
  saveWorkPlan(workplan: TodoWorkPlan): Promise<void>;
  
  /** Delete a workplan permanently */
  deleteWorkPlan(date: string): Promise<void>;
  
  /** Update the status of a specific task within a workplan */
  updateTaskStatus(workplanId: string, storyId: string, timeBoxIndex: number, taskIndex: number, status: BaseStatus): Promise<boolean>;
  
  /** Update the status of a time box within a workplan */
  updateTimeBoxStatus(workplanId: string, storyId: string, timeBoxIndex: number, status: TimeBoxStatus): Promise<boolean>;
  
  /** Update the timer state for a workplan */
  updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean>;
}

/** Valid statuses for tasks and time boxes */
const VALID_BASE_STATUSES: BaseStatus[] = ['todo', 'completed', 'in-progress', 'mitigated']

/** Valid statuses for workplans - exported for use in other components */
export const VALID_WORKPLAN_STATUSES = ['planned', 'in-progress', 'completed', 'archived'] as const

/** Constants for storage prefixes */
const WORKPLAN_PREFIX = 'workplan-'
const LEGACY_WORKPLAN_PREFIX = 'todo_workplans-todo_workplans-'

export class WorkPlanStorageService implements IWorkPlanStorage {
  private db: TodoWorkPlanDB;
  private isDestroyed = false;

  constructor() {
    this.db = new TodoWorkPlanDB();
  }

  private checkDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('WorkPlanStorageService has been destroyed');
    }
  }

  private validateWorkPlan(workplan: TodoWorkPlan): { isValid: boolean; error?: StorageError } {
    console.log(`[WorkPlanStorageService] Validating workplan:`, {
      id: workplan.id,
      status: workplan.status,
      storyBlockCount: workplan.storyBlocks?.length || 0
    });

    if (!workplan.id) {
      console.error('[WorkPlanStorageService] Validation failed: Missing workplan ID');
      return { 
        isValid: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Workplan ID is required' 
        } 
      };
    }

    if (!workplan.status) {
      console.log(`[WorkPlanStorageService] Setting default 'planned' status for workplan ${workplan.id}`);
      workplan.status = 'planned';
    } else if (!VALID_WORKPLAN_STATUSES.includes(workplan.status)) {
      console.error(`[WorkPlanStorageService] Validation failed: Invalid status "${workplan.status}" for workplan ${workplan.id}`);
      return { 
        isValid: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid workplan status. Must be one of: ${VALID_WORKPLAN_STATUSES.join(', ')}` 
        } 
      };
    }

    // Ensure storyBlocks is an array and has at least one story block
    if (!Array.isArray(workplan.storyBlocks) || workplan.storyBlocks.length === 0) {
      console.log(`[WorkPlanStorageService] Adding default story block for workplan ${workplan.id}`);
      const defaultTimeBox = {
        type: 'work' as const,
        duration: 25,
        status: 'todo' as const,
        tasks: [{
          title: 'New Task',
          status: 'todo' as const,
          duration: 25
        }]
      };
      
      workplan.storyBlocks = [{
        id: `story-${Date.now()}`,
        title: 'Default Story',
        timeBoxes: [defaultTimeBox],
        totalDuration: defaultTimeBox.duration,
        progress: 0,
        taskIds: []
      }];
    }

    if (!this.validateDates(workplan.startTime, workplan.endTime)) {
      console.error(`[WorkPlanStorageService] Validation failed: Invalid dates for workplan ${workplan.id}`, {
        startTime: workplan.startTime,
        endTime: workplan.endTime
      });
      return { 
        isValid: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Invalid start or end time' 
        } 
      };
    }

    const storyBlocksValidation = this.validateStoryBlocks(workplan.storyBlocks);
    if (!storyBlocksValidation.isValid) {
      console.error(`[WorkPlanStorageService] Story blocks validation failed for workplan ${workplan.id}:`, storyBlocksValidation.error);
      return storyBlocksValidation;
    }

    console.log(`[WorkPlanStorageService] Workplan ${workplan.id} validation successful`);
    return { isValid: true };
  }

  private validateStoryBlocks(storyBlocks: StoryBlock[]): { isValid: boolean; error?: StorageError } {
    console.log(`[WorkPlanStorageService] Validating ${storyBlocks.length} story blocks`);

    for (const block of storyBlocks) {
      console.log(`[WorkPlanStorageService] Validating story block:`, {
        id: block.id,
        title: block.title,
        timeBoxCount: block.timeBoxes?.length || 0
      });

      if (!block.id || !block.title || !Array.isArray(block.timeBoxes)) {
        console.error('[WorkPlanStorageService] Story block validation failed:', {
          hasId: Boolean(block.id),
          hasTitle: Boolean(block.title),
          hasTimeBoxes: Array.isArray(block.timeBoxes)
        });
        return { 
          isValid: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid story block structure' 
          } 
        };
      }

      for (const box of block.timeBoxes) {
        console.log(`[WorkPlanStorageService] Validating time box in story "${block.title}":`, {
          type: box.type,
          duration: box.duration,
          status: box.status,
          taskCount: box.tasks?.length || 0
        });

        if (!box.type || !box.duration) {
          console.error('[WorkPlanStorageService] Time box validation failed:', {
            hasType: Boolean(box.type),
            hasDuration: Boolean(box.duration)
          });
          return { 
            isValid: false, 
            error: { 
              code: 'VALIDATION_ERROR', 
              message: 'Invalid time box structure' 
            } 
          };
        }

        if (box.status && !this.validateTimeBoxStatus(box.status)) {
          console.error(`[WorkPlanStorageService] Invalid time box status "${box.status}" in story "${block.title}"`);
          return { 
            isValid: false, 
            error: { 
              code: 'VALIDATION_ERROR', 
              message: `Invalid time box status. Must be one of: ${VALID_BASE_STATUSES.join(', ')}` 
            } 
          };
        }
      }
    }

    console.log('[WorkPlanStorageService] Story blocks validation successful');
    return { isValid: true };
  }

  private validateDates(startTime: string, endTime: string): boolean {
    if (!startTime || !endTime) {
      return false;
    }
    
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
    } catch {
      return false;
    }
  }

  private validateBaseStatus(status: BaseStatus): boolean {
    return VALID_BASE_STATUSES.includes(status);
  }

  private validateTimeBoxStatus(status: TimeBoxStatus): boolean {
    return VALID_BASE_STATUSES.includes(status);
  }

  private validateTimerState(
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): boolean {
    if (typeof isTimerRunning !== 'boolean') {
      return false;
    }

    if (activeTimeBox) {
      if (!activeTimeBox.storyId || typeof activeTimeBox.timeBoxIndex !== 'number') {
        return false;
      }
    }

    if (timeRemaining !== null) {
      if (typeof timeRemaining !== 'number' || timeRemaining < 0) {
        return false;
      }
    }

    return true;
  }

  async getWorkPlan(date: string): Promise<TodoWorkPlan | null> {
    this.checkDestroyed();
    try {
      return await this.db.findByDate(date);
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting workplan for date: ${date}:`, error);
      throw {
        code: 'STORAGE_ERROR',
        message: 'Failed to retrieve workplan',
        details: error
      };
    }
  }

  /**
   * Helper method to get workplans with a specific prefix from localStorage
   * @param prefix - The prefix to search for
   * @returns Array of workplans found with this prefix
   */
  private async getWithPrefix(prefix: string): Promise<TodoWorkPlan[]> {
    try {
      console.log(`[WorkPlanStorageService] Searching for workplans with prefix: ${prefix}`);
      // Get all keys from localStorage that match the prefix
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
      console.log(`[WorkPlanStorageService] Found ${keys.length} keys with prefix ${prefix}:`, keys);
      
      // Map keys to workplans
      const workplans = await Promise.all(keys.map(async key => {
        const id = key.replace(prefix, '');
        try {
          const data = localStorage.getItem(key);
          if (!data) return null;
          
          const workplan = JSON.parse(data);
          // Normalize the workplan data
          const normalizedWorkplan = {
            ...workplan,
            // Ensure required fields exist
            id: workplan.id || id,
            status: workplan.status || 'planned',
            storyBlocks: Array.isArray(workplan.storyBlocks) && workplan.storyBlocks.length > 0 
              ? workplan.storyBlocks 
              : [{
                  id: `story-${Date.now()}`,
                  title: 'Default Story',
                  timeBoxes: [{
                    type: 'work',
                    duration: 25,
                    status: 'todo',
                    tasks: [{
                      id: `task-${Date.now()}`,
                      title: 'New Task',
                      status: 'todo'
                    }]
                  }]
                }],
            lastUpdated: workplan.lastUpdated || new Date().toISOString(),
            startTime: workplan.startTime || new Date().toISOString(),
            endTime: workplan.endTime || new Date().toISOString(),
            totalDuration: workplan.totalDuration || 0,
            activeTimeBox: workplan.activeTimeBox || null,
            timeRemaining: workplan.timeRemaining || null,
            isTimerRunning: workplan.isTimerRunning || false
          };
          return normalizedWorkplan;
        } catch (error) {
          console.error(`[WorkPlanStorageService] Error parsing workplan for key ${key}:`, error);
          return null;
        }
      }));
      
      // Filter out null values and validate workplans
      return workplans.filter((wp): wp is TodoWorkPlan => {
        if (!wp) return false;
        const validation = this.validateWorkPlan(wp);
        if (!validation.isValid) {
          console.log(`[WorkPlanStorageService] Workplan ${wp.id} failed validation:`, validation.error);
        }
        return validation.isValid;
      });
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error getting workplans with prefix ${prefix}:`, error);
      return [];
    }
  }

  async getAllWorkPlans(): Promise<TodoWorkPlan[]> {
    this.checkDestroyed();
    try {
      console.log('[WorkPlanStorageService] Starting getAllWorkPlans...');
      
      // Get workplans from both prefixes
      const regularWorkplans = await this.getWithPrefix(WORKPLAN_PREFIX);
      console.log(`[WorkPlanStorageService] Found ${regularWorkplans.length} regular workplans`);
      
      const legacyWorkplans = await this.getWithPrefix(LEGACY_WORKPLAN_PREFIX);
      console.log(`[WorkPlanStorageService] Found ${legacyWorkplans.length} legacy workplans`);
      
      // Combine and deduplicate workplans based on ID
      const allWorkplans = [...regularWorkplans, ...legacyWorkplans];
      const uniqueWorkplans = Array.from(
        new Map(allWorkplans.map(wp => [wp.id, wp])).values()
      );
      
      console.log(`[WorkPlanStorageService] Total unique workplans: ${uniqueWorkplans.length}`);
      
      // Log detailed workplan validation info
      uniqueWorkplans.forEach(wp => {
        console.log(`[WorkPlanStorageService] Workplan ${wp.id} validation:`, {
          id: wp.id,
          status: wp.status,
          hasStatus: Boolean(wp.status),
          startTime: wp.startTime,
          endTime: wp.endTime,
          storyBlockCount: wp.storyBlocks?.length || 0,
          storyBlocks: wp.storyBlocks?.map(story => ({
            id: story.id,
            title: story.title,
            timeBoxCount: story.timeBoxes?.length || 0,
            timeBoxes: story.timeBoxes?.map(box => ({
              type: box.type,
              status: box.status,
              taskCount: box.tasks?.length || 0
            }))
          }))
        });
      });

      return uniqueWorkplans;
    } catch (error) {
      console.error('[WorkPlanStorageService] Error getting all workplans:', error);
      throw {
        code: 'STORAGE_ERROR',
        message: 'Failed to retrieve workplans',
        details: error
      };
    }
  }

  async saveWorkPlan(workplan: TodoWorkPlan): Promise<void> {
    this.checkDestroyed();
    const validation = this.validateWorkPlan(workplan);
    if (!validation.isValid) {
      throw validation.error;
    }

    try {
      await this.db.upsertWorkPlan(workplan);
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error saving workplan for date: ${workplan.id}:`, error);
      throw {
        code: 'STORAGE_ERROR',
        message: 'Failed to save workplan',
        details: error
      };
    }
  }

  async deleteWorkPlan(date: string): Promise<void> {
    this.checkDestroyed();
    try {
      await this.db.deleteWorkPlan(date);
    } catch (error) {
      console.error(`[WorkPlanStorageService] Error deleting workplan for date: ${date}:`, error);
      throw {
        code: 'STORAGE_ERROR',
        message: 'Failed to delete workplan',
        details: error
      };
    }
  }

  async updateTaskStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<boolean> {
    this.checkDestroyed();
    if (!this.validateBaseStatus(status)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: `Invalid task status. Must be one of: ${VALID_BASE_STATUSES.join(', ')}`
      };
    }

    const workplan = await this.getWorkPlan(workplanId);
    if (!workplan) {
      throw {
        code: 'NOT_FOUND',
        message: 'Workplan not found'
      };
    }

    // Update task status and recalculate progress
    const updatedWorkplan = this.updateWorkplanTaskStatus(workplan, storyId, timeBoxIndex, taskIndex, status);
    await this.saveWorkPlan(updatedWorkplan);
    return true;
  }

  async updateTimeBoxStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<boolean> {
    this.checkDestroyed();
    if (!this.validateTimeBoxStatus(status)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: `Invalid timebox status. Must be one of: ${VALID_BASE_STATUSES.join(', ')}`
      };
    }

    const workplan = await this.getWorkPlan(workplanId);
    if (!workplan) {
      throw {
        code: 'NOT_FOUND',
        message: 'Workplan not found'
      };
    }

    // Update timebox status and recalculate progress
    const updatedWorkplan = this.updateWorkplanTimeBoxStatus(workplan, storyId, timeBoxIndex, status);
    await this.saveWorkPlan(updatedWorkplan);
    return true;
  }

  async updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    this.checkDestroyed();
    
    if (!this.validateTimerState(activeTimeBox, timeRemaining, isTimerRunning)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'Invalid timer state'
      };
    }

    const workplan = await this.getWorkPlan(workplanId);
    if (!workplan) {
      throw {
        code: 'NOT_FOUND',
        message: 'Workplan not found'
      };
    }

    // Update the workplan with timer state
    const updatedWorkplan = {
      ...workplan,
      timerState: {
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      }
    };

    await this.saveWorkPlan(updatedWorkplan);
    return true;
  }

  private updateWorkplanTaskStatus(
    workplan: TodoWorkPlan,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): TodoWorkPlan {
    const updatedStoryBlocks = workplan.storyBlocks.map(story => {
      if (story.id !== storyId) return story;

      const timeBox = story.timeBoxes[timeBoxIndex];
      if (!timeBox?.tasks) return story;

      const updatedTasks = [...timeBox.tasks];
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status };

      // Update timebox status based on tasks
      const activeTasks = updatedTasks.filter(task => task.status !== 'mitigated');
      const timeBoxStatus = this.calculateTimeBoxStatus(activeTasks);

      const updatedTimeBoxes = [...story.timeBoxes];
      updatedTimeBoxes[timeBoxIndex] = {
        ...timeBox,
        tasks: updatedTasks,
        status: timeBoxStatus
      };

      return {
        ...story,
        timeBoxes: updatedTimeBoxes,
        progress: this.calculateStoryProgress(updatedTimeBoxes)
      };
    });

    return {
      ...workplan,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateWorkplanStatus(updatedStoryBlocks)
    };
  }

  private updateWorkplanTimeBoxStatus(
    workplan: TodoWorkPlan,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): TodoWorkPlan {
    const updatedStoryBlocks = workplan.storyBlocks.map(story => {
      if (story.id !== storyId) return story;

      const updatedTimeBoxes = [...story.timeBoxes];
      const timeBox = updatedTimeBoxes[timeBoxIndex];
      if (!timeBox) return story;

      // Update tasks if timebox is completed
      const updatedTasks = timeBox.tasks?.map(task => ({
        ...task,
        status: status === 'completed' ? 'completed' as const : task.status
      }));

      updatedTimeBoxes[timeBoxIndex] = {
        ...timeBox,
        status,
        tasks: updatedTasks
      };

      return {
        ...story,
        timeBoxes: updatedTimeBoxes,
        progress: this.calculateStoryProgress(updatedTimeBoxes)
      };
    });

    return {
      ...workplan,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateWorkplanStatus(updatedStoryBlocks)
    };
  }

  private calculateTimeBoxStatus(tasks: { status?: BaseStatus }[]): TimeBoxStatus {
    if (tasks.length === 0) return 'todo';
    const validTasks = tasks.filter(task => task.status !== undefined);
    if (validTasks.length === 0) return 'todo';
    if (validTasks.every(task => task.status === 'completed')) return 'completed';
    if (validTasks.some(task => task.status === 'completed')) return 'in-progress';
    return 'todo';
  }

  private calculateStoryProgress(timeBoxes: { type: string; status?: TimeBoxStatus }[]): number {
    const workBoxes = timeBoxes.filter(box => box.type === 'work' && box.status !== undefined);
    const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed');
    return workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0;
  }

  private calculateWorkplanStatus(storyBlocks: StoryBlock[]): WorkPlanStatus {
    const allWorkBoxes = storyBlocks.flatMap(story => 
      story.timeBoxes.filter(box => box.type === 'work' && box.status !== undefined)
    );
    
    if (allWorkBoxes.length === 0) return 'planned';
    if (allWorkBoxes.every(box => box.status === 'completed')) return 'completed';
    if (allWorkBoxes.some(box => box.status === 'completed' || box.status === 'in-progress')) return 'in-progress';
    return 'planned';
  }

  destroy(): void {
    if (this.isDestroyed) return;
    // No need to call destroy on localStorage-based DB
    this.isDestroyed = true;
  }
}
