/**
 * SessionStorageService Utility Class
 *
 * This utility class provides a higher-level interface for managing session data
 * using an underlying SessionDB instance. It encapsulates CRUD operations for sessions,
 * along with methods to update task and timebox statuses, manage timer state persistence,
 * and normalize session data. Key features include:
 *
 * - Retrieving, saving, and deleting sessions by date.
 * - Updating individual task and timebox statuses while recalculating overall progress.
 * - Persisting and retrieving timer state (active timebox, time remaining, and timer status).
 * - Normalizing session objects to ensure a consistent data structure.
 * - Creating a dummy session for development environments when no session is found.
 *
 * All session keys are formatted using a consistent date format (YYYY-MM-DD) with a common prefix.
 */

import type { 
  Session, 
  StoryBlock, 
  TimeBox, 
  TimeBoxTask,
  BaseStatus,
  TimeBoxStatus,
  SessionStatus
} from "@/lib/types"
import { SessionDB } from './session-db'

export class SessionStorageService {
  private db: SessionDB

  constructor() {
    // Instantiate the SessionDB to interact with persistent storage.
    this.db = new SessionDB()
  }

  /**
   * Get a session by date.
   *
   * This method retrieves a session from the database using a formatted date key.
   * If no session is found and the environment is not production, it creates a dummy session.
   *
   * @param date - A date string (e.g., "2025-02-27") used as the session key.
   * @returns A normalized session object or null if not found.
   */
  async getSession(date: string): Promise<Session | null> {
    console.log(`[SessionStorageService] Getting session for date: ${date}`)
    const formattedDate = this.formatDate(date)
    
    try {
      const session = await this.db.findOne(formattedDate)
      
      if (!session) {
        console.log(`[SessionStorageService] No session found for date: ${formattedDate}`)
        
        // For development only: if no session exists, create and save a dummy session.
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[SessionStorageService] Creating dummy session for development`)
          const dummySession = this.createDummySession(date)
          await this.saveSession(date, dummySession)
          return dummySession
        }
        
        return null
      }
      
      console.log(`[SessionStorageService] Found session for date: ${formattedDate} with ${session.storyBlocks?.length || 0} story blocks`)
      return this.normalizeSession(session)
    } catch (error) {
      console.error(`[SessionStorageService] Error getting session for date: ${formattedDate}:`, error)
      return null
    }
  }

  /**
   * Get all sessions.
   *
   * Iterates over all keys in the database and retrieves sessions that match the session key prefix.
   *
   * @returns An array of normalized session objects.
   */
  async getAllSessions(): Promise<Session[]> {
    console.log(`[SessionStorageService] Getting all sessions`)
    
    try {
      const sessions = await this.db.findAll()
      console.log(`[SessionStorageService] Found ${sessions.length} sessions`)
      return sessions.map(session => this.normalizeSession(session))
    } catch (error) {
      console.error(`[SessionStorageService] Error getting all sessions:`, error)
      return []
    }
  }

  /**
   * Save a session.
   *
   * Updates the session's lastUpdated timestamp and then stores it using an upsert operation.
   * After saving, it verifies that the session exists.
   *
   * @param date - The session key (date string).
   * @param session - The session object to save.
   */
  async saveSession(date: string, session: Session): Promise<void> {
    const formattedDate = this.formatDate(date)
    console.log(`[SessionStorageService] Saving session for date: ${formattedDate} with ${session.storyBlocks?.length || 0} story blocks`)
    
    try {
      const sessionData = {
        ...session,
        lastUpdated: new Date().toISOString()
      }
      
      await this.db.upsert(formattedDate, sessionData)
      
      // Verify the session was successfully saved.
      const saved = await this.db.exists(formattedDate)
      if (!saved) {
        console.error(`[SessionStorageService] Failed to verify session save for date: ${formattedDate}`)
        throw new Error('Failed to verify session save')
      }
      
      console.log(`[SessionStorageService] Successfully saved and verified session for date: ${formattedDate}`)
    } catch (error) {
      console.error(`[SessionStorageService] Error saving session for date: ${formattedDate}:`, error)
      throw error
    }
  }

  /**
   * Delete a session.
   *
   * Removes a session from the database using the formatted date key.
   *
   * @param date - The session key (date string) to delete.
   */
  async deleteSession(date: string): Promise<void> {
    const formattedDate = this.formatDate(date)
    try {
      await this.db.delete(formattedDate)
      console.log(`[SessionStorageService] Deleted session for date: ${formattedDate}`)
    } catch (error) {
      console.error(`[SessionStorageService] Error deleting session for date: ${formattedDate}:`, error)
      throw error
    }
  }

  /**
   * Update task status.
   *
   * Updates the status of a specific task within a timebox in a session.
   *
   * @param date - The session key.
   * @param storyId - The ID of the story containing the task.
   * @param timeBoxIndex - The index of the timebox within the story.
   * @param taskIndex - The index of the task within the timebox.
   * @param status - The new status for the task (todo, completed, or mitigated).
   * @returns A boolean indicating whether the update was successful.
   */
  async updateTaskStatus(
    date: string,
    storyId: string | undefined,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<boolean> {
    if (!storyId) {
      console.error("Cannot update task status: storyId is undefined")
      return false
    }

    console.log(`[SessionStorageService] Updating task status in session ${date}, story ${storyId}, timeBox ${timeBoxIndex}, task ${taskIndex} to ${status}`)
    
    try {
      const updatedSession = await this.db.updateTaskStatus(date, storyId, timeBoxIndex, taskIndex, status)
      return !!updatedSession
    } catch (error) {
      console.error(`[SessionStorageService] Error updating task status:`, error)
      return false
    }
  }

  /**
   * Update timebox status.
   *
   * Updates the status of a specific timebox in a session.
   *
   * @param date - The session key.
   * @param storyId - The ID of the story containing the timebox.
   * @param timeBoxIndex - The index of the timebox.
   * @param status - The new status for the timebox.
   * @returns A boolean indicating whether the update was successful.
   */
  async updateTimeBoxStatus(
    date: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<boolean> {
    try {
      const updatedSession = await this.db.updateTimeBoxStatus(date, storyId, timeBoxIndex, status)
      return !!updatedSession
    } catch (error) {
      console.error(`[SessionStorageService] Error updating timebox status:`, error)
      return false
    }
  }

  /**
   * Get timer state.
   *
   * Retrieves the timer state (active timebox, remaining time, and running status)
   * from the session corresponding to the given date.
   *
   * @param date - The session key.
   * @returns An object with timer state data or null if not found.
   */
  async getTimerState(date: string): Promise<{ 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  } | null> {
    const formattedDate = this.formatDate(date)
    
    try {
      const session = await this.db.findOne(formattedDate)
      if (!session) return null
      
      return {
        activeTimeBox: session.activeTimeBox || null,
        timeRemaining: session.timeRemaining || null,
        isTimerRunning: session.isTimerRunning || false
      }
    } catch (error) {
      console.error(`[SessionStorageService] Error getting timer state:`, error)
      return null
    }
  }

  /**
   * Save timer state.
   *
   * Persists the current timer state into the session for the given date.
   *
   * @param date - The session key.
   * @param activeTimeBox - The currently active time box.
   * @param timeRemaining - The remaining time in the active time box.
   * @param isTimerRunning - Whether the timer is running.
   * @returns A boolean indicating whether the save operation was successful.
   */
  async saveTimerState(
    date: string, 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    const formattedDate = this.formatDate(date)
    
    try {
      const session = await this.db.findOne(formattedDate)
      if (!session) return false

      const updatedSession = {
        ...session,
        activeTimeBox,
        timeRemaining,
        isTimerRunning,
        lastUpdated: new Date().toISOString()
      }

      await this.db.upsert(formattedDate, updatedSession)
      return true
    } catch (error) {
      console.error(`[SessionStorageService] Error saving timer state:`, error)
      return false
    }
  }

  /**
   * Format a date string to a consistent format (YYYY-MM-DD).
   *
   * @param date - The input date string.
   * @returns The formatted date string.
   */
  private formatDate(date: string): string {
    return date.replace(/\//g, '-')
  }

  /**
   * Normalize a session object.
   *
   * Ensures that all required fields are present and returns a standardized session object.
   *
   * @param session - The session data to normalize.
   * @returns A normalized session.
   */
  private normalizeSession(session: any): Session {
    return {
      date: session.date,
      storyBlocks: session.storyBlocks || [],
      status: (session.status as SessionStatus) || 'planned',
      totalDuration: session.totalDuration || 0,
      lastUpdated: session.lastUpdated || new Date().toISOString(),
      activeTimeBox: session.activeTimeBox || null,
      timeRemaining: session.timeRemaining || null,
      isTimerRunning: session.isTimerRunning || false
    }
  }

  /**
   * Create a dummy session for development environments.
   *
   * This method creates an empty session with default values, which is useful
   * when testing in non-production environments.
   *
   * @param date - The session key.
   * @returns A dummy session object.
   */
  private createDummySession(date: string): Session {
    return {
      date,
      storyBlocks: [],
      status: 'planned',
      totalDuration: 0,
      lastUpdated: new Date().toISOString(),
      activeTimeBox: null,
      timeRemaining: null,
      isTimerRunning: false
    }
  }
}
