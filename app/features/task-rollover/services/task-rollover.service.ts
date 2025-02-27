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
   */
  async hasIncompleteTasks(): Promise<boolean> {
    const recentSession = await this.getMostRecentActiveSession();
    return recentSession !== null;
  }

  /**
   * Get the most recent session that is still active (not completed or archived)
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
   * Convert incomplete tasks to brain dump text format
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