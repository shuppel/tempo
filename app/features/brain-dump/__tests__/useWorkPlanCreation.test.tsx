import { renderHook, act } from '@testing-library/react'
import { useWorkPlanCreation } from '../hooks/useWorkPlanCreation'
import { brainDumpService } from '../services/brain-dump-services'
import { useRouter } from 'next/navigation'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the next/navigation module
vi.mock('next/navigation', () => ({
  useRouter: vi.fn()
}))

// Mock the brain-dump-services
vi.mock('../services/brain-dump-services', () => ({
  brainDumpService: {
    createWorkPlan: vi.fn()
  }
}))

describe('useWorkPlanCreation', () => {
  const mockRouter = {
    push: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWorkPlanCreation())

    expect(result.current.isCreatingWorkPlan).toBe(false)
    expect(result.current.processingStep).toBe('')
    expect(result.current.processingProgress).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('should successfully create a work plan and navigate', async () => {
    const mockStories = [
      {
        title: 'Test Story',
        summary: 'Test summary',
        icon: '📝',
        estimatedDuration: 30,
        type: 'timeboxed' as const,
        projectType: 'test',
        category: 'test',
        tasks: [{ 
          title: 'Test Task', 
          duration: 30,
          taskCategory: 'focus' as const,
          projectType: 'test',
          isFrog: false,
          isFlexible: false,
          id: '1',
          suggestedBreaks: []
        }]
      }
    ]

    const mockWorkPlan = {
      id: '2024-03-19',
      storyBlocks: []
    }

    ;(brainDumpService.createWorkPlan as any).mockResolvedValueOnce(mockWorkPlan)

    const { result } = renderHook(() => useWorkPlanCreation())

    await act(async () => {
      await result.current.createWorkPlan(mockStories)
    })

    // Verify state changes during successful creation
    expect(brainDumpService.createWorkPlan).toHaveBeenCalledWith(
      mockStories,
      expect.any(String) // ISO date string
    )

    // Wait for the setTimeout to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/workplan\/\d{4}-\d{2}-\d{2}$/)
    )
  })

  it('should handle errors during work plan creation', async () => {
    const mockError = new Error('Failed to create work plan')
    ;(brainDumpService.createWorkPlan as any).mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useWorkPlanCreation())

    await act(async () => {
      try {
        await result.current.createWorkPlan([])
      } catch (error) {
        // Error is expected to be thrown
      }
    })

    expect(result.current.error).toEqual({
      message: 'Failed to create work plan',
      code: 'WORKPLAN_ERROR',
      details: undefined
    })

    // Wait for the setTimeout to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    // Verify state is reset
    expect(result.current.isCreatingWorkPlan).toBe(false)
    expect(result.current.processingProgress).toBe(0)
    expect(result.current.processingStep).toBe('')
  })

  it('should handle structured error responses', async () => {
    const mockStructuredError = new Error('API Error')
    mockStructuredError.cause = {
      code: 'API_ERROR',
      details: { message: 'Invalid data' }
    }

    ;(brainDumpService.createWorkPlan as any).mockRejectedValueOnce(mockStructuredError)

    const { result } = renderHook(() => useWorkPlanCreation())

    await act(async () => {
      try {
        await result.current.createWorkPlan([])
      } catch (error) {
        // Error is expected to be thrown
      }
    })

    expect(result.current.error).toEqual({
      message: 'API Error',
      code: 'WORKPLAN_ERROR',
      details: {
        code: 'API_ERROR',
        details: { message: 'Invalid data' }
      }
    })
  })

  it('should update processing progress and step during creation', async () => {
    const mockStories = [{ 
      title: 'Test Story',
      summary: 'Test summary',
      icon: '📝',
      estimatedDuration: 30,
      type: 'timeboxed' as const,
      projectType: 'test',
      category: 'test',
      tasks: []
    }]
    ;(brainDumpService.createWorkPlan as any).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({}), 100))
    )

    const { result } = renderHook(() => useWorkPlanCreation())

    const createPromise = act(async () => {
      await result.current.createWorkPlan(mockStories)
    })

    // Check initial state
    expect(result.current.isCreatingWorkPlan).toBe(true)
    expect(result.current.processingStep).toBe('Creating work plan...')
    expect(result.current.processingProgress).toBe(50)

    await createPromise

    // Wait for the setTimeout to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    // Check final state
    expect(result.current.isCreatingWorkPlan).toBe(false)
    expect(result.current.processingProgress).toBe(0)
    expect(result.current.processingStep).toBe('')
  })

  it('should allow error state to be manually set', () => {
    const { result } = renderHook(() => useWorkPlanCreation())

    act(() => {
      result.current.setError({
        message: 'Manual error',
        code: 'MANUAL_ERROR'
      })
    })

    expect(result.current.error).toEqual({
      message: 'Manual error',
      code: 'MANUAL_ERROR'
    })
  })
}) 