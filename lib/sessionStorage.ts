import type { SessionPlan, TimeBox } from "./types"

export interface StoredSession extends SessionPlan {
  totalSessions: number
  startTime: string
  endTime: string
  status?: "planned" | "in-progress" | "completed"
}

const SESSION_PREFIX = 'session-'

export const sessionStorage = {
  /**
   * Save a session to localStorage
   */
  saveSession(date: string, session: StoredSession): void {
    try {
      localStorage.setItem(`${SESSION_PREFIX}${date}`, JSON.stringify(session))
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  },

  /**
   * Get a specific session from localStorage
   */
  getSession(date: string): StoredSession | null {
    try {
      const data = localStorage.getItem(`${SESSION_PREFIX}${date}`)
      if (!data) return null

      const session = JSON.parse(data)
      if (this.isValidSession(session)) {
        return this.normalizeSession(session)
      }
      return null
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  },

  /**
   * Get all sessions from localStorage
   */
  getAllSessions(): Record<string, StoredSession> {
    const sessions: Record<string, StoredSession> = {}
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(SESSION_PREFIX)) {
          const date = key.replace(SESSION_PREFIX, '')
          const session = this.getSession(date)
          if (session) {
            sessions[date] = session
          }
        }
      }
    } catch (error) {
      console.error('Failed to get all sessions:', error)
    }

    return sessions
  },

  /**
   * Delete a session from localStorage
   */
  deleteSession(date: string): void {
    try {
      localStorage.removeItem(`${SESSION_PREFIX}${date}`)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  },

  /**
   * Clear all sessions from localStorage
   */
  clearAllSessions(): void {
    try {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(SESSION_PREFIX)) {
          keys.push(key)
        }
      }
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear sessions:', error)
    }
  },

  /**
   * Validate session data structure
   */
  isValidSession(data: any): data is StoredSession {
    return (
      data &&
      Array.isArray(data.storyBlocks) &&
      typeof data.totalSessions === 'number' &&
      typeof data.startTime === 'string' &&
      typeof data.endTime === 'string'
    )
  },

  /**
   * Normalize session data to ensure consistent structure
   */
  normalizeSession(session: StoredSession): StoredSession {
    return {
      ...session,
      storyBlocks: session.storyBlocks.map(block => ({
        ...block,
        timeBoxes: Array.isArray(block.timeBoxes) ? block.timeBoxes : []
      }))
    }
  }
} 