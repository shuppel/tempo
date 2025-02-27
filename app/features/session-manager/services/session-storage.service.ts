import type { 
  Session, 
  StoryBlock, 
  TimeBox, 
  TimeBoxTask,
  BaseStatus,
  TimeBoxStatus,
  SessionStatus
} from "@/lib/types"
import { sessionStorage } from "@/lib/sessionStorage"

const SESSION_PREFIX = 'session-'

export class SessionStorageService {
  /**
   * Get a session by date
   */
  async getSession(date: string): Promise<Session | null> {
    console.log(`[SessionStorageService] Getting session for date: ${date}`)
    const storedSession = sessionStorage.getSession(date)
    
    if (!storedSession) {
      console.log(`[SessionStorageService] No session found for date: ${date}`)
      
      // For development only: if no session exists, create a dummy session
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SessionStorageService] Creating dummy session for development`)
        const dummySession = this.createDummySession(date)
        await this.saveSession(date, dummySession)
        return dummySession
      }
      
      return null
    }
    
    console.log(`[SessionStorageService] Found session for date: ${date} with ${storedSession.storyBlocks?.length || 0} story blocks`)
    
    return {
      date: this.formatDate(date),
      storyBlocks: storedSession.storyBlocks || [],
      status: (storedSession.status as SessionStatus) || 'planned',
      totalDuration: storedSession.totalDuration || 0,
      lastUpdated: storedSession.lastUpdated || new Date().toISOString()
    }
  }

  /**
   * Creates a dummy session for development testing
   * This should only be used in development environments
   */
  private createDummySession(date: string): Session {
    const formattedDate = this.formatDate(date)
    console.log(`[SessionStorageService] Creating dummy session for date: ${formattedDate}`)
    
    return {
      date: formattedDate,
      storyBlocks: [
        {
          id: 'story-1',
          title: 'Example Story 1',
          progress: 0,
          totalDuration: 55, // 25 + 5 + 25
          taskIds: [],
          timeBoxes: [
            {
              type: 'work',
              duration: 25,
              status: 'todo',
              tasks: [
                { title: 'Task 1', status: 'todo', duration: 0 },
                { title: 'Task 2', status: 'todo', duration: 0 }
              ]
            },
            {
              type: 'short-break',
              duration: 5,
              status: 'todo',
              tasks: []
            },
            {
              type: 'work',
              duration: 25,
              status: 'todo',
              tasks: [
                { title: 'Task 3', status: 'todo', duration: 0 }
              ]
            }
          ]
        },
        {
          id: 'story-2',
          title: 'Example Story 2',
          progress: 0,
          totalDuration: 25,
          taskIds: [],
          timeBoxes: [
            {
              type: 'work',
              duration: 25,
              status: 'todo',
              tasks: [
                { title: 'Task 4', status: 'todo', duration: 0 },
                { title: 'Task 5', status: 'todo', duration: 0 }
              ]
            }
          ]
        }
      ],
      status: 'planned',
      totalDuration: 80,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<Session[]> {
    console.log(`[SessionStorageService] Getting all sessions`)
    const storedSessions = sessionStorage.getAllSessions()
    const sessionCount = Object.keys(storedSessions).length
    console.log(`[SessionStorageService] Found ${sessionCount} sessions`)
    
    if (sessionCount === 0) {
      // Debug: check localStorage directly to see if there are any session keys
      const allStorageKeys: Array<string | null> = [];
      for (let i = 0; i < localStorage.length; i++) {
        allStorageKeys.push(localStorage.key(i));
      }
      console.log(`[SessionStorageService] Debug - All localStorage keys:`, allStorageKeys);
      
      // Check for any session keys specifically
      const sessionKeys = allStorageKeys.filter((key): key is string => 
        key !== null && key.startsWith('session-')
      );
      if (sessionKeys.length > 0) {
        console.log(`[SessionStorageService] Found ${sessionKeys.length} raw session keys, but they were not loaded by sessionStorage:`, sessionKeys);
        
        // Try to manually retrieve and fix this
        const manuallyLoadedSessions = [];
        for (const key of sessionKeys) {
          try {
            const rawData = localStorage.getItem(key);
            if (rawData) {
              const sessionData = JSON.parse(rawData);
              const date = key.replace('session-', '');
              manuallyLoadedSessions.push({
                date: this.formatDate(date),
                storyBlocks: sessionData.storyBlocks || [],
                status: (sessionData.status as SessionStatus) || 'planned',
                totalDuration: sessionData.totalDuration || 0,
                lastUpdated: sessionData.lastUpdated || new Date().toISOString()
              });
              console.log(`[SessionStorageService] Manually recovered session for date: ${date}`);
            }
          } catch (error) {
            console.error(`[SessionStorageService] Failed to manually parse session from key ${key}:`, error);
          }
        }
        
        if (manuallyLoadedSessions.length > 0) {
          console.log(`[SessionStorageService] Returning ${manuallyLoadedSessions.length} manually loaded sessions`);
          return manuallyLoadedSessions;
        }
      }
    }
    
    return Object.entries(storedSessions).map(([date, session]) => ({
      date: this.formatDate(date),
      storyBlocks: session.storyBlocks,
      status: (session.status as SessionStatus) || 'planned',
      totalDuration: session.totalDuration,
      lastUpdated: session.lastUpdated
    }))
  }

  /**
   * Save a session
   */
  async saveSession(date: string, session: Session): Promise<void> {
    const formattedDate = this.formatDate(date)
    console.log(`[SessionStorageService] Saving session for date: ${formattedDate} with ${session.storyBlocks?.length || 0} story blocks and total duration: ${session.totalDuration}`)
    
    try {
      sessionStorage.saveSession(formattedDate, {
        ...session,
        totalSessions: 1, // Required by StoredSession
        startTime: session.lastUpdated || new Date().toISOString(),
        endTime: new Date().toISOString(),
        frogMetrics: { total: 0, scheduled: 0, scheduledWithinTarget: 0 } // Required by SessionPlan
      })
      
      // Verify the session was saved
      const verifySession = sessionStorage.getSession(formattedDate)
      if (!verifySession) {
        console.error(`[SessionStorageService] Failed to verify session save for date: ${formattedDate}`)
      } else {
        console.log(`[SessionStorageService] Successfully saved and verified session for date: ${formattedDate}`)
      }
    } catch (error) {
      console.error(`[SessionStorageService] Error saving session for date: ${formattedDate}:`, error)
      throw error
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(date: string): Promise<void> {
    sessionStorage.deleteSession(this.formatDate(date))
  }

  /**
   * Update task status and recalculate related states
   */
  async updateTaskStatus(
    date: string,
    storyId: string | undefined,
    timeBoxIndex: number,
    taskIndex: number,
    status: "todo" | "completed"
  ): Promise<boolean> {
    // If storyId is undefined, we can't update the task status
    if (!storyId) {
      console.error("Cannot update task status: storyId is undefined");
      return false;
    }
    
    console.log(`[SessionStorageService] Updating task status in session ${date}, story ${storyId}, timeBox ${timeBoxIndex}, task ${taskIndex} to ${status}`);
    
    const result = sessionStorage.updateTaskStatus(date, storyId, timeBoxIndex, taskIndex, status);
    console.log(`[SessionStorageService] Task status update result: ${result}`);
    
    return result;
  }

  /**
   * Update timebox status and recalculate related states
   */
  async updateTimeBoxStatus(
    date: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<boolean> {
    return sessionStorage.updateTimeBoxStatus(date, storyId, timeBoxIndex, status)
  }

  /**
   * Calculate session status based on all work timeboxes
   */
  private calculateSessionStatus(storyBlocks: StoryBlock[]): SessionStatus {
    const allWorkBoxes = storyBlocks.flatMap(story => 
      story.timeBoxes.filter(box => box.type === 'work')
    )
    
    const allCompleted = allWorkBoxes.every(box => box.status === 'completed')
    const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress')
    const anyCompleted = allWorkBoxes.some(box => box.status === 'completed')
    
    if (allCompleted) return 'completed'
    if (anyInProgress || anyCompleted) return 'in-progress'
    return 'planned'
  }

  /**
   * Calculate story progress based on completed work timeboxes
   */
  private calculateStoryProgress(timeBoxes: TimeBox[]): number {
    const workBoxes = timeBoxes.filter(box => box.type === 'work')
    const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
    return workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
  }

  /**
   * Update story blocks with new task status
   */
  private updateStoryBlocksWithTaskStatus(
    storyBlocks: StoryBlock[],
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: "todo" | "completed"
  ): StoryBlock[] {
    return storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        const timeBox = story.timeBoxes[timeBoxIndex]
        if (timeBox.tasks && timeBox.tasks[taskIndex]) {
          const updatedTasks = [...timeBox.tasks]
          updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status }
          
          const timeBoxStatus = this.calculateTimeBoxStatus(updatedTasks)
          const updatedTimeBoxes = [...story.timeBoxes]
          updatedTimeBoxes[timeBoxIndex] = {
            ...timeBox,
            tasks: updatedTasks,
            status: timeBoxStatus
          }
          
          const progress = this.calculateStoryProgress(updatedTimeBoxes)
          return {
            ...story,
            timeBoxes: updatedTimeBoxes,
            progress
          }
        }
      }
      return story
    })
  }

  /**
   * Update story blocks with new timebox status
   */
  private updateStoryBlocksWithTimeBoxStatus(
    storyBlocks: StoryBlock[],
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): StoryBlock[] {
    return storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        const updatedTimeBoxes = [...story.timeBoxes]
        const timeBox = updatedTimeBoxes[timeBoxIndex]
        
        // Update tasks based on timebox status
        if (timeBox.tasks) {
          timeBox.tasks = timeBox.tasks.map(task => ({
            ...task,
            status: status === 'completed' ? 'completed' : 'todo'
          }))
        }
        
        updatedTimeBoxes[timeBoxIndex] = {
          ...timeBox,
          status
        }
        
        const progress = this.calculateStoryProgress(updatedTimeBoxes)
        return {
          ...story,
          timeBoxes: updatedTimeBoxes,
          progress
        }
      }
      return story
    })
  }

  /**
   * Calculate timebox status based on its tasks
   */
  private calculateTimeBoxStatus(tasks: TimeBoxTask[]): TimeBoxStatus {
    const allTasksCompleted = tasks.every(task => task.status === 'completed')
    const anyTaskCompleted = tasks.some(task => task.status === 'completed')
    
    if (allTasksCompleted) return 'completed'
    if (anyTaskCompleted) return 'in-progress'
    return 'todo'
  }

  /**
   * Save timer state for a session
   */
  async saveTimerState(
    date: string, 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    try {
      const formattedDate = this.formatDate(date);
      console.log(`[SessionStorageService] Saving timer state for date: ${formattedDate}`);
      
      return sessionStorage.saveTimerState(
        formattedDate,
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      );
    } catch (error) {
      console.error(`[SessionStorageService] Error saving timer state for date: ${date}:`, error);
      return false;
    }
  }

  /**
   * Get timer state for a session
   */
  getTimerState(date: string): { 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  } | null {
    try {
      const formattedDate = this.formatDate(date);
      console.log(`[SessionStorageService] Getting timer state for date: ${formattedDate}`);
      
      return sessionStorage.getTimerState(formattedDate);
    } catch (error) {
      console.error(`[SessionStorageService] Error getting timer state for date: ${date}:`, error);
      return null;
    }
  }

  /**
   * Format a date string to YYYY-MM-DD format
   */
  private formatDate(date: string): string {
    // If date already includes hyphens (YYYY-MM-DD), return as is
    if (date.includes('-') && date.split('-').length === 3) {
      return date
    }
    
    // Try to parse as date and format
    try {
      const parsedDate = new Date(date)
      const year = parsedDate.getFullYear()
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
      const day = String(parsedDate.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch (error) {
      console.error('Failed to parse date:', date)
      return date // Return original if parsing fails
    }
  }

  /**
   * Normalize a session object to ensure all required fields are present
   */
  private normalizeSession(session: any): Session {
    if (!session || typeof session !== 'object') {
      throw new Error('Invalid session data')
    }

    // Ensure date is in correct format
    const date = this.formatDate(session.date)

    return {
      ...session,
      date,
      status: session.status || 'planned',
      storyBlocks: session.storyBlocks || [],
      totalDuration: session.totalDuration || 0,
      lastUpdated: session.lastUpdated || new Date().toISOString()
    }
  }

  private getKey(date: string): string {
    return `${SESSION_PREFIX}${date}`
  }

  /**
   * Archive a session by setting its status to 'archived'
   */
  async archiveSession(date: string): Promise<boolean> {
    console.log(`[SessionStorageService] Archiving session for date: ${date}`)
    
    try {
      const session = await this.getSession(date)
      if (!session) {
        console.log(`[SessionStorageService] No session found for date: ${date} to archive`)
        return false
      }
      
      // Update the session status to archived
      const updatedSession: Session = {
        ...session,
        status: 'archived' as const
      }
      
      // Save the updated session
      await this.saveSession(date, updatedSession)
      console.log(`[SessionStorageService] Successfully archived session for date: ${date}`)
      return true
    } catch (error) {
      console.error(`[SessionStorageService] Error archiving session for date: ${date}:`, error)
      return false
    }
  }
}