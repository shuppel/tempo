import { LocalFirstDB } from '@/app/features/local-first-db/LocalFirstDB'
import type { 
  Session, 
  SessionStatus, 
  TimeBoxStatus, 
  StoryBlock,
  TimeBoxTask,
  BaseStatus,
  TimeBox
} from '@/lib/types'
import type { LocalDocument, DocumentId } from '@/app/features/local-first-db/types'

export class SessionDB extends LocalFirstDB<Session> {
  constructor() {
    super({
      name: 'sessions',
      storage: undefined, // Will use default IndexedDB
      syncInterval: 5000
    })
  }

  // PostgreSQL-like query methods
  async findOne(date: string): Promise<Session | null> {
    const doc = await this.get(date)
    return doc ? doc.data : null
  }

  async findAll(): Promise<Session[]> {
    const docs = await this.getAll()
    return docs.map(doc => doc.data)
  }

  async findByStatus(status: SessionStatus): Promise<Session[]> {
    const docs = await this.getAll()
    return docs
      .map(doc => doc.data)
      .filter(session => session.status === status)
  }

  async findBetweenDates(startDate: string, endDate: string): Promise<Session[]> {
    const docs = await this.getAll()
    return docs
      .map(doc => doc.data)
      .filter(session => 
        session.date >= startDate && session.date <= endDate
      )
  }

  async upsert(date: string, session: Session): Promise<Session> {
    const doc = await this.put(date, session)
    return doc.data
  }

  async delete(date: string): Promise<void> {
    await super.delete(date)
  }

  // Additional PostgreSQL-like methods
  async count(): Promise<number> {
    const docs = await this.getAll()
    return docs.length
  }

  async exists(date: string): Promise<boolean> {
    const doc = await this.get(date)
    return doc !== null
  }

  async findLatest(limit: number = 1): Promise<Session[]> {
    const docs = await this.getAll()
    return docs
      .map(doc => doc.data)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  }

  // Session-specific operations
  async updateStatus(date: string, status: SessionStatus): Promise<Session | null> {
    const doc = await this.get(date)
    if (!doc) return null

    const updatedSession = {
      ...doc.data,
      status,
      lastUpdated: new Date().toISOString()
    }

    const updatedDoc = await this.put(date, updatedSession)
    return updatedDoc.data
  }

  // Task management methods
  async updateTaskStatus(
    date: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<Session | null> {
    const session = await this.findOne(date)
    if (!session) return null

    const updatedStoryBlocks = this.updateStoryBlocksWithTaskStatus(
      session.storyBlocks,
      storyId,
      timeBoxIndex,
      taskIndex,
      status
    )

    const updatedSession = {
      ...session,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateSessionStatus(updatedStoryBlocks),
      lastUpdated: new Date().toISOString()
    }

    return (await this.upsert(date, updatedSession))
  }

  async updateTimeBoxStatus(
    date: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<Session | null> {
    const session = await this.findOne(date)
    if (!session) return null

    const updatedStoryBlocks = this.updateStoryBlocksWithTimeBoxStatus(
      session.storyBlocks,
      storyId,
      timeBoxIndex,
      status
    )

    const updatedSession = {
      ...session,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateSessionStatus(updatedStoryBlocks),
      lastUpdated: new Date().toISOString()
    }

    return (await this.upsert(date, updatedSession))
  }

  // Transaction-like batch operations
  async batchUpdate(updates: Array<{ date: string; session: Partial<Session> }>): Promise<Session[]> {
    const results: Session[] = []
    
    for (const update of updates) {
      const doc = await this.get(update.date)
      if (doc) {
        const updatedSession = {
          ...doc.data,
          ...update.session,
          lastUpdated: new Date().toISOString()
        }
        const updatedDoc = await this.put(update.date, updatedSession)
        results.push(updatedDoc.data)
      }
    }

    return results
  }

  // Helper methods
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

  private calculateTimeBoxStatus(tasks: TimeBoxTask[]): TimeBoxStatus {
    const allTasksCompleted = tasks.every(task => task.status === 'completed')
    const anyTaskCompleted = tasks.some(task => task.status === 'completed')
    
    if (allTasksCompleted) return 'completed'
    if (anyTaskCompleted) return 'in-progress'
    return 'todo'
  }

  private updateStoryBlocksWithTaskStatus(
    storyBlocks: StoryBlock[],
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
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

  private calculateStoryProgress(timeBoxes: TimeBox[]): number {
    const workBoxes = timeBoxes.filter(box => box.type === 'work')
    const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
    return workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
  }
} 