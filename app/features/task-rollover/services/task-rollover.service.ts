/**
 * TaskRolloverService
 * 
 * This service handles the business logic for rolling over incomplete tasks from
 * previous sessions to new sessions. It interacts with the SessionStorageService
 * to retrieve and update session data.
 * 
 * STABILITY IMPROVEMENTS:
 * - Single responsibility service focused on task rollover operations
 * - Clear separation between data access and UI logic
 * - Proper error handling and logging
 * - Consistent async/await pattern usage
 * - Session archiving integration
 */
import { TimeBoxTask, TodoWorkPlan, StoryBlock, TimeBox } from "@/lib/types";
import { formatDuration } from "@/lib/durationUtils";
import { WorkPlanStorageService } from "@/app/features/workplan-manager";

// Define the status for mitigated tasks (tasks that are neither completed nor rolled over)
export type TaskStatus = "todo" | "completed" | "mitigated";

// Define tracked metrics for incomplete tasks in archived workplans
export interface IncompleteTasks {
  count: number;
  tasks: Array<{
    title: string;
    storyTitle: string;
    duration: number;
    taskCategory?: string;
    mitigated: boolean;
    rolledOver: boolean;
  }>;
}

export class TaskRolloverService {
  private workplanStorage: WorkPlanStorageService;

  // Add cache properties to the class
  private recentWorkplanCache: {
    workplan: TodoWorkPlan | null;
    timestamp: number;
  } = {
    workplan: null,
    timestamp: 0
  };

  // Cache expiration time in milliseconds (10 seconds)
  private readonly CACHE_EXPIRATION = 10000;

  constructor() {
    this.workplanStorage = new WorkPlanStorageService();
  }

  /**
   * Check if there are any incomplete tasks from recent workplans
   * 
   * This is the initial check to determine if we need to show the rollover UI
   * 
   * @returns Promise<boolean> - True if there are incomplete tasks
   */
  async hasIncompleteTasks(): Promise<boolean> {
    console.log("[TaskRolloverService] Checking for incomplete tasks in any workplan");
    const workplanWithIncompleteTasks = await this.getMostRecentWorkPlanWithIncompleteTasks();
    const hasIncomplete = workplanWithIncompleteTasks !== null;
    console.log(`[TaskRolloverService] Has incomplete tasks: ${hasIncomplete}`);
    return hasIncomplete;
  }

