import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TodoWorkPlanDB } from '../workplan-db'
import { LocalFirstDB } from '../../../local-first-db/LocalFirstDB'
import { createStorageAdapter } from '../../../local-first-db/adapters'
import type { TodoWorkPlan, BaseStatus, TimeBoxStatus, TimeBoxTask } from '@/lib/types'

// Mock LocalFirstDB and storage adapter
vi.mock('../../../local-first-db/LocalFirstDB')
vi.mock('../../../local-first-db/adapters')

describe('TodoWorkPlanDB', () => {
  let db: TodoWorkPlanDB
  let mockGet: ReturnType<typeof vi.fn>
  let mockGetAll: ReturnType<typeof vi.fn>
  let mockPut: ReturnType<typeof vi.fn>
  let mockDelete: ReturnType<typeof vi.fn>

  const mockTask: TimeBoxTask = {
    title: 'Test Task',
    status: 'todo',
    duration: 25
  }

  const mockWorkPlan: TodoWorkPlan = {
    id: '2024-03-20',
    storyBlocks: [{
      id: 'story1',
      title: 'Test Story',
      timeBoxes: [{
        type: 'work',
        duration: 25,
        status: 'todo',
        tasks: [mockTask]
      }],
      progress: 0,
      totalDuration: 25,
      taskIds: []
    }],
    status: 'planned',
    totalDuration: 25,
    startTime: '2024-03-20T09:00:00Z',
    endTime: '2024-03-20T10:00:00Z',
    lastUpdated: '2024-03-20T09:00:00Z',
    activeTimeBox: null,
    timeRemaining: null,
    isTimerRunning: false
  }

  beforeEach(() => {
    mockGet = vi.fn()
    mockGetAll = vi.fn()
    mockPut = vi.fn()
    mockDelete = vi.fn()

    // Mock the LocalFirstDB methods we use
    const mockLocalFirstDB = {
      get: mockGet,
      getAll: mockGetAll,
      put: mockPut,
      delete: mockDelete
    }
    
    vi.mocked(LocalFirstDB).mockImplementation(function(this: any) {
      Object.assign(this, mockLocalFirstDB)
      return this
    })
    
    // Mock storage adapter creation
    vi.mocked(createStorageAdapter).mockReturnValue({} as any)

    db = new TodoWorkPlanDB()
  })

  describe('findByDate', () => {
    it('should return workplan when found', async () => {
      mockGet.mockResolvedValue({ data: mockWorkPlan })
      
      const result = await db.findByDate('2024-03-20')
      
      expect(result).toEqual(mockWorkPlan)
      expect(mockGet).toHaveBeenCalledWith('2024-03-20')
    })

    it('should return null when workplan not found', async () => {
      mockGet.mockResolvedValue(null)
      
      const result = await db.findByDate('2024-03-20')
      
      expect(result).toBeNull()
    })
  })

  describe('findAllWorkPlans', () => {
    it('should return all workplans', async () => {
      mockGetAll.mockResolvedValue([{ data: mockWorkPlan }])
      
      const result = await db.findAllWorkPlans()
      
      expect(result).toEqual([mockWorkPlan])
    })

    it('should return empty array when no workplans exist', async () => {
      mockGetAll.mockResolvedValue([])
      
      const result = await db.findAllWorkPlans()
      
      expect(result).toEqual([])
    })
  })

  describe('upsertWorkPlan', () => {
    it('should update workplan with timestamp', async () => {
      const now = '2024-03-20T10:00:00Z'
      vi.setSystemTime(new Date(now))

      mockPut.mockResolvedValue({ data: { ...mockWorkPlan, lastUpdated: now } })
      
      const result = await db.upsertWorkPlan(mockWorkPlan)
      
      expect(result.lastUpdated).toBe(now)
      expect(mockPut).toHaveBeenCalledWith(mockWorkPlan.id, {
        ...mockWorkPlan,
        lastUpdated: now
      })

      vi.useRealTimers()
    })
  })

  describe('updateTaskStatus', () => {
    const updateParams = {
      workplanId: '2024-03-20',
      storyId: 'story1',
      timeBoxIndex: 0,
      taskIndex: 0,
      status: 'completed' as BaseStatus
    }

    it('should update task status successfully', async () => {
      mockGet.mockResolvedValue({ data: mockWorkPlan })
      mockPut.mockImplementation((id: string, data: TodoWorkPlan) => ({ data }))
      
      const result = await db.updateTaskStatus(
        updateParams.workplanId,
        updateParams.storyId,
        updateParams.timeBoxIndex,
        updateParams.taskIndex,
        updateParams.status
      )
      
      expect(result).not.toBeNull()
      expect(result?.storyBlocks[0].timeBoxes[0].tasks?.[0].status).toBe('completed')
    })

    it('should return null when workplan not found', async () => {
      mockGet.mockResolvedValue(null)
      
      const result = await db.updateTaskStatus(
        updateParams.workplanId,
        updateParams.storyId,
        updateParams.timeBoxIndex,
        updateParams.taskIndex,
        updateParams.status
      )
      
      expect(result).toBeNull()
    })
  })

  describe('updateTimeBoxStatus', () => {
    const updateParams = {
      workplanId: '2024-03-20',
      storyId: 'story1',
      timeBoxIndex: 0,
      status: 'completed' as TimeBoxStatus
    }

    it('should update timebox status successfully', async () => {
      mockGet.mockResolvedValue({ data: mockWorkPlan })
      mockPut.mockImplementation((id: string, data: TodoWorkPlan) => ({ data }))
      
      const result = await db.updateTimeBoxStatus(
        updateParams.workplanId,
        updateParams.storyId,
        updateParams.timeBoxIndex,
        updateParams.status
      )
      
      expect(result).not.toBeNull()
      expect(result?.storyBlocks[0].timeBoxes[0].status).toBe('completed')
    })

    it('should return null when workplan not found', async () => {
      mockGet.mockResolvedValue(null)
      
      const result = await db.updateTimeBoxStatus(
        updateParams.workplanId,
        updateParams.storyId,
        updateParams.timeBoxIndex,
        updateParams.status
      )
      
      expect(result).toBeNull()
    })
  })

  describe('updateTimerState', () => {
    const updateParams = {
      workplanId: '2024-03-20',
      activeTimeBox: { storyId: 'story1', timeBoxIndex: 0 },
      timeRemaining: 1500,
      isTimerRunning: true
    }

    it('should update timer state successfully', async () => {
      mockGet.mockResolvedValue({ data: mockWorkPlan })
      mockPut.mockImplementation((id: string, data: TodoWorkPlan) => ({ data }))
      
      const result = await db.updateTimerState(
        updateParams.workplanId,
        updateParams.activeTimeBox,
        updateParams.timeRemaining,
        updateParams.isTimerRunning
      )
      
      expect(result).not.toBeNull()
      expect(result?.activeTimeBox).toEqual(updateParams.activeTimeBox)
      expect(result?.timeRemaining).toBe(updateParams.timeRemaining)
      expect(result?.isTimerRunning).toBe(updateParams.isTimerRunning)
    })

    it('should return null when workplan not found', async () => {
      mockGet.mockResolvedValue(null)
      
      const result = await db.updateTimerState(
        updateParams.workplanId,
        updateParams.activeTimeBox,
        updateParams.timeRemaining,
        updateParams.isTimerRunning
      )
      
      expect(result).toBeNull()
    })
  })
}) 