/**
 * WorkPlan Storage Utility Library
 *
 * This module provides helper functions and interfaces for managing workplan data
 * in localStorage. It is part of the utility/lib layer and is responsible for:
 *
 * - Persisting workplan data (including workplan plans, timer state, and progress updates)
 *   using a consistent key prefix.
 * - Providing CRUD operations for workplans:
 *   - saveWorkPlan: Save or update a workplan with a lastUpdated timestamp.
 *   - getWorkPlan: Retrieve and validate a workplan.
 *   - getAllWorkPlans: Retrieve all workplans stored in localStorage.
 *   - deleteWorkPlan: Delete a specific workplan.
 *   - clearAllWorkPlans: Remove all workplans from localStorage.
 *
 * - Updating workplan progress and statuses by modifying time boxes and tasks:
 *   - updateTimeBoxStatus: Update the status of a time box and recalculate story progress.
 *   - updateTaskStatus: Update the status of an individual task within a time box.
 *   - updateWorkPlanProgress: Recalculate overall progress for a workplan.
 *
 * - Handling timer state persistence:
 *   - getTimerState: Retrieve the timer state either from the workplan or separately.
 *   - saveTimerState: Save the current timer state.
 *
 * - Validating and normalizing workplan data:
 *   - isValidWorkPlan: Validate that an object conforms to the StoredWorkPlan interface.
 *   - normalizeWorkPlan: Ensure that workplan data is complete and follows a consistent format.
 *
 * The StoredWorkPlan interface extends a basic WorkPlan with additional fields for
 * status, timer persistence, and metadata tracking.
 */

import type { WorkPlan, TimeBox, TimeBoxTask, StoryBlock, WorkPlanStatus, TimeBoxType, BaseStatus } from "./types"

export interface StoredWorkPlan extends WorkPlan {
  totalWorkPlans: number
  startTime: string
  endTime: string
  status?: WorkPlanStatus
  lastUpdated?: string // Add to track when workplan was last updated
  // Timer state persistence
  activeTimeBox?: { storyId: string; timeBoxIndex: number } | null
  timeRemaining?: number | null
  isTimerRunning?: boolean
}

const WORKPLAN_PREFIX = 'workplan-'

export const workplanStorage = {
  /**
   * Save a workplan to localStorage
   */
  saveWorkPlan(date: string, workplan: StoredWorkPlan): void {
    try {
      // Always update lastUpdated timestamp when saving
      const updatedWorkPlan = {
        ...workplan,
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(`${WORKPLAN_PREFIX}${date}`, JSON.stringify(updatedWorkPlan))
    } catch (error) {
      console.error('Failed to save workplan:', error)
    }
  },

  /**
   * Get a specific workplan from localStorage
   */
  getWorkPlan(date: string): StoredWorkPlan | null {
    try {
      const data = localStorage.getItem(`${WORKPLAN_PREFIX}${date}`)
      if (!data) return null

      const workplan = JSON.parse(data)
      if (this.isValidWorkPlan(workplan)) {
        return this.normalizeWorkPlan(workplan)
      }
      return null
    } catch (error) {
      console.error('Failed to get workplan:', error)
      return null
    }
  },

  /**
   * Get all workplans from localStorage
   */
  getAllWorkPlans(): Record<string, StoredWorkPlan> {
    const workplans: Record<string, StoredWorkPlan> = {}
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(WORKPLAN_PREFIX)) {
          const date = key.replace(WORKPLAN_PREFIX, '')
          const workplan = this.getWorkPlan(date)
          if (workplan) {
            workplans[date] = workplan
          }
        }
      }
    } catch (error) {
      console.error('Failed to get all workplans:', error)
    }

    return workplans
  },

  /**
   * Delete a workplan from localStorage
   */
  deleteWorkPlan(date: string): void {
    try {
      localStorage.removeItem(`${WORKPLAN_PREFIX}${date}`)
    } catch (error) {
      console.error('Failed to delete workplan:', error)
    }
  },

  /**
   * Clear all workplans from localStorage
   */
  clearAllWorkPlans(): void {
    try {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(WORKPLAN_PREFIX)) {
          keys.push(key)
        }
      }
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear workplans:', error)
    }
  },

  /**
   * Update the completion status of a specific timebox in a workplan
   */
  updateTimeBoxStatus(date: string, storyId: string, timeBoxIndex: number, status: "todo" | "completed" | "in-progress"): boolean {
    const workplan = this.getWorkPlan(date)
    if (!workplan) return false

    let updated = false
    const updatedStoryBlocks = workplan.storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        updated = true
        const updatedTimeBoxes = [...story.timeBoxes]
        
        // Update the timebox status
        updatedTimeBoxes[timeBoxIndex] = {
          ...updatedTimeBoxes[timeBoxIndex],
          status
        }
        
        // If marking as completed, mark all tasks as completed
        if (status === 'completed' && updatedTimeBoxes[timeBoxIndex].tasks) {
          updatedTimeBoxes[timeBoxIndex].tasks = updatedTimeBoxes[timeBoxIndex].tasks.map(task => ({
            ...task,
            status: 'completed'
          }))
        }
        
        // If marking as todo, mark all tasks as todo
        if (status === 'todo' && updatedTimeBoxes[timeBoxIndex].tasks) {
          updatedTimeBoxes[timeBoxIndex].tasks = updatedTimeBoxes[timeBoxIndex].tasks.map(task => ({
            ...task,
            status: 'todo'
          }))
        }
        
        // Recalculate story progress based on completed work timeboxes
        const workBoxes = updatedTimeBoxes.filter(box => box.type === 'work')
        const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
        const progress = workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
        
        return {
          ...story,
          timeBoxes: updatedTimeBoxes,
          progress
        }
      }
      return story
    })

    if (updated) {
      // Recalculate workplan status based on all timeboxes
      const allWorkBoxes = updatedStoryBlocks.flatMap(story => 
        story.timeBoxes.filter(box => box.type === 'work')
      )
      
      const allCompleted = allWorkBoxes.every(box => box.status === 'completed')
      const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress')
      const anyCompleted = allWorkBoxes.some(box => box.status === 'completed')
      
      let workplanStatus = workplan.status || 'planned'
      if (allCompleted) {
        workplanStatus = 'completed'
      } else if (anyInProgress || anyCompleted) {
        workplanStatus = 'in-progress'
      }
      
      const updatedWorkPlan = {
        ...workplan,
        storyBlocks: updatedStoryBlocks,
        status: workplanStatus
      }
      
      this.saveWorkPlan(date, updatedWorkPlan)
    }
    
    return updated
  },

  /**
   * Update task status within a time box
   */
  updateTaskStatus(date: string, storyId: string, timeBoxIndex: number, taskIndex: number, status: "todo" | "completed" | "mitigated"): boolean {
    const workplan = this.getWorkPlan(date)
    if (!workplan) return false

    let updated = false
    const updatedStoryBlocks = workplan.storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        const timeBox = story.timeBoxes[timeBoxIndex]
        if (timeBox.tasks && timeBox.tasks[taskIndex]) {
          updated = true
          const updatedTasks = [...timeBox.tasks]
          updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            status
          }
          
          // Update timebox status based on tasks
          // Ignore mitigated tasks when calculating timebox status
          const activeTasks = updatedTasks.filter(task => task.status !== 'mitigated');
          const allTasksCompleted = activeTasks.length > 0 && activeTasks.every(task => task.status === 'completed');
          const anyTaskCompleted = activeTasks.some(task => task.status === 'completed');
          const timeBoxStatus = allTasksCompleted ? 'completed' : anyTaskCompleted ? 'in-progress' : 'todo';
          
          const updatedTimeBoxes = [...story.timeBoxes]
          updatedTimeBoxes[timeBoxIndex] = {
            ...timeBox,
            tasks: updatedTasks,
            status: timeBoxStatus
          }
          
          // Recalculate story progress based on completed work timeboxes
          const workBoxes = updatedTimeBoxes.filter(box => box.type === 'work')
          const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
          const progress = workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
          
          return {
            ...story,
            timeBoxes: updatedTimeBoxes,
            progress
          }
        }
      }
      return story
    })

    if (updated) {
      // Recalculate workplan status based on all timeboxes
      const allWorkBoxes = updatedStoryBlocks.flatMap(story => 
        story.timeBoxes.filter(box => box.type === 'work')
      )
      
      const allCompleted = allWorkBoxes.every(box => box.status === 'completed')
      const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress')
      const anyCompleted = allWorkBoxes.some(box => box.status === 'completed')
      
      let workplanStatus = workplan.status || 'planned'
      if (allCompleted) {
        workplanStatus = 'completed'
      } else if (anyInProgress || anyCompleted) {
        workplanStatus = 'in-progress'
      }
      
      const updatedWorkPlan = {
        ...workplan,
        storyBlocks: updatedStoryBlocks,
        status: workplanStatus
      }
      
      this.saveWorkPlan(date, updatedWorkPlan)
    }
    
    return updated
  },

  /**
   * Calculate and update progress for all stories in a workplan
   */
  updateWorkPlanProgress(date: string): boolean {
    const workplan = this.getWorkPlan(date)
    if (!workplan) return false

    const updatedStoryBlocks = workplan.storyBlocks.map(story => {
      const totalWorkBoxes = story.timeBoxes.filter(box => box.type === 'work').length
      const completedWorkBoxes = story.timeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length
      const progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
      
      return {
        ...story,
        progress
      }
    })
    
    // Update workplan status if needed
    let workplanStatus = workplan.status || "planned"
    
    // Check if all time boxes are completed
    const allCompleted = updatedStoryBlocks.every(story => 
      story.timeBoxes.filter(box => box.type === 'work').every(box => box.status === 'completed')
    )
    
    // Check if any time box is in progress
    const anyInProgress = updatedStoryBlocks.some(story => 
      story.timeBoxes.some(box => box.status === 'in-progress')
    )
    
    if (allCompleted) {
      workplanStatus = "completed"
    } else if (anyInProgress) {
      workplanStatus = "in-progress"
    }
    
    const updatedWorkPlan = {
      ...workplan,
      storyBlocks: updatedStoryBlocks,
      status: workplanStatus
    }
    
    this.saveWorkPlan(date, updatedWorkPlan)
    return true
  },

  /**
   * Validate workplan data structure
   */
  isValidWorkPlan(data: any): data is StoredWorkPlan {
    // Check if data exists and is an object
    if (!data || typeof data !== 'object') {
      console.error('Invalid workplan: data is not an object', data);
      return false;
    }
    
    // Special case: If this is a timer-only state object without full workplan data
    if (data.activeTimeBox !== undefined && data.timeRemaining !== undefined && data.isTimerRunning !== undefined) {
      if (!data.storyBlocks) {
        // This is just timer state without the full workplan, which is valid for our timer persistence use case
        data.storyBlocks = [];
        data.totalWorkPlans = data.totalWorkPlans || 1;
        data.startTime = data.startTime || new Date().toISOString();
        data.endTime = data.endTime || new Date().toISOString();
        return true;
      }
    }
    
    // Check for minimal required properties
    if (!Array.isArray(data.storyBlocks)) {
      console.error('Invalid workplan: storyBlocks is not an array', data);
      return false;
    }
    
    // Set defaults for other properties if they're missing
    // This makes validation more fault-tolerant
    if (typeof data.totalWorkPlans !== 'number') {
      console.warn('Workplan missing totalWorkPlans, using default', data);
      data.totalWorkPlans = 1;
    }
    
    if (typeof data.startTime !== 'string') {
      console.warn('Workplan missing startTime, using default', data);
      data.startTime = new Date().toISOString();
    }
    
    if (typeof data.endTime !== 'string') {
      console.warn('Workplan missing endTime, using default', data);
      data.endTime = new Date().toISOString();
    }
    
    return true;
  },

  /**
   * Get timer state for a workplan
   */
  getTimerState(date: string): { 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  } | null {
    try {
      // First try to get the workplan
      const workplan = this.getWorkPlan(date)
      
      if (workplan && workplan.activeTimeBox !== undefined) {
        // Workplan exists with timer state
        return {
          activeTimeBox: workplan.activeTimeBox,
          timeRemaining: workplan.timeRemaining || null,
          isTimerRunning: workplan.isTimerRunning || false
        }
      }
      
      // If timer state is not in the workplan, try to get it directly from localStorage
      // This handles the case where timer state might be stored separately
      try {
        const timerKey = `${WORKPLAN_PREFIX}${date}-timer`
        const timerData = localStorage.getItem(timerKey)
        
        if (timerData) {
          const parsedData = JSON.parse(timerData)
          return {
            activeTimeBox: parsedData.activeTimeBox || null,
            timeRemaining: parsedData.timeRemaining || null,
            isTimerRunning: parsedData.isTimerRunning || false
          }
        }
      } catch (timerError) {
        console.error('Failed to get separate timer state:', timerError)
      }
      
      return null
    } catch (error) {
      console.error('Failed to get timer state:', error)
      return null
    }
  },

  /**
   * Save timer state for a workplan
   */
  saveTimerState(
    date: string, 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): boolean {
    try {
      // Try to get the existing workplan first
      const workplan = this.getWorkPlan(date)
      
      if (workplan) {
        // If workplan exists, update it with timer state
        const updatedWorkPlan = {
          ...workplan,
          activeTimeBox,
          timeRemaining,
          isTimerRunning,
          lastUpdated: new Date().toISOString()
        }
        
        this.saveWorkPlan(date, updatedWorkPlan)
      } else {
        // If no workplan exists, save timer state separately
        const timerKey = `${WORKPLAN_PREFIX}${date}-timer`
        localStorage.setItem(timerKey, JSON.stringify({
          activeTimeBox,
          timeRemaining,
          isTimerRunning,
          lastUpdated: new Date().toISOString()
        }))
      }
      
      return true
    } catch (error) {
      console.error('Failed to save timer state:', error)
      return false
    }
  },

  /**
   * Normalize workplan data to ensure consistent structure
   */
  normalizeWorkPlan(workplan: StoredWorkPlan): StoredWorkPlan {
    // Ensure storyBlocks exists and is an array
    const storyBlocks = Array.isArray(workplan.storyBlocks) ? workplan.storyBlocks : [];
    
    // Helper function to validate TimeBoxType
    const validateTimeBoxType = (type?: string): TimeBoxType => {
      const validTypes: TimeBoxType[] = ["work", "short-break", "long-break", "debrief"];
      return (type && validTypes.includes(type as TimeBoxType)) 
        ? (type as TimeBoxType) 
        : "work";
    };

    // Helper function to validate BaseStatus
    const validateBaseStatus = (status?: string): BaseStatus => {
      const validStatuses: BaseStatus[] = ["todo", "completed", "in-progress"];
      return (status && validStatuses.includes(status as BaseStatus))
        ? (status as BaseStatus)
        : "todo";
    };
    
    // Ensure all story blocks have a progress property
    const normalizedStoryBlocks = storyBlocks.map(block => {
      // Ensure block is an object
      if (!block || typeof block !== 'object') {
        console.warn('Invalid story block, replacing with empty block', block);
        return {
          id: `story-${Math.random().toString(36).substring(2, 9)}`,
          title: 'Unnamed Story',
          progress: 0,
          timeBoxes: [],
          taskIds: [],
          totalDuration: 0
        };
      }
      
      // Ensure timeBoxes is an array
      const timeBoxes = Array.isArray(block.timeBoxes) ? block.timeBoxes : [];
      
      // Ensure all timeBoxes have required properties
      const normalizedTimeBoxes = timeBoxes.map(box => {
        if (!box || typeof box !== 'object') {
          return {
            type: "work" as TimeBoxType,
            duration: 0,
            status: "todo" as BaseStatus,
            tasks: []
          };
        }
        
        return {
          ...box,
          type: validateTimeBoxType(box.type),
          duration: typeof box.duration === 'number' ? box.duration : 0,
          status: validateBaseStatus(box.status),
          tasks: Array.isArray(box.tasks) ? box.tasks.map(task => ({
            ...task,
            title: task.title || 'Unnamed Task',
            status: validateBaseStatus(task.status),
            duration: typeof task.duration === 'number' ? task.duration : 0
          })) : []
        };
      });
      
      // Calculate progress if not present
      let progress = block.progress;
      if (progress === undefined || progress === null) {
        const totalWorkBoxes = normalizedTimeBoxes.filter(box => box.type === 'work').length;
        const completedWorkBoxes = normalizedTimeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length;
        progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0;
      }
      
      // Calculate total duration if not present
      const totalDuration = block.totalDuration !== undefined ? block.totalDuration : 
        normalizedTimeBoxes.reduce((sum, box) => sum + (box.duration || 0), 0);
      
      return {
        id: block.id || `story-${Math.random().toString(36).substring(2, 9)}`,
        title: block.title || 'Unnamed Story',
        timeBoxes: normalizedTimeBoxes,
        progress,
        taskIds: Array.isArray(block.taskIds) ? block.taskIds : [],
        totalDuration
      };
    });
    
    return {
      ...workplan,
      storyBlocks: normalizedStoryBlocks,
      status: workplan.status || 'planned',
      totalWorkPlans: typeof workplan.totalWorkPlans === 'number' ? workplan.totalWorkPlans : 1,
      startTime: workplan.startTime || new Date().toISOString(),
      endTime: workplan.endTime || new Date().toISOString(),
      lastUpdated: workplan.lastUpdated || workplan.startTime || new Date().toISOString(),
      // Initialize timer state properties if not present
      activeTimeBox: workplan.activeTimeBox || null,
      timeRemaining: workplan.timeRemaining || null,
      isTimerRunning: workplan.isTimerRunning || false
    };
  }
}