  /**
   * Get the most recent workplan that has incomplete tasks
   * 
   * This finds the newest workplan that has incomplete tasks, regardless of status
   * (in-progress, planned, or even completed workplans might have incomplete tasks)
   * 
   * @returns Promise<TodoWorkPlan | null> - The most recent workplan with incomplete tasks or null if none found
   */
  async getMostRecentWorkPlanWithIncompleteTasks(): Promise<TodoWorkPlan | null> {
    console.log("[TaskRolloverService] Finding most recent workplan with incomplete tasks");
    
    // Check if we have a valid cache
    const now = Date.now();
    if (this.recentWorkplanCache.workplan && (now - this.recentWorkplanCache.timestamp) < this.CACHE_EXPIRATION) {
      console.log("[TaskRolloverService] Returning cached recent workplan with incomplete tasks");
      return this.recentWorkplanCache.workplan;
    }
    
    const allWorkPlans = await this.workplanStorage.getAllWorkPlans() as TodoWorkPlan[];
    
    // Debug log of all workplans found
    console.log(`[TaskRolloverService] Found ${allWorkPlans.length} total workplans`);
    for (const workplan of allWorkPlans) {
      console.log(`[TaskRolloverService] WorkPlan date: ${workplan.id}, status: ${workplan.status}`);
    }
    
    // Convert to array and sort by date (newest first)
    const workplanArray = allWorkPlans
      .map(workplan => ({
        ...workplan,
        date: workplan.id
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`[TaskRolloverService] Sorted ${workplanArray.length} workplans by date`);
    
    // Check each workplan for incomplete tasks, starting with the most recent
    for (const workplan of workplanArray) {
      const hasIncompleteTasks = this.workplanHasIncompleteTasks(workplan);
      console.log(`[TaskRolloverService] WorkPlan ${workplan.date} has incomplete tasks: ${hasIncompleteTasks}`);
      
      if (hasIncompleteTasks) {
        // Update the cache
        this.recentWorkplanCache = {
          workplan,
          timestamp: now
        };
        return workplan;
      }
    }
    
    console.log("[TaskRolloverService] No workplan with incomplete tasks found");
    // Update the cache with null result
    this.recentWorkplanCache = {
      workplan: null,
      timestamp: now
    };
    return null;
  }
  
  /**
   * Check if a workplan has any incomplete tasks
   * 
   * @param workplan The workplan to check
   * @returns boolean True if the workplan has any incomplete tasks
   */
  private workplanHasIncompleteTasks(workplan: TodoWorkPlan): boolean {
    let incompleteTasks = 0;
    let completedTasks = 0;
    let mitigatedTasks = 0;
    
    // Go through all story blocks, timeboxes, and tasks to find any incomplete ones
    for (const story of workplan.storyBlocks) {
      for (const timeBox of story.timeBoxes) {
        // Only consider work timeboxes with tasks
        if (timeBox.type === 'work' && timeBox.tasks && timeBox.tasks.length > 0) {
          for (const task of timeBox.tasks) {
            if (task.status === 'completed') {
              completedTasks++;
            } else if (task.status === 'mitigated') {
              mitigatedTasks++;
              // Log mitigated tasks for debugging
              console.log(`[TaskRolloverService] Found mitigated task: "${task.title}" in workplan ${workplan.id}`);
            } else {
              // Any other status (todo, in-progress, etc.) is considered incomplete
              incompleteTasks++;
              // Log incomplete tasks for debugging
              console.log(`[TaskRolloverService] Found incomplete task: "${task.title}" in workplan ${workplan.id}`);
            }
          }
        }
      }
    }
    
    console.log(`[TaskRolloverService] WorkPlan ${workplan.id} task breakdown - incomplete: ${incompleteTasks}, completed: ${completedTasks}, mitigated: ${mitigatedTasks}`);
    
    // Only return true if there are actually incomplete tasks (not mitigated)
    // This ensures that if all tasks are either completed or mitigated, we won't trigger the paywall
    return incompleteTasks > 0;
  }

  /**
   * Get the most recent active workplan (in-progress or planned)
   * 
   * This is a more restrictive method that only looks at active workplans
   * Use getMostRecentWorkPlanWithIncompleteTasks() instead for finding incomplete tasks
   * 
   * @returns Promise<TodoWorkPlan | null> - The most recent active workplan or null if none found
   */
  async getMostRecentActiveWorkPlan(): Promise<TodoWorkPlan | null> {
    console.log("[TaskRolloverService] Finding most recent active workplan");
    const allWorkPlans = await this.workplanStorage.getAllWorkPlans() as TodoWorkPlan[];
    
    // Convert to array and sort by date (newest first)
    const workplanArray = allWorkPlans
      .map(workplan => ({
        ...workplan,
        date: workplan.id
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Find the first workplan that's not completed or archived
    const activeWorkPlan = workplanArray.find(workplan => 
      workplan.status === 'in-progress' || workplan.status === 'planned'
    );
    
    console.log(`[TaskRolloverService] Most recent active workplan: ${activeWorkPlan ? activeWorkPlan.date : 'none'}`);
    return activeWorkPlan || null;
  }

  /**
   * Get all incomplete tasks from the most recent session with incomplete tasks
   * 
   * This provides the full list of tasks that can be rolled over with all metadata needed
   * for display, selection, and operation
   * 
   * @returns Promise with session and task details, or null if no tasks found
   */
  async getIncompleteTasks(): Promise<{
    workplan: TodoWorkPlan;
    tasks: Array<{
      task: TimeBoxTask;
      storyTitle: string;
      storyId: string;
      timeBoxIndex: number;
      taskIndex: number;
    }>;
  } | null> {
    const recentWorkPlan = await this.getMostRecentWorkPlanWithIncompleteTasks();
    
    if (!recentWorkPlan) {
      console.log("[TaskRolloverService] No recent workplan with incomplete tasks found");
      return null;
    }
    
    console.log(`[TaskRolloverService] Finding incomplete tasks in workplan ${recentWorkPlan.id}`);
    
    const incompleteTasks: Array<{
      task: TimeBoxTask;
      storyTitle: string;
      storyId: string;
      timeBoxIndex: number;
      taskIndex: number;
    }> = [];
    
    // Extract all incomplete tasks from work timeboxes
    recentWorkPlan.storyBlocks.forEach(story => {
      story.timeBoxes.forEach((timeBox, timeBoxIndex) => {
        // Only consider work timeboxes
        if (timeBox.type === 'work' && timeBox.tasks) {
          timeBox.tasks.forEach((task, taskIndex) => {
            if (task.status !== 'completed' && task.status !== 'mitigated') {
              incompleteTasks.push({
                task,
                storyTitle: story.title,
                storyId: story.id,
                timeBoxIndex,
                taskIndex
              });
              console.log(`[TaskRolloverService] Found incomplete task: "${task.title}" in story "${story.title}"`);
            }
          });
        }
      });
    });
    
    console.log(`[TaskRolloverService] Found ${incompleteTasks.length} incomplete tasks in workplan ${recentWorkPlan.id}`);
    
    return {
      workplan: recentWorkPlan,
      tasks: incompleteTasks
    };
  }

  /**
   * Mark a task as completed in its original workplan
   * 
   * Used when a user indicates they've actually completed the task and don't want to roll it over
   * 
   * @param workplanDate - Date of the workplan containing the task
   * @param storyId - ID of the story containing the task
   * @param timeBoxIndex - Index of the timebox containing the task
   * @param taskIndex - Index of the task within the timebox
   * @returns Promise<boolean> - Success status
   */
  async completeTask(
    workplanDate: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): Promise<boolean> {
    const result = await this.workplanStorage.updateTaskStatus(
      workplanDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'completed'
    );
    return result;
  }

  /**
   * Mark a task as mitigated in its original workplan
   * 
   * Used when a user indicates they don't need to complete the task and don't want to roll it over
   * 
   * @param workplanDate - Date of the workplan containing the task
   * @param storyId - ID of the story containing the task
   * @param timeBoxIndex - Index of the timebox containing the task
   * @param taskIndex - Index of the task within the timebox
   * @returns Promise<boolean> - Success status
   */
  async mitigateTask(
    workplanDate: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): Promise<boolean> {
    const result = await this.workplanStorage.updateTaskStatus(
      workplanDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'mitigated'
    );
    return result;
  }

  /**
   * Mark all unselected tasks as mitigated
   * 
   * This is called after a user confirms they want to "forget" the unselected tasks
   * during the rollover process
   * 
   * @param sessionDate - Date of the session
   * @param tasks - Array of tasks with their selection status
   * @returns Promise<boolean> - Success status
   */
  async mitigateUnselectedTasks(
    sessionDate: string,
    tasks: Array<{
      selected: boolean;
      storyId: string;
      timeBoxIndex: number;
      taskIndex: number;
    }>
  ): Promise<boolean> {
    try {
      // Filter out the unselected tasks
      const unselectedTasks = tasks.filter(task => !task.selected);
      
      console.log(`[TaskRolloverService] Mitigating ${unselectedTasks.length} unselected tasks in session ${sessionDate}`);
      
      if (unselectedTasks.length === 0) {
        console.log('[TaskRolloverService] No unselected tasks to mitigate');
        return true; // No tasks to mitigate
      }
      
      // Mark each unselected task as mitigated
      const results = await Promise.all(
        unselectedTasks.map(task => 
          this.mitigateTask(
            sessionDate,
            task.storyId,
            task.timeBoxIndex,
            task.taskIndex
          )
        )
      );
      
      // Return true only if all tasks were successfully mitigated
      const success = results.every(result => result === true);
      console.log(`[TaskRolloverService] Mitigated ${unselectedTasks.length} tasks with result: ${success}`);
      return success;
    } catch (error) {
      console.error('[TaskRolloverService] Failed to mitigate unselected tasks:', error);
      return false;
    }
  }

  /**
   * Archive a workplan and update its incomplete tasks tracking
   * 
   * @param date - The date of the workplan to archive
   * @returns Promise<boolean> - Success status
   */
  async archiveWorkPlan(date: string): Promise<boolean> {
    const workplan = await this.workplanStorage.getWorkPlan(date);
    if (!workplan) {
      console.error(`[TaskRolloverService] Failed to find workplan for date: ${date}`);
      return false;
    }

    // Track incomplete tasks before archiving
    const incompleteTasks: IncompleteTasks = {
      count: 0,
      tasks: []
    };

    // Go through all story blocks and timeboxes to find incomplete tasks
    workplan.storyBlocks.forEach((story: StoryBlock) => {
      story.timeBoxes.forEach((timeBox: TimeBox) => {
        if (timeBox.type === 'work' && timeBox.tasks) {
          timeBox.tasks.forEach((task: TimeBoxTask) => {
            if (task.status !== 'completed') {
              incompleteTasks.count++;
              incompleteTasks.tasks.push({
                title: task.title,
                storyTitle: story.title,
                duration: task.duration,
                taskCategory: task.taskCategory,
                mitigated: task.status === 'mitigated',
                rolledOver: false // Will be updated when task is rolled over
              });
            }
          });
        }
      });
    });

    // Update the workplan with incomplete tasks tracking
    const updatedWorkPlan = {
      ...workplan,
      incompleteTasks,
      status: 'archived' as const
    };

    // Save the workplan with archived status
    await this.workplanStorage.saveWorkPlan({ ...updatedWorkPlan, id: date });
    return true;
  }

  /**
   * Convert incomplete tasks to brain dump text format
   * 
   * This creates a formatted text representation of tasks that can be added to the brain dump input.
   * Preserves important task metadata like durations and priorities but removes unnecessary context.
   * 
   * @param tasks Array of tasks with their story context
   * @returns Formatted string for brain dump
   */
  convertTasksToBrainDumpFormat(tasks: Array<{
    task: TimeBoxTask;
    storyTitle: string;
  }>): string {
    console.log(`[TaskRolloverService] Converting ${tasks.length} tasks to brain dump format`);
    
    if (tasks.length === 0) {
      console.log('[TaskRolloverService] No tasks to convert');
      return '';
    }
    
    // Create a clean task list without headers or context tags
    const formattedTasks = tasks.map(item => {
      // Format: Title - duration + FROG indicator if needed
      const durationStr = item.task.duration ? ` - ${formatDuration(item.task.duration)}` : '';
      const frogIndicator = item.task.isFrog ? ' FROG' : '';
      
      return `${item.task.title}${durationStr}${frogIndicator}`;
    }).join('\n');
    
    console.log('[TaskRolloverService] Tasks converted to brain dump format successfully', {
      taskCount: tasks.length,
      outputLength: formattedTasks.length
    });
    
    return formattedTasks;
  }

  /**
   * Mark a task as rolled over in its original workplan
   * 
   * @param workplanDate - Date of the workplan containing the task
   * @param storyId - ID of the story containing the task
   * @param timeBoxIndex - Index of the timebox containing the task
   * @param taskIndex - Index of the task within the timebox
   * @returns Promise<boolean> - Success status
   */
  async markTaskRolledOver(
    workplanDate: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): Promise<boolean> {
    const statusUpdated = await this.workplanStorage.updateTaskStatus(
      workplanDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'mitigated'
    );

    if (!statusUpdated) {
      console.error(`[TaskRolloverService] Failed to update task status for workplan: ${workplanDate}`);
      return false;
    }

    // Update the incompleteTasks tracking to mark this task as rolled over
    const workplan = await this.workplanStorage.getWorkPlan(workplanDate);
    if (!workplan || !workplan.incompleteTasks) {
      console.error(`[TaskRolloverService] Failed to find workplan or incomplete tasks for date: ${workplanDate}`);
      return false;
    }

    const updatedIncompleteTasks = {
      ...workplan.incompleteTasks,
      tasks: workplan.incompleteTasks.tasks.map((task) => {
        // Find the task in the workplan to get its title for matching
        const matchingTask = this.findTaskInWorkPlan(workplan, storyId, timeBoxIndex, taskIndex);
        if (matchingTask && task.title === matchingTask.title) {
          return {
            ...task,
            storyTitle: task.storyTitle || '',
            duration: task.duration || 0,
            mitigated: task.mitigated || false,
            rolledOver: true
          };
        }
        return {
          ...task,
          storyTitle: task.storyTitle || '',
          duration: task.duration || 0,
          mitigated: task.mitigated || false,
          rolledOver: task.rolledOver || false
        };
      })
    };

    const updatedWorkPlan = {
      ...workplan,
      incompleteTasks: updatedIncompleteTasks
    };

    await this.workplanStorage.saveWorkPlan({ ...updatedWorkPlan, id: workplanDate });
    return true;
  }

  /**
   * Helper function to find a task in a workplan by its location
   */
  private findTaskInWorkPlan(
    workplan: TodoWorkPlan,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): TimeBoxTask | null {
    const story = workplan.storyBlocks.find(s => s.id === storyId);
    if (!story) return null;

    const timeBox = story.timeBoxes[timeBoxIndex];
    if (!timeBox || !timeBox.tasks) return null;

    return timeBox.tasks[taskIndex] || null;
  }

  private processStoryTasks(
    story: StoryBlock,
    timeBox: TimeBox,
    timeBoxIndex: number
  ): void {
    if (timeBox.tasks) {
      timeBox.tasks.forEach((task: TimeBoxTask) => {
        // ... existing code ...
      });
    }
  }

  async getAllWorkPlans(): Promise<TodoWorkPlan[]> {
    const allWorkPlans = await this.workplanStorage.getAllWorkPlans();
    return allWorkPlans as TodoWorkPlan[];
  }

  async getWorkPlan(date: string): Promise<TodoWorkPlan> {
    const workplan = await this.workplanStorage.getWorkPlan(date);
    return workplan as TodoWorkPlan;
  }

  async saveWorkPlan(date: string, workplan: TodoWorkPlan): Promise<void> {
    const workplanWithId = { ...workplan, id: date };
    await this.workplanStorage.saveWorkPlan(workplanWithId);
  }

  private sortByDuration(s1: { duration: number }, s2: { duration: number }): number {
    return s2.duration - s1.duration;
  }

  private sortByTitle(t1: { title: string }, t2: { title: string }): number {
    return t1.title.localeCompare(t2.title);
  }
} 