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
import { SessionStorageService } from "@/app/features/session-manager";
import { TimeBoxTask, Session, StoryBlock, TimeBox } from "@/lib/types";
import { formatDuration } from "@/lib/durationUtils";

// Define the status for mitigated tasks (tasks that are neither completed nor rolled over)
export type TaskStatus = "todo" | "completed" | "mitigated";

export class TaskRolloverService {
  private sessionStorage: SessionStorageService;

  constructor() {
    this.sessionStorage = new SessionStorageService();
  }

  /**
   * Check if there are any incomplete tasks from recent sessions
   * 
   * This is the initial check to determine if we need to show the rollover UI
   * 
   * @returns Promise<boolean> - True if there are incomplete tasks
   */
  async hasIncompleteTasks(): Promise<boolean> {
    console.log("[TaskRolloverService] Checking for incomplete tasks in any session");
    const sessionWithIncompleteTasks = await this.getMostRecentSessionWithIncompleteTasks();
    const hasIncomplete = sessionWithIncompleteTasks !== null;
    console.log(`[TaskRolloverService] Has incomplete tasks: ${hasIncomplete}`);
    return hasIncomplete;
  }

  /**
   * Get the most recent session that has incomplete tasks
   * 
   * This finds the newest session that has incomplete tasks, regardless of status
   * (in-progress, planned, or even completed sessions might have incomplete tasks)
   * 
   * @returns Promise<Session | null> - The most recent session with incomplete tasks or null if none found
   */
  async getMostRecentSessionWithIncompleteTasks(): Promise<Session | null> {
    console.log("[TaskRolloverService] Finding most recent session with incomplete tasks");
    const allSessions = await this.sessionStorage.getAllSessions();
    
    // Debug log of all sessions found
    console.log(`[TaskRolloverService] Found ${allSessions.length} total sessions`);
    for (const session of allSessions) {
      console.log(`[TaskRolloverService] Session date: ${session.date}, status: ${session.status}`);
    }
    
    // Convert to array and sort by date (newest first)
    const sessionArray = Object.values(allSessions)
      .map(session => ({
        ...session,
        date: session.date || ''
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`[TaskRolloverService] Sorted ${sessionArray.length} sessions by date`);
    
    // Check each session for incomplete tasks, starting with the most recent
    for (const session of sessionArray) {
      const hasIncompleteTasks = this.sessionHasIncompleteTasks(session);
      console.log(`[TaskRolloverService] Session ${session.date} has incomplete tasks: ${hasIncompleteTasks}`);
      
      if (hasIncompleteTasks) {
        return session;
      }
    }
    
    console.log("[TaskRolloverService] No session with incomplete tasks found");
    return null;
  }
  
  /**
   * Check if a session has any incomplete tasks
   * 
   * @param session The session to check
   * @returns boolean True if the session has any incomplete tasks
   */
  private sessionHasIncompleteTasks(session: Session): boolean {
    let incompleteTasks = 0;
    let completedTasks = 0;
    let mitigatedTasks = 0;
    
    // Go through all story blocks, timeboxes, and tasks to find any incomplete ones
    for (const story of session.storyBlocks) {
      for (const timeBox of story.timeBoxes) {
        // Only consider work timeboxes with tasks
        if (timeBox.type === 'work' && timeBox.tasks && timeBox.tasks.length > 0) {
          for (const task of timeBox.tasks) {
            if (task.status === 'completed') {
              completedTasks++;
            } else if (task.status === 'mitigated') {
              mitigatedTasks++;
            } else {
              // Any other status (todo, in-progress, etc.) is considered incomplete
              incompleteTasks++;
            }
          }
        }
      }
    }
    
    console.log(`[TaskRolloverService] Session ${session.date} task breakdown - incomplete: ${incompleteTasks}, completed: ${completedTasks}, mitigated: ${mitigatedTasks}`);
    
    return incompleteTasks > 0;
  }

  /**
   * Get the most recent active session (in-progress or planned)
   * 
   * This is a more restrictive method that only looks at active sessions
   * Use getMostRecentSessionWithIncompleteTasks() instead for finding incomplete tasks
   * 
   * @returns Promise<Session | null> - The most recent active session or null if none found
   */
  async getMostRecentActiveSession(): Promise<Session | null> {
    console.log("[TaskRolloverService] Finding most recent active session");
    const allSessions = await this.sessionStorage.getAllSessions();
    
    // Convert to array and sort by date (newest first)
    const sessionArray = Object.values(allSessions)
      .map(session => ({
        ...session,
        date: session.date || ''
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Find the first session that's not completed or archived
    const activeSession = sessionArray.find(session => 
      session.status === 'in-progress' || session.status === 'planned'
    );
    
    console.log(`[TaskRolloverService] Most recent active session: ${activeSession ? activeSession.date : 'none'}`);
    return activeSession || null;
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
    session: Session;
    tasks: Array<{
      task: TimeBoxTask;
      storyTitle: string;
      storyId: string;
      timeBoxIndex: number;
      taskIndex: number;
    }>;
  } | null> {
    const recentSession = await this.getMostRecentSessionWithIncompleteTasks();
    
    if (!recentSession) {
      console.log("[TaskRolloverService] No recent session with incomplete tasks found");
      return null;
    }
    
    console.log(`[TaskRolloverService] Finding incomplete tasks in session ${recentSession.date}`);
    
    const incompleteTasks: Array<{
      task: TimeBoxTask;
      storyTitle: string;
      storyId: string;
      timeBoxIndex: number;
      taskIndex: number;
    }> = [];
    
    // Extract all incomplete tasks from work timeboxes
    recentSession.storyBlocks.forEach(story => {
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
    
    console.log(`[TaskRolloverService] Found ${incompleteTasks.length} incomplete tasks in session ${recentSession.date}`);
    
    return {
      session: recentSession,
      tasks: incompleteTasks
    };
  }

  /**
   * Mark a task as completed in its original session
   * 
   * Used when a user indicates they've actually completed the task and don't want to roll it over
   * 
   * @param sessionDate - Date of the session containing the task
   * @param storyId - ID of the story containing the task
   * @param timeBoxIndex - Index of the timebox containing the task
   * @param taskIndex - Index of the task within the timebox
   * @returns Promise<boolean> - Success status
   */
  async completeTask(
    sessionDate: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): Promise<boolean> {
    console.log(`[TaskRolloverService] Marking task as completed in session ${sessionDate}, story ${storyId}, timeBox ${timeBoxIndex}, task ${taskIndex}`);
    
    const result = await this.sessionStorage.updateTaskStatus(
      sessionDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'completed'
    );
    
    console.log(`[TaskRolloverService] Task completion result: ${result}`);
    return result;
  }

  /**
   * Mark a task as mitigated in its original session
   * 
   * Used when a user chooses not to roll over a task but also hasn't completed it
   * These tasks are considered "mitigated" - the user decided not to pursue them
   * 
   * @param sessionDate - Date of the session containing the task
   * @param storyId - ID of the story containing the task
   * @param timeBoxIndex - Index of the timebox containing the task
   * @param taskIndex - Index of the task within the timebox
   * @returns Promise<boolean> - Success status
   */
  async mitigateTask(
    sessionDate: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number
  ): Promise<boolean> {
    console.log(`[TaskRolloverService] Marking task as mitigated in session ${sessionDate}, story ${storyId}, timeBox ${timeBoxIndex}, task ${taskIndex}`);
    
    const result = await this.sessionStorage.updateTaskStatus(
      sessionDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'mitigated'
    );
    
    console.log(`[TaskRolloverService] Task mitigation result: ${result}`);
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
   * Archives the session for the given date.
   * 
   * This changes the session status to 'archived' so it won't be shown in active views
   * Used after creating a new session to archive the previous one
   * 
   * @param date The date of the session to archive
   * @returns A boolean indicating whether the archiving was successful
   */
  async archiveSession(date: string): Promise<boolean> {
    try {
      console.log(`[TaskRolloverService] Archiving session ${date}`);
      const success = await this.sessionStorage.archiveSession(date);
      console.log(`[TaskRolloverService] Session archive result: ${success}`);
      return success;
    } catch (error) {
      console.error('[TaskRolloverService] Failed to archive session:', error);
      return false;
    }
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
} 