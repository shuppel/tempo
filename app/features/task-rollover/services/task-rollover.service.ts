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
    const recentSession = await this.getMostRecentActiveSession();
    return recentSession !== null;
  }

  /**
   * Get the most recent session that is still active (not completed or archived)
   * 
   * This finds the newest session that has a status of 'in-progress' or 'planned'
   * We only want to roll over tasks from active sessions, not ones marked as completed or archived
   * 
   * @returns Promise<Session | null> - The most recent active session or null if none found
   */
  async getMostRecentActiveSession(): Promise<Session | null> {
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
    
    return activeSession || null;
  }

  /**
   * Get all incomplete tasks from the most recent active session
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
    const recentSession = await this.getMostRecentActiveSession();
    
    if (!recentSession) {
      return null;
    }
    
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
            if (task.status !== 'completed') {
              incompleteTasks.push({
                task,
                storyTitle: story.title,
                storyId: story.id,
                timeBoxIndex,
                taskIndex
              });
            }
          });
        }
      });
    });
    
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
    return this.sessionStorage.updateTaskStatus(
      sessionDate,
      storyId,
      timeBoxIndex,
      taskIndex,
      'completed'
    );
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
      const success = await this.sessionStorage.archiveSession(date);
      return success;
    } catch (error) {
      console.error('[TaskRolloverService] Failed to archive session:', error);
      return false;
    }
  }

  /**
   * Unarchives the session for the given date.
   * 
   * This changes the session status from 'archived' back to 'planned'
   * Used when a user wants to restore an archived session to active status
   * 
   * @param date The date of the session to unarchive
   * @returns A boolean indicating whether the unarchiving was successful
   */
  async unarchiveSession(date: string): Promise<boolean> {
    try {
      const success = await this.sessionStorage.unarchiveSession(date);
      return success;
    } catch (error) {
      console.error('[TaskRolloverService] Failed to unarchive session:', error);
      return false;
    }
  }

  /**
   * Convert incomplete tasks to brain dump text format
   * 
   * This creates a formatted text representation of tasks that can be added to the brain dump input.
   * Preserves important task metadata like durations, priorities, and context.
   * 
   * @param tasks Array of tasks with their story context
   * @returns Formatted string for brain dump
   */
  convertTasksToBrainDumpFormat(tasks: Array<{
    task: TimeBoxTask;
    storyTitle: string;
  }>): string {
    return tasks.map(item => {
      // Format: Title - duration + context
      const durationStr = item.task.duration ? ` - ${formatDuration(item.task.duration)}` : '';
      const contextStr = item.storyTitle ? ` (From: ${item.storyTitle})` : '';
      const frogIndicator = item.task.isFrog ? ' FROG' : '';
      
      return `${item.task.title}${durationStr}${frogIndicator}${contextStr}`;
    }).join('\n');
  }
} 