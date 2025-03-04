import { LocalFirstDB } from '@/app/features/local-first-db/LocalFirstDB'
import type { 
  TodoWorkPlan, 
  TodoWorkPlanStatus, 
  TimeBoxStatus, 
  StoryBlock,
  TimeBoxTask,
  BaseStatus,
  TimeBox
} from '@/lib/types'

export class TodoWorkPlanDB extends LocalFirstDB<TodoWorkPlan> {
  constructor() {
    super({
      name: 'todo_workplans',
      storage: undefined, // Will use default IndexedDB
      syncInterval: 5000
    })
  }

  // Core CRUD operations
  async findByDate(date: string): Promise<TodoWorkPlan | null> {
    const doc = await this.get(date)
    return doc ? doc.data : null
  }

  async findAllWorkPlans(): Promise<TodoWorkPlan[]> {
    const docs = await this.getAll()
    return docs.map(doc => doc.data)
  }

  async upsertWorkPlan(workplan: TodoWorkPlan): Promise<TodoWorkPlan> {
    const updatedWorkPlan = {
      ...workplan,
      lastUpdated: new Date().toISOString()
    }
    return (await this.put(workplan.id, updatedWorkPlan)).data
  }

  async deleteWorkPlan(date: string): Promise<void> {
    await this.delete(date)
  }

  // Status updates
  async updateTaskStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    taskIndex: number,
    status: BaseStatus
  ): Promise<TodoWorkPlan | null> {
    const workplan = await this.findByDate(workplanId)
    if (!workplan) return null

    const updatedStoryBlocks = this.updateStoryBlocksWithTaskStatus(
      workplan.storyBlocks,
      storyId,
      timeBoxIndex,
      taskIndex,
      status
    )

    const updatedWorkPlan = {
      ...workplan,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateWorkPlanStatus(updatedStoryBlocks),
      lastUpdated: new Date().toISOString()
    }

    return this.upsertWorkPlan(updatedWorkPlan)
  }

  async updateTimeBoxStatus(
    workplanId: string,
    storyId: string,
    timeBoxIndex: number,
    status: TimeBoxStatus
  ): Promise<TodoWorkPlan | null> {
    const workplan = await this.findByDate(workplanId)
    if (!workplan) return null

    const updatedStoryBlocks = this.updateStoryBlocksWithTimeBoxStatus(
      workplan.storyBlocks,
      storyId,
      timeBoxIndex,
      status
    )

    const updatedWorkPlan = {
      ...workplan,
      storyBlocks: updatedStoryBlocks,
      status: this.calculateWorkPlanStatus(updatedStoryBlocks),
      lastUpdated: new Date().toISOString()
    }

    return this.upsertWorkPlan(updatedWorkPlan)
  }

  // Timer state management
  async updateTimerState(
    workplanId: string,
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<TodoWorkPlan | null> {
    const workplan = await this.findByDate(workplanId)
    if (!workplan) return null

    const updatedWorkPlan = {
      ...workplan,
      activeTimeBox,
      timeRemaining,
      isTimerRunning,
      lastUpdated: new Date().toISOString()
    }

    return this.upsertWorkPlan(updatedWorkPlan)
  }

  // Helper methods
  private calculateWorkPlanStatus(storyBlocks: StoryBlock[]): TodoWorkPlanStatus {
    const allWorkBoxes = storyBlocks.flatMap(story => 
      story.timeBoxes.filter(box => box.type === 'work')
    )
    
    if (allWorkBoxes.every(box => box.status === 'completed')) return 'completed'
    if (allWorkBoxes.some(box => box.status === 'in-progress' || box.status === 'completed')) return 'in-progress'
    return 'planned'
  }

  private calculateTimeBoxStatus(tasks: TimeBoxTask[]): TimeBoxStatus {
    if (tasks.every(task => task.status === 'completed')) return 'completed'
    if (tasks.some(task => task.status === 'completed')) return 'in-progress'
    return 'todo'
  }

  private calculateStoryProgress(timeBoxes: TimeBox[]): number {
    const workBoxes = timeBoxes.filter(box => box.type === 'work')
    const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed')
    return workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0
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
          
          const updatedTimeBoxes = [...story.timeBoxes]
          updatedTimeBoxes[timeBoxIndex] = {
            ...timeBox,
            tasks: updatedTasks,
            status: this.calculateTimeBoxStatus(updatedTasks)
          }
          
          return {
            ...story,
            timeBoxes: updatedTimeBoxes,
            progress: this.calculateStoryProgress(updatedTimeBoxes)
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
        
        return {
          ...story,
          timeBoxes: updatedTimeBoxes,
          progress: this.calculateStoryProgress(updatedTimeBoxes)
        }
      }
      return story
    })
  }
} 