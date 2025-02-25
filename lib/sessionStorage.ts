import type { SessionPlan, TimeBox, TimeBoxTask, StoryBlock } from "./types"

export interface StoredSession extends SessionPlan {
  totalSessions: number
  startTime: string
  endTime: string
  status?: "planned" | "in-progress" | "completed"
  lastUpdated?: string // Add to track when session was last updated
}

const SESSION_PREFIX = 'session-'

export const sessionStorage = {
  /**
   * Save a session to localStorage
   */
  saveSession(date: string, session: StoredSession): void {
    try {
      // Always update lastUpdated timestamp when saving
      const updatedSession = {
        ...session,
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(`${SESSION_PREFIX}${date}`, JSON.stringify(updatedSession))
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
   * Update the completion status of a specific timebox in a session
   */
  updateTimeBoxStatus(date: string, storyId: string, timeBoxIndex: number, status: "todo" | "completed" | "in-progress"): boolean {
    const session = this.getSession(date)
    if (!session) return false

    let updated = false
    const updatedStoryBlocks = session.storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        updated = true
        const updatedTimeBoxes = [...story.timeBoxes]
        updatedTimeBoxes[timeBoxIndex] = {
          ...updatedTimeBoxes[timeBoxIndex],
          status
        }
        
        // Recalculate story progress
        const totalWorkBoxes = updatedTimeBoxes.filter(box => box.type === 'work').length
        const completedWorkBoxes = updatedTimeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length
        const progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
        
        return {
          ...story,
          timeBoxes: updatedTimeBoxes,
          progress
        }
      }
      return story
    })

    if (updated) {
      // Update session status if needed
      let sessionStatus = session.status || "planned"
      
      // Check if all time boxes are completed
      const allCompleted = updatedStoryBlocks.every(story => 
        story.timeBoxes.filter(box => box.type === 'work').every(box => box.status === 'completed')
      )
      
      // Check if any time box is in progress
      const anyInProgress = updatedStoryBlocks.some(story => 
        story.timeBoxes.some(box => box.status === 'in-progress')
      )
      
      if (allCompleted) {
        sessionStatus = "completed"
      } else if (anyInProgress) {
        sessionStatus = "in-progress"
      }
      
      const updatedSession = {
        ...session,
        storyBlocks: updatedStoryBlocks,
        status: sessionStatus
      }
      
      this.saveSession(date, updatedSession)
    }
    
    return updated
  },

  /**
   * Update task status within a time box
   */
  updateTaskStatus(date: string, storyId: string, timeBoxIndex: number, taskIndex: number, status: "todo" | "completed"): boolean {
    const session = this.getSession(date)
    if (!session) return false

    let updated = false
    const updatedStoryBlocks = session.storyBlocks.map(story => {
      if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
        const timeBox = story.timeBoxes[timeBoxIndex]
        if (timeBox.tasks && timeBox.tasks[taskIndex]) {
          updated = true
          const updatedTasks = [...timeBox.tasks]
          updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            status
          }
          
          // Check if all tasks in the time box are completed
          const allTasksCompleted = updatedTasks.every(task => task.status === 'completed')
          
          const updatedTimeBoxes = [...story.timeBoxes]
          updatedTimeBoxes[timeBoxIndex] = {
            ...timeBox,
            tasks: updatedTasks,
            status: allTasksCompleted ? 'completed' : timeBox.status || 'todo'
          }
          
          // Recalculate story progress
          const totalWorkBoxes = updatedTimeBoxes.filter(box => box.type === 'work').length
          const completedWorkBoxes = updatedTimeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length
          const progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
          
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
      const updatedSession = {
        ...session,
        storyBlocks: updatedStoryBlocks
      }
      
      this.saveSession(date, updatedSession)
    }
    
    return updated
  },

  /**
   * Calculate and update progress for all stories in a session
   */
  updateSessionProgress(date: string): boolean {
    const session = this.getSession(date)
    if (!session) return false

    const updatedStoryBlocks = session.storyBlocks.map(story => {
      const totalWorkBoxes = story.timeBoxes.filter(box => box.type === 'work').length
      const completedWorkBoxes = story.timeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length
      const progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
      
      return {
        ...story,
        progress
      }
    })
    
    // Update session status if needed
    let sessionStatus = session.status || "planned"
    
    // Check if all time boxes are completed
    const allCompleted = updatedStoryBlocks.every(story => 
      story.timeBoxes.filter(box => box.type === 'work').every(box => box.status === 'completed')
    )
    
    // Check if any time box is in progress
    const anyInProgress = updatedStoryBlocks.some(story => 
      story.timeBoxes.some(box => box.status === 'in-progress')
    )
    
    if (allCompleted) {
      sessionStatus = "completed"
    } else if (anyInProgress) {
      sessionStatus = "in-progress"
    }
    
    const updatedSession = {
      ...session,
      storyBlocks: updatedStoryBlocks,
      status: sessionStatus
    }
    
    this.saveSession(date, updatedSession)
    return true
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
    // Ensure all story blocks have a progress property
    const normalizedStoryBlocks = session.storyBlocks.map(block => {
      // Ensure timeBoxes is an array
      const timeBoxes = Array.isArray(block.timeBoxes) ? block.timeBoxes : []
      
      // Ensure all timeBoxes have a status property
      const normalizedTimeBoxes = timeBoxes.map(box => ({
        ...box,
        status: box.status || 'todo',
        tasks: Array.isArray(box.tasks) ? box.tasks.map(task => ({
          ...task,
          status: task.status || 'todo'
        })) : []
      }))
      
      // Calculate progress if not present
      let progress = block.progress
      if (progress === undefined || progress === null) {
        const totalWorkBoxes = normalizedTimeBoxes.filter(box => box.type === 'work').length
        const completedWorkBoxes = normalizedTimeBoxes.filter(box => box.type === 'work' && box.status === 'completed').length
        progress = totalWorkBoxes > 0 ? Math.round((completedWorkBoxes / totalWorkBoxes) * 100) : 0
      }
      
      return {
        ...block,
        timeBoxes: normalizedTimeBoxes,
        progress,
        taskIds: block.taskIds || []
      }
    })
    
    return {
      ...session,
      storyBlocks: normalizedStoryBlocks,
      status: session.status || 'planned',
      lastUpdated: session.lastUpdated || session.startTime
    }
  }
} 