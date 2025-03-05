import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkPlanStorageService } from '../workplan-storage.service'
import { TodoWorkPlanDB } from '../workplan-db'
import { TodoWorkPlan, TimeBoxTask, StoryBlock, BaseStatus, TimeBoxStatus, TodoWorkPlanStatus } from '@lib/types'

vi.mock('../workplan-db', () => ({
  TodoWorkPlanDB: vi.fn().mockImplementation(() => ({
    findByDate: vi.fn(),
    findAllWorkPlans: vi.fn(),
    upsertWorkPlan: vi.fn().mockImplementation((workplan: TodoWorkPlan) => Promise.resolve(workplan)),
    deleteWorkPlan: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTimeBoxStatus: vi.fn(),
    updateTimerState: vi.fn(),
    destroy: vi.fn()
  }))
}))

describe('WorkPlanStorageService', () => {
  let service: WorkPlanStorageService
  let mockWorkPlan: TodoWorkPlan
  let mockDB: jest.Mocked<TodoWorkPlanDB>
  const today = new Date().toISOString().split('T')[0]

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WorkPlanStorageService()
    mockDB = (service as any).db
    mockWorkPlan = {
      id: today,
      storyBlocks: [
        {
          id: '1',
          title: 'Test Story Block',
          timeBoxes: [
            {
              type: 'work',
              duration: 60,
              tasks: [
                {
                  title: 'Test Task',
                  duration: 30,
                  status: 'in-progress'
                } as TimeBoxTask
              ],
              status: 'in-progress'
            }
          ],
          totalDuration: 60,
          progress: 0,
          taskIds: ['1']
        } as StoryBlock
      ],
      status: 'in-progress',
      totalDuration: 60,
      startTime: today + 'T09:00:00Z',
      endTime: today + 'T10:00:00Z',
      lastUpdated: today + 'T09:00:00Z',
      activeTimeBox: null,
      timeRemaining: null,
      isTimerRunning: false
    }
  })

  afterEach(() => {
    if (service) {
      service.destroy()
    }
  })

  describe('constructor', () => {
    it('should create a new instance with default options', () => {
      const newService = new WorkPlanStorageService()
      expect(newService).toBeInstanceOf(WorkPlanStorageService)
      expect(TodoWorkPlanDB).toHaveBeenCalled()
    })

    it('should initialize the database', () => {
      const newService = new WorkPlanStorageService()
      expect((newService as any).db).toBeDefined()
      expect((newService as any).db).toBeInstanceOf(TodoWorkPlanDB)
    })
  })

  describe('destroy', () => {
    it('should cleanup resources', () => {
      service.destroy()
      expect(mockDB.destroy).toHaveBeenCalled()
    })

    it('should handle multiple destroy calls', () => {
      service.destroy()
      service.destroy()
      expect(mockDB.destroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getWorkPlan', () => {
    it('should retrieve a workplan by date', async () => {
      mockDB.findByDate.mockResolvedValue(mockWorkPlan)

      const retrieved = await service.getWorkPlan(today)

      expect(retrieved).toEqual(mockWorkPlan)
      expect(mockDB.findByDate).toHaveBeenCalledWith(today)
    })

    it('should return null when workplan not found', async () => {
      mockDB.findByDate.mockResolvedValue(null)

      const retrieved = await service.getWorkPlan(today)

      expect(retrieved).toBeNull()
      expect(mockDB.findByDate).toHaveBeenCalledWith(today)
    })

    it('should handle errors and return null', async () => {
      mockDB.findByDate.mockRejectedValue(new Error('DB Error'))

      const retrieved = await service.getWorkPlan(today)

      expect(retrieved).toBeNull()
      expect(mockDB.findByDate).toHaveBeenCalledWith(today)
    })

    it('should handle invalid date format', async () => {
      const invalidDate = 'invalid-date'
      mockDB.findByDate.mockResolvedValue(null)

      const retrieved = await service.getWorkPlan(invalidDate)

      expect(retrieved).toBeNull()
      expect(mockDB.findByDate).toHaveBeenCalledWith(invalidDate)
    })
  })

  describe('getAllWorkPlans', () => {
    it('should retrieve all workplans', async () => {
      mockDB.findAllWorkPlans.mockResolvedValue([mockWorkPlan])

      const workplans = await service.getAllWorkPlans()

      expect(workplans).toContainEqual(mockWorkPlan)
      expect(mockDB.findAllWorkPlans).toHaveBeenCalled()
    })

    it('should return empty array when no workplans found', async () => {
      mockDB.findAllWorkPlans.mockResolvedValue([])

      const workplans = await service.getAllWorkPlans()

      expect(workplans).toEqual([])
      expect(mockDB.findAllWorkPlans).toHaveBeenCalled()
    })

    it('should handle errors and return empty array', async () => {
      mockDB.findAllWorkPlans.mockRejectedValue(new Error('DB Error'))

      const workplans = await service.getAllWorkPlans()

      expect(workplans).toEqual([])
      expect(mockDB.findAllWorkPlans).toHaveBeenCalled()
    })
  })

  describe('saveWorkPlan', () => {
    it('should save workplan successfully', async () => {
      mockDB.upsertWorkPlan.mockResolvedValue(mockWorkPlan)

      await expect(service.saveWorkPlan(mockWorkPlan)).resolves.not.toThrow()
      expect(mockDB.upsertWorkPlan).toHaveBeenCalledWith(mockWorkPlan)
    })

    it('should throw error when save fails', async () => {
      mockDB.upsertWorkPlan.mockRejectedValue(new Error('DB Error'))

      await expect(service.saveWorkPlan(mockWorkPlan)).rejects.toThrow('DB Error')
      expect(mockDB.upsertWorkPlan).toHaveBeenCalledWith(mockWorkPlan)
    })

    it('should handle workplan with missing required fields', async () => {
      const invalidWorkPlan = { ...mockWorkPlan, id: undefined } as any

      await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow()
      expect(mockDB.upsertWorkPlan).not.toHaveBeenCalled()
    })

    it('should handle workplan with invalid status', async () => {
      const invalidWorkPlan = { ...mockWorkPlan, status: 'invalid-status' } as any

      await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow()
      expect(mockDB.upsertWorkPlan).not.toHaveBeenCalled()
    })
  })

  describe('deleteWorkPlan', () => {
    it('should delete workplan successfully', async () => {
      mockDB.deleteWorkPlan.mockResolvedValue()

      await expect(service.deleteWorkPlan(today)).resolves.not.toThrow()
      expect(mockDB.deleteWorkPlan).toHaveBeenCalledWith(today)
    })

    it('should throw error when delete fails', async () => {
      mockDB.deleteWorkPlan.mockRejectedValue(new Error('DB Error'))

      await expect(service.deleteWorkPlan(today)).rejects.toThrow('DB Error')
      expect(mockDB.deleteWorkPlan).toHaveBeenCalledWith(today)
    })

    it('should handle invalid date format', async () => {
      const invalidDate = 'invalid-date'

      await expect(service.deleteWorkPlan(invalidDate)).resolves.not.toThrow()
      expect(mockDB.deleteWorkPlan).toHaveBeenCalledWith(invalidDate)
    })
  })

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      mockDB.updateTaskStatus.mockResolvedValue(mockWorkPlan)

      const result = await service.updateTaskStatus(
        today,
        '1',
        0,
        0,
        'completed' as BaseStatus
      )

      expect(result).toBe(true)
      expect(mockDB.updateTaskStatus).toHaveBeenCalledWith(
        today,
        '1',
        0,
        0,
        'completed'
      )
    })

    it('should handle null response when updating task status', async () => {
      mockDB.updateTaskStatus.mockResolvedValue(null)

      const result = await service.updateTaskStatus(
        today,
        '1',
        0,
        0,
        'completed' as BaseStatus
      )

      expect(result).toBe(false)
    })

    it('should handle errors when updating task status', async () => {
      mockDB.updateTaskStatus.mockRejectedValue(new Error('DB Error'))

      const result = await service.updateTaskStatus(
        today,
        '1',
        0,
        0,
        'completed' as BaseStatus
      )

      expect(result).toBe(false)
    })

    it('should handle invalid task status', async () => {
      const result = await service.updateTaskStatus(
        today,
        '1',
        0,
        0,
        'invalid-status' as BaseStatus
      )

      expect(result).toBe(false)
      expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
    })

    it('should handle invalid story ID', async () => {
      mockDB.updateTaskStatus.mockResolvedValue(null)

      const result = await service.updateTaskStatus(
        today,
        'invalid-story',
        0,
        0,
        'completed' as BaseStatus
      )

      expect(result).toBe(false)
    })

    it('should handle invalid timebox index', async () => {
      mockDB.updateTaskStatus.mockResolvedValue(null)

      const result = await service.updateTaskStatus(
        today,
        '1',
        999,
        0,
        'completed' as BaseStatus
      )

      expect(result).toBe(false)
    })

    it('should handle invalid task index', async () => {
      mockDB.updateTaskStatus.mockResolvedValue(null)

      const result = await service.updateTaskStatus(
        today,
        '1',
        0,
        999,
        'completed' as BaseStatus
      )

      expect(result).toBe(false)
    })
  })

  describe('updateTimeBoxStatus', () => {
    it('should update timebox status successfully', async () => {
      mockDB.updateTimeBoxStatus.mockResolvedValue(mockWorkPlan)

      const result = await service.updateTimeBoxStatus(
        today,
        '1',
        0,
        'completed' as TimeBoxStatus
      )

      expect(result).toBe(true)
      expect(mockDB.updateTimeBoxStatus).toHaveBeenCalledWith(
        today,
        '1',
        0,
        'completed'
      )
    })

    it('should handle null response when updating timebox status', async () => {
      mockDB.updateTimeBoxStatus.mockResolvedValue(null)

      const result = await service.updateTimeBoxStatus(
        today,
        '1',
        0,
        'completed' as TimeBoxStatus
      )

      expect(result).toBe(false)
    })

    it('should handle errors when updating timebox status', async () => {
      mockDB.updateTimeBoxStatus.mockRejectedValue(new Error('DB Error'))

      const result = await service.updateTimeBoxStatus(
        today,
        '1',
        0,
        'completed' as TimeBoxStatus
      )

      expect(result).toBe(false)
    })

    it('should handle invalid timebox status', async () => {
      const result = await service.updateTimeBoxStatus(
        today,
        '1',
        0,
        'invalid-status' as TimeBoxStatus
      )

      expect(result).toBe(false)
      expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
    })

    it('should handle invalid story ID', async () => {
      mockDB.updateTimeBoxStatus.mockResolvedValue(null)

      const result = await service.updateTimeBoxStatus(
        today,
        'invalid-story',
        0,
        'completed' as TimeBoxStatus
      )

      expect(result).toBe(false)
    })

    it('should handle invalid timebox index', async () => {
      mockDB.updateTimeBoxStatus.mockResolvedValue(null)

      const result = await service.updateTimeBoxStatus(
        today,
        '1',
        999,
        'completed' as TimeBoxStatus
      )

      expect(result).toBe(false)
    })
  })

  describe('updateTimerState', () => {
    it('should update timer state successfully', async () => {
      mockDB.updateTimerState.mockResolvedValue(mockWorkPlan)

      const activeTimeBox = { storyId: '1', timeBoxIndex: 0 }
      const timeRemaining = 1500
      const isTimerRunning = true

      const result = await service.updateTimerState(
        today,
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      )

      expect(result).toBe(true)
      expect(mockDB.updateTimerState).toHaveBeenCalledWith(
        today,
        activeTimeBox,
        timeRemaining,
        isTimerRunning
      )
    })

    it('should handle null response when updating timer state', async () => {
      mockDB.updateTimerState.mockResolvedValue(null)

      const result = await service.updateTimerState(
        today,
        { storyId: '1', timeBoxIndex: 0 },
        1500,
        true
      )

      expect(result).toBe(false)
    })

    it('should handle errors when updating timer state', async () => {
      mockDB.updateTimerState.mockRejectedValue(new Error('DB Error'))

      const result = await service.updateTimerState(
        today,
        { storyId: '1', timeBoxIndex: 0 },
        1500,
        true
      )

      expect(result).toBe(false)
    })

    it('should handle null values in timer state update', async () => {
      mockDB.updateTimerState.mockResolvedValue(mockWorkPlan)

      const result = await service.updateTimerState(
        today,
        null,
        null,
        false
      )

      expect(result).toBe(true)
      expect(mockDB.updateTimerState).toHaveBeenCalledWith(
        today,
        null,
        null,
        false
      )
    })

    it('should handle invalid time remaining value', async () => {
      const result = await service.updateTimerState(
        today,
        { storyId: '1', timeBoxIndex: 0 },
        -1,
        true
      )

      expect(result).toBe(false)
      expect(mockDB.updateTimerState).not.toHaveBeenCalled()
    })

    it('should handle invalid story ID in active timebox', async () => {
      mockDB.updateTimerState.mockResolvedValue(null)

      const result = await service.updateTimerState(
        today,
        { storyId: 'invalid-story', timeBoxIndex: 0 },
        1500,
        true
      )

      expect(result).toBe(false)
    })

    it('should handle invalid timebox index in active timebox', async () => {
      mockDB.updateTimerState.mockResolvedValue(null)

      const result = await service.updateTimerState(
        today,
        { storyId: '1', timeBoxIndex: 999 },
        1500,
        true
      )

      expect(result).toBe(false)
    })
  })

  describe('validation', () => {
    describe('validateWorkPlan', () => {
      it('should validate a valid workplan', async () => {
        await expect(service.saveWorkPlan(mockWorkPlan)).resolves.not.toThrow()
      })

      it('should reject workplan without id', async () => {
        const invalidWorkPlan = { ...mockWorkPlan, id: undefined } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan without status', async () => {
        const invalidWorkPlan = { ...mockWorkPlan, status: undefined } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan without storyBlocks', async () => {
        const invalidWorkPlan = { ...mockWorkPlan, storyBlocks: undefined } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan with invalid status', async () => {
        const invalidWorkPlan = { ...mockWorkPlan, status: 'invalid-status' } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should accept all valid workplan statuses', async () => {
        const validStatuses: TodoWorkPlanStatus[] = ['planned', 'in-progress', 'completed', 'archived']
        for (const status of validStatuses) {
          const workplan = { ...mockWorkPlan, status }
          await expect(service.saveWorkPlan(workplan)).resolves.not.toThrow()
        }
      })

      it('should reject workplan with empty storyBlocks array', async () => {
        const invalidWorkPlan = { ...mockWorkPlan, storyBlocks: [] }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan with invalid storyBlock structure', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{ id: '1' }] // Missing required fields
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan with invalid dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: 'invalid-date',
          endTime: 'invalid-date'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject workplan with end time before start time', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: today + 'T10:00:00Z',
          endTime: today + 'T09:00:00Z'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateStoryBlocks', () => {
      it('should validate valid story blocks', async () => {
        await expect(service.saveWorkPlan(mockWorkPlan)).resolves.not.toThrow()
      })

      it('should reject story block without id', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{ ...mockWorkPlan.storyBlocks[0], id: undefined }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject story block without title', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{ ...mockWorkPlan.storyBlocks[0], title: undefined }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject story block without timeBoxes', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{ ...mockWorkPlan.storyBlocks[0], timeBoxes: undefined }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject story block with non-array timeBoxes', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{ ...mockWorkPlan.storyBlocks[0], timeBoxes: {} }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject time box without type', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            ...mockWorkPlan.storyBlocks[0],
            timeBoxes: [{ ...mockWorkPlan.storyBlocks[0].timeBoxes[0], type: undefined }]
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject time box without duration', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            ...mockWorkPlan.storyBlocks[0],
            timeBoxes: [{ ...mockWorkPlan.storyBlocks[0].timeBoxes[0], duration: undefined }]
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject time box with non-array tasks', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            ...mockWorkPlan.storyBlocks[0],
            timeBoxes: [{ ...mockWorkPlan.storyBlocks[0].timeBoxes[0], tasks: {} }]
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject time box with invalid status', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            ...mockWorkPlan.storyBlocks[0],
            timeBoxes: [{ ...mockWorkPlan.storyBlocks[0].timeBoxes[0], status: 'invalid-status' }]
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateDates', () => {
      it('should validate valid dates', async () => {
        await expect(service.saveWorkPlan(mockWorkPlan)).resolves.not.toThrow()
      })

      it('should reject invalid start date', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: 'invalid-date'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject invalid end date', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          endTime: 'invalid-date'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject end date before start date', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: today + 'T10:00:00Z',
          endTime: today + 'T09:00:00Z'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should accept equal start and end dates', async () => {
        const workplan = {
          ...mockWorkPlan,
          startTime: today + 'T09:00:00Z',
          endTime: today + 'T09:00:00Z'
        }
        await expect(service.saveWorkPlan(workplan)).resolves.not.toThrow()
      })

      it('should reject undefined dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: undefined,
          endTime: undefined
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should reject null dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: null,
          endTime: null
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateBaseStatus', () => {
      it('should accept valid base status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          'completed' as BaseStatus
        )
        expect(result).toBe(true)
      })

      it('should reject invalid base status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          'invalid-status' as BaseStatus
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })

      it('should accept all valid base statuses', async () => {
        const validStatuses: BaseStatus[] = ['todo', 'completed', 'in-progress', 'mitigated']
        for (const status of validStatuses) {
          mockDB.updateTaskStatus.mockResolvedValue(mockWorkPlan)
          const result = await service.updateTaskStatus(
            today,
            '1',
            0,
            0,
            status
          )
          expect(result).toBe(true)
        }
      })

      it('should reject undefined status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          undefined as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })

      it('should reject null status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          null as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })
    })

    describe('validateTimeBoxStatus', () => {
      it('should accept valid timebox status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          'completed' as TimeBoxStatus
        )
        expect(result).toBe(true)
      })

      it('should reject invalid timebox status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          'invalid-status' as TimeBoxStatus
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })

      it('should accept all valid timebox statuses', async () => {
        const validStatuses: TimeBoxStatus[] = ['todo', 'completed', 'in-progress', 'mitigated']
        for (const status of validStatuses) {
          mockDB.updateTimeBoxStatus.mockResolvedValue(mockWorkPlan)
          const result = await service.updateTimeBoxStatus(
            today,
            '1',
            0,
            status
          )
          expect(result).toBe(true)
        }
      })

      it('should reject undefined status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          undefined as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })

      it('should reject null status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          null as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })
    })

    describe('validateTimerState', () => {
      it('should accept valid timer state', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          1500,
          true
        )
        expect(result).toBe(true)
      })

      it('should accept null active timebox', async () => {
        const result = await service.updateTimerState(
          today,
          null,
          null,
          false
        )
        expect(result).toBe(true)
      })

      it('should reject active timebox without storyId', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '', timeBoxIndex: 0 },
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should reject active timebox with invalid timeBoxIndex', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 'invalid' as any },
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should reject negative time remaining', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          -1,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should accept zero time remaining', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          0,
          true
        )
        expect(result).toBe(true)
      })

      it('should reject invalid active timebox structure', async () => {
        const result = await service.updateTimerState(
          today,
          { invalid: 'structure' } as any,
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should reject non-boolean isTimerRunning', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          1500,
          'true' as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should reject non-numeric time remaining', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          '1500' as any,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })
    })
  })

  describe('validation error handling', () => {
    describe('validateWorkPlan', () => {
      it('should handle null workplan', async () => {
        await expect(service.saveWorkPlan(null as any)).rejects.toThrow('Invalid workplan')
      })

      it('should handle undefined workplan', async () => {
        await expect(service.saveWorkPlan(undefined as any)).rejects.toThrow('Invalid workplan')
      })

      it('should handle non-object workplan', async () => {
        await expect(service.saveWorkPlan('not an object' as any)).rejects.toThrow('Invalid workplan')
      })

      it('should handle workplan with invalid types', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          id: 123,
          status: true,
          storyBlocks: 'not an array'
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateStoryBlocks', () => {
      it('should handle null story blocks', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: null
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle undefined story blocks', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: undefined
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle non-array story blocks', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: 'not an array'
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle story blocks with invalid types', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            id: 123,
            title: true,
            timeBoxes: 'not an array'
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle time boxes with invalid types', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          storyBlocks: [{
            ...mockWorkPlan.storyBlocks[0],
            timeBoxes: [{
              type: 123,
              duration: 'not a number',
              tasks: 'not an array'
            }]
          }]
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateDates', () => {
      it('should handle null dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: null,
          endTime: null
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle undefined dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: undefined,
          endTime: undefined
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle non-string dates', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: 123,
          endTime: true
        } as any
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle malformed date strings', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: 'not a date',
          endTime: 'also not a date'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })

      it('should handle partial date strings', async () => {
        const invalidWorkPlan = {
          ...mockWorkPlan,
          startTime: '2024',
          endTime: '03-20'
        }
        await expect(service.saveWorkPlan(invalidWorkPlan)).rejects.toThrow('Invalid workplan')
      })
    })

    describe('validateBaseStatus', () => {
      it('should handle null status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          null as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })

      it('should handle undefined status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          undefined as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })

      it('should handle non-string status', async () => {
        const result = await service.updateTaskStatus(
          today,
          '1',
          0,
          0,
          123 as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTaskStatus).not.toHaveBeenCalled()
      })
    })

    describe('validateTimeBoxStatus', () => {
      it('should handle null status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          null as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })

      it('should handle undefined status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          undefined as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })

      it('should handle non-string status', async () => {
        const result = await service.updateTimeBoxStatus(
          today,
          '1',
          0,
          123 as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimeBoxStatus).not.toHaveBeenCalled()
      })
    })

    describe('validateTimerState', () => {
      it('should handle null active timebox fields', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: null, timeBoxIndex: null } as any,
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle undefined active timebox fields', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: undefined, timeBoxIndex: undefined } as any,
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle invalid active timebox field types', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: 123, timeBoxIndex: 'not a number' } as any,
          1500,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle non-numeric time remaining', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          'not a number' as any,
          true
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle non-boolean isTimerRunning', async () => {
        const result = await service.updateTimerState(
          today,
          { storyId: '1', timeBoxIndex: 0 },
          1500,
          'not a boolean' as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle all null values', async () => {
        const result = await service.updateTimerState(
          today,
          null,
          null,
          null as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })

      it('should handle all undefined values', async () => {
        const result = await service.updateTimerState(
          today,
          undefined as any,
          undefined as any,
          undefined as any
        )
        expect(result).toBe(false)
        expect(mockDB.updateTimerState).not.toHaveBeenCalled()
      })
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent task status updates', async () => {
      const updates = [
        service.updateTaskStatus(today, '1', 0, 0, 'completed' as BaseStatus),
        service.updateTaskStatus(today, '1', 0, 0, 'in-progress' as BaseStatus),
        service.updateTaskStatus(today, '1', 0, 0, 'todo' as BaseStatus)
      ]

      mockDB.updateTaskStatus.mockResolvedValue(mockWorkPlan)
      await Promise.all(updates)

      expect(mockDB.updateTaskStatus).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent timebox status updates', async () => {
      const updates = [
        service.updateTimeBoxStatus(today, '1', 0, 'completed' as TimeBoxStatus),
        service.updateTimeBoxStatus(today, '1', 0, 'in-progress' as TimeBoxStatus),
        service.updateTimeBoxStatus(today, '1', 0, 'todo' as TimeBoxStatus)
      ]

      mockDB.updateTimeBoxStatus.mockResolvedValue(mockWorkPlan)
      await Promise.all(updates)

      expect(mockDB.updateTimeBoxStatus).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent timer state updates', async () => {
      const updates = [
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1500, true),
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1400, true),
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1300, true)
      ]

      mockDB.updateTimerState.mockResolvedValue(mockWorkPlan)
      await Promise.all(updates)

      expect(mockDB.updateTimerState).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent workplan saves', async () => {
      const saves = [
        service.saveWorkPlan(mockWorkPlan),
        service.saveWorkPlan({ ...mockWorkPlan, totalDuration: 70 }),
        service.saveWorkPlan({ ...mockWorkPlan, totalDuration: 80 })
      ]

      mockDB.upsertWorkPlan.mockImplementation((workplan: TodoWorkPlan) => Promise.resolve(workplan))
      await Promise.all(saves)

      expect(mockDB.upsertWorkPlan).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent reads and writes', async () => {
      const operations = [
        service.getWorkPlan(today),
        service.saveWorkPlan(mockWorkPlan),
        service.getAllWorkPlans(),
        service.updateTaskStatus(today, '1', 0, 0, 'completed' as BaseStatus),
        service.updateTimeBoxStatus(today, '1', 0, 'completed' as TimeBoxStatus),
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1500, true)
      ]

      mockDB.findByDate.mockResolvedValue(mockWorkPlan)
      mockDB.findAllWorkPlans.mockResolvedValue([mockWorkPlan])
      mockDB.upsertWorkPlan.mockImplementation((workplan: TodoWorkPlan) => Promise.resolve(workplan))
      mockDB.updateTaskStatus.mockResolvedValue(mockWorkPlan)
      mockDB.updateTimeBoxStatus.mockResolvedValue(mockWorkPlan)
      mockDB.updateTimerState.mockResolvedValue(mockWorkPlan)

      await Promise.all(operations)

      expect(mockDB.findByDate).toHaveBeenCalled()
      expect(mockDB.findAllWorkPlans).toHaveBeenCalled()
      expect(mockDB.upsertWorkPlan).toHaveBeenCalled()
      expect(mockDB.updateTaskStatus).toHaveBeenCalled()
      expect(mockDB.updateTimeBoxStatus).toHaveBeenCalled()
      expect(mockDB.updateTimerState).toHaveBeenCalled()
    })

    it('should handle concurrent operations with errors', async () => {
      const operations = [
        service.getWorkPlan(today),
        service.saveWorkPlan(mockWorkPlan),
        service.getAllWorkPlans(),
        service.updateTaskStatus(today, '1', 0, 0, 'completed' as BaseStatus),
        service.updateTimeBoxStatus(today, '1', 0, 'completed' as TimeBoxStatus),
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1500, true)
      ]

      mockDB.findByDate.mockRejectedValue(new Error('DB Error'))
      mockDB.findAllWorkPlans.mockRejectedValue(new Error('DB Error'))
      mockDB.upsertWorkPlan.mockRejectedValue(new Error('DB Error'))
      mockDB.updateTaskStatus.mockRejectedValue(new Error('DB Error'))
      mockDB.updateTimeBoxStatus.mockRejectedValue(new Error('DB Error'))
      mockDB.updateTimerState.mockRejectedValue(new Error('DB Error'))

      const results = await Promise.allSettled(operations)

      expect(results).toHaveLength(6)
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1) // Only saveWorkPlan should reject
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5) // Others should return null/false
    })

    it('should handle concurrent operations during destroy', async () => {
      const operations = [
        service.getWorkPlan(today),
        service.saveWorkPlan(mockWorkPlan),
        service.getAllWorkPlans(),
        service.updateTaskStatus(today, '1', 0, 0, 'completed' as BaseStatus),
        service.updateTimeBoxStatus(today, '1', 0, 'completed' as TimeBoxStatus),
        service.updateTimerState(today, { storyId: '1', timeBoxIndex: 0 }, 1500, true)
      ]

      const operationsPromise = Promise.all(operations)
      service.destroy()

      await expect(operationsPromise).rejects.toThrow('Service has been destroyed')
    })
  })

  describe('AI-generated workplan storage', () => {
    it('should save and retrieve a workplan with today\'s date', async () => {
      const today = new Date().toISOString().split('T')[0]
      const aiGeneratedWorkPlan: TodoWorkPlan = {
        id: today,
        storyBlocks: [
          {
            id: '1',
            title: 'Morning Focus Block',
            timeBoxes: [
              {
                type: 'work',
                duration: 90,
                tasks: [
                  {
                    title: 'Code Review: PR #123',
                    duration: 45,
                    status: 'todo'
                  },
                  {
                    title: 'Implement User Authentication',
                    duration: 45,
                    status: 'todo'
                  }
                ],
                status: 'todo'
              },
              {
                type: 'short-break',
                duration: 15,
                tasks: [],
                status: 'todo'
              }
            ],
            totalDuration: 105,
            progress: 0,
            taskIds: ['1', '2']
          }
        ],
        status: 'planned',
        totalDuration: 105,
        startTime: `${today}T09:00:00Z`,
        endTime: `${today}T10:45:00Z`,
        lastUpdated: new Date().toISOString(),
        activeTimeBox: null,
        timeRemaining: null,
        isTimerRunning: false
      }

      // Save the workplan
      await service.saveWorkPlan(aiGeneratedWorkPlan)

      // Retrieve the workplan
      const retrieved = await service.getWorkPlan(today)

      // Verify the workplan was saved correctly
      expect(retrieved).toBeTruthy()
      expect(retrieved?.id).toBe(today)
      expect(retrieved?.storyBlocks).toHaveLength(1)
      expect(retrieved?.storyBlocks[0].timeBoxes).toHaveLength(2)
      expect(retrieved?.status).toBe('planned')
      expect(retrieved?.totalDuration).toBe(105)

      // Verify the tasks were saved correctly
      const tasks = retrieved?.storyBlocks[0].timeBoxes[0].tasks
      expect(tasks).toHaveLength(2)
      expect(tasks?.[0].title).toBe('Code Review: PR #123')
      expect(tasks?.[1].title).toBe('Implement User Authentication')
    })

    it('should update an existing workplan for today', async () => {
      const today = new Date().toISOString().split('T')[0]
      const initialWorkPlan = await service.getWorkPlan(today)
      expect(initialWorkPlan).toBeTruthy()

      // Update the workplan status to in-progress
      const updatedWorkPlan = {
        ...initialWorkPlan!,
        status: 'in-progress' as TodoWorkPlanStatus
      }

      // Save the updated workplan
      await service.saveWorkPlan(updatedWorkPlan)

      // Retrieve and verify the update
      const retrieved = await service.getWorkPlan(today)
      expect(retrieved?.status).toBe('in-progress')
    })
  })
})