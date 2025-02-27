import type { SessionPlan, TimeBox, TimeBoxTask, StoryBlock, SessionStatus, TimeBoxType, BaseStatus } from "./types"

export interface StoredSession extends SessionPlan {
  totalSessions: number
  startTime: string
  endTime: string
  status?: SessionStatus
  lastUpdated?: string // Add to track when session was last updated
  // Timer state persistence
  activeTimeBox?: { storyId: string; timeBoxIndex: number } | null
  timeRemaining?: number | null
  isTimerRunning?: boolean
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
      // Recalculate session status based on all timeboxes
      const allWorkBoxes = updatedStoryBlocks.flatMap(story => 
        story.timeBoxes.filter(box => box.type === 'work')
      )
      
      const allCompleted = allWorkBoxes.every(box => box.status === 'completed')
      const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress')
      const anyCompleted = allWorkBoxes.some(box => box.status === 'completed')
      
      let sessionStatus = session.status || 'planned'
      if (allCompleted) {
        sessionStatus = 'completed'
      } else if (anyInProgress || anyCompleted) {
        sessionStatus = 'in-progress'
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
  updateTaskStatus(date: string, storyId: string, timeBoxIndex: number, taskIndex: number, status: "todo" | "completed" | "mitigated"): boolean {
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
      // Recalculate session status based on all timeboxes
      const allWorkBoxes = updatedStoryBlocks.flatMap(story => 
        story.timeBoxes.filter(box => box.type === 'work')
      )
      
      const allCompleted = allWorkBoxes.every(box => box.status === 'completed')
      const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress')
      const anyCompleted = allWorkBoxes.some(box => box.status === 'completed')
      
      let sessionStatus = session.status || 'planned'
      if (allCompleted) {
        sessionStatus = 'completed'
      } else if (anyInProgress || anyCompleted) {
        sessionStatus = 'in-progress'
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
    // Check if data exists and is an object
    if (!data || typeof data !== 'object') {
      console.error('Invalid session: data is not an object', data);
      return false;
    }
    
    // Special case: If this is a timer-only state object without full session data
    if (data.activeTimeBox !== undefined && data.timeRemaining !== undefined && data.isTimerRunning !== undefined) {
      if (!data.storyBlocks) {
        // This is just timer state without the full session, which is valid for our timer persistence use case
        data.storyBlocks = [];
        data.totalSessions = data.totalSessions || 1;
        data.startTime = data.startTime || new Date().toISOString();
        data.endTime = data.endTime || new Date().toISOString();
        return true;
      }
    }
    
    // Check for minimal required properties
    if (!Array.isArray(data.storyBlocks)) {
      console.error('Invalid session: storyBlocks is not an array', data);
      return false;
    }
    
    // Set defaults for other properties if they're missing
    // This makes validation more fault-tolerant
    if (typeof data.totalSessions !== 'number') {
      console.warn('Session missing totalSessions, using default', data);
      data.totalSessions = 1;
    }
    
    if (typeof data.startTime !== 'string') {
      console.warn('Session missing startTime, using default', data);
      data.startTime = new Date().toISOString();
    }
    
    if (typeof data.endTime !== 'string') {
      console.warn('Session missing endTime, using default', data);
      data.endTime = new Date().toISOString();
    }
    
    return true;
  },

  /**
   * Get timer state for a session
   */
  getTimerState(date: string): { 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  } | null {
    try {
      // First try to get the session
      const session = this.getSession(date)
      
      if (session && session.activeTimeBox !== undefined) {
        // Session exists with timer state
        return {
          activeTimeBox: session.activeTimeBox,
          timeRemaining: session.timeRemaining || null,
          isTimerRunning: session.isTimerRunning || false
        }
      }
      
      // If timer state is not in the session, try to get it directly from localStorage
      // This handles the case where timer state might be stored separately
      try {
        const timerKey = `${SESSION_PREFIX}${date}-timer`
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
   * Save timer state for a session
   */
  saveTimerState(
    date: string, 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): boolean {
    try {
      // Try to get the existing session first
      const session = this.getSession(date)
      
      if (session) {
        // If session exists, update it with timer state
        const updatedSession = {
          ...session,
          activeTimeBox,
          timeRemaining,
          isTimerRunning,
          lastUpdated: new Date().toISOString()
        }
        
        this.saveSession(date, updatedSession)
      } else {
        // If no session exists, save timer state separately
        const timerKey = `${SESSION_PREFIX}${date}-timer`
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
   * Normalize session data to ensure consistent structure
   */
  normalizeSession(session: StoredSession): StoredSession {
    // Ensure storyBlocks exists and is an array
    const storyBlocks = Array.isArray(session.storyBlocks) ? session.storyBlocks : [];
    
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
      ...session,
      storyBlocks: normalizedStoryBlocks,
      status: session.status || 'planned',
      totalSessions: typeof session.totalSessions === 'number' ? session.totalSessions : 1,
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      lastUpdated: session.lastUpdated || session.startTime || new Date().toISOString(),
      // Initialize timer state properties if not present
      activeTimeBox: session.activeTimeBox || null,
      timeRemaining: session.timeRemaining || null,
      isTimerRunning: session.isTimerRunning || false
    };
  }
} 