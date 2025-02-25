// lib/task-manager.ts
import type { Task, TaskGroup, TimeBox, StoryBlock, SessionPlan, ProcessedTask, SplitInfo, TaskType, TaskCategory, TimeBoxType, StoryType, DifficultyLevel } from "./types"

const DURATION_RULES = {
  FIRST_SESSION: { min: 20, max: 30 },
  MIDDLE_SESSION: { min: 25, max: 60 },
  FINAL_SESSION: { min: 15, max: 60 },
  SINGLE_TASK: { min: 20, max: 60 },
  SHORT_BREAK: 5,
  LONG_BREAK: 15,
  DEBRIEF: 5,
  SPLIT_THRESHOLD: 60,
  DURATION_TOLERANCE: 10,
  MAX_WORK_WITHOUT_BREAK: 90
} as const

const DIFFICULTY_WEIGHTS = {
  PHYSICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  LEARNING: 13,
} as const

// Convert DifficultyLevel to numeric values for calculations
const DIFFICULTY_NUMERIC = {
  "low": 25,
  "medium": 50,
  "high": 75
} as const

function getDifficultyValue(difficulty: DifficultyLevel): number {
  return DIFFICULTY_NUMERIC[difficulty] || DIFFICULTY_NUMERIC.medium;
}

async function getTaskIcon(taskTitle: string): Promise<string> {
  // Call AI to get appropriate icon suggestion
  // This would call your AI endpoint to get icon suggestions
  // For now returning placeholder
  return "🎯"
}

function shouldSplitTask(task: Task): boolean {
  return task.duration > DURATION_RULES.SPLIT_THRESHOLD
}

function calculateSplitDurations(totalDuration: number): { workDurations: number[], totalWithBreaks: number } {
  if (totalDuration <= DURATION_RULES.SPLIT_THRESHOLD) {
    return { 
      workDurations: [totalDuration],
      totalWithBreaks: totalDuration 
    }
  }

  if (totalDuration === 120) {
    // For 120-minute tasks (2 hours), split into work segments with breaks included:
    // 45min work + 5min break + 25min work + 15min break + 30min work = 120min total
    return {
      workDurations: [45, 25, 30],
      totalWithBreaks: 120 // Total time including breaks
    }
  }

  if (totalDuration === 180) {
    // For 180-minute tasks (3 hours), create optimal split with breaks:
    // 45min work + 15min break + 45min work + 15min break + 45min work = 165min
    // Plus additional short breaks between = 180min total
    return {
      workDurations: [45, 45, 45],
      totalWithBreaks: 180
    }
  }

  // For other durations, split into appropriate chunks accounting for breaks
  const parts: number[] = []
  let remaining = totalDuration
  let breakTime = 0

  // First work session: 30-45 minutes
  const firstPart = Math.min(45, Math.floor(remaining * 0.4))
  parts.push(firstPart)
  remaining -= firstPart
  breakTime += DURATION_RULES.SHORT_BREAK // Add first break

  // Calculate remaining parts ensuring breaks are accounted for
  while (remaining > DURATION_RULES.SHORT_BREAK) {
    if (remaining <= DURATION_RULES.FINAL_SESSION.max + DURATION_RULES.SHORT_BREAK) {
      // Last part: remaining time minus break
      parts.push(remaining - DURATION_RULES.SHORT_BREAK)
      breakTime += DURATION_RULES.SHORT_BREAK
      break
    } else {
      // Middle parts: account for break time
      const middlePart = Math.min(45, Math.floor((remaining - DURATION_RULES.LONG_BREAK) * 0.5))
      parts.push(middlePart)
      remaining -= (middlePart + DURATION_RULES.LONG_BREAK)
      breakTime += DURATION_RULES.LONG_BREAK
    }
  }

  return {
    workDurations: parts,
    totalWithBreaks: parts.reduce((sum, part) => sum + part, 0) + breakTime
  }
}

async function analyzeAndGroupTasks(tasks: Task[]): Promise<{ title: string, tasks: Task[], suggestedDuration: number }[]> {
  // First, sort tasks to prioritize frogs
  const sortedTasks = tasks.sort((a, b) => {
    // Prioritize frogs first
    if (a.isFrog && !b.isFrog) return -1
    if (!a.isFrog && b.isFrog) return 1
    
    // Then sort by difficulty within each priority level
    if (a.isFrog === b.isFrog) {
      return getDifficultyValue(b.difficulty) - getDifficultyValue(a.difficulty)
    }
    
    return 0
  })

  // Group tasks by project/story
  const groups: { [key: string]: Task[] } = {}
  
  sortedTasks.forEach(task => {
    // Extract project/story name from task title
    const storyName = task.title.split(':')[0] || task.title.split(' - ')[0] || task.title
    if (!groups[storyName]) {
      groups[storyName] = []
    }

    // Mark tasks that will need splitting but don't split yet
    if (shouldSplitTask(task)) {
      groups[storyName].push({
        ...task,
        needsSplitting: true,
        splitInfo: {
          isParent: true,
          originalDuration: task.duration
        }
      })
    } else {
      groups[storyName].push(task)
    }
  })

  // Sort groups to prioritize those with frog tasks
  return Object.entries(groups)
    .sort(([, tasksA], [, tasksB]) => {
      const hasFrogA = tasksA.some(t => t.isFrog)
      const hasFrogB = tasksB.some(t => t.isFrog)
      if (hasFrogA && !hasFrogB) return -1
      if (!hasFrogA && hasFrogB) return 1
      return 0
    })
    .map(([title, tasks]) => ({
      title,
      tasks,
      suggestedDuration: tasks.reduce((acc, task) => acc + task.duration, 0)
    }))
}

export async function createTimeBoxes(tasks: Task[]): Promise<SessionPlan> {
  // Get grouped and prioritized tasks
  const groups = await analyzeAndGroupTasks(tasks)
  const storyBlocks: StoryBlock[] = []
  let totalSessionDuration = 0

  // Enhanced frog tracking
  const frogTasks = tasks.filter(t => t.isFrog)
  const frogTracker = {
    total: frogTasks.length,
    scheduled: 0,
    originalDurations: new Map(frogTasks.map(t => [t.id, t.duration])),
    scheduledParts: new Map<string, number>()
  }

  // Calculate target time for completing frogs (aim for first third of the day)
  const totalEstimatedDuration = tasks.reduce((sum, t) => sum + t.duration, 0)
  const frogDeadlineMinutes = Math.floor(totalEstimatedDuration / 3)

  for (const group of groups) {
    const timeBoxes: TimeBox[] = []
    let storyDuration = 0
    let workDuration = 0

    // Process each task in the group
    for (const task of group.tasks) {
      if (task.isFrog) {
        // Track frog scheduling
        const currentTotalDuration = totalSessionDuration + storyDuration
        
        if (currentTotalDuration > frogDeadlineMinutes) {
          console.warn(`Warning: Frog task "${task.title}" scheduled beyond the first third of the day (${currentTotalDuration}/${frogDeadlineMinutes} minutes)`)
        }

        if (task.needsSplitting) {
          const partsScheduled = frogTracker.scheduledParts.get(task.id) || 0
          frogTracker.scheduledParts.set(task.id, partsScheduled + 1)
          
          const splitResult = calculateSplitDurations(frogTracker.originalDurations.get(task.id) || 0)
          if (partsScheduled + 1 === splitResult.workDurations.length) {
            frogTracker.scheduled++
          }
        } else {
          frogTracker.scheduled++
        }
      }

      if (task.needsSplitting) {
        // Calculate split durations with breaks included
        const splitResult = calculateSplitDurations(task.duration)
        const totalParts = splitResult.workDurations.length

        // Create time boxes for each part with appropriate breaks
        splitResult.workDurations.forEach((duration, index) => {
          const partNumber = index + 1
          const splitInfo: SplitInfo = {
            isParent: false,
            partNumber,
            totalParts,
            originalDuration: task.duration,
            parentTaskId: task.id
          }

          // Add work session
          timeBoxes.push({
            duration,
            type: "work" as TimeBoxType,
            tasks: [{
              title: `${task.title} (Part ${partNumber} of ${totalParts})`,
              duration,
              isFrog: task.isFrog,
              taskCategory: getTaskType(task.taskCategory),
              projectType: task.projectType,
              isFlexible: false,
              splitInfo,
              suggestedBreaks: []
            }],
            icon: "🎯"
          })
          storyDuration += duration
          workDuration += duration

          // Add appropriate break if not the last part
          if (partNumber < totalParts) {
            const breakDuration = workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.75
              ? DURATION_RULES.LONG_BREAK 
              : DURATION_RULES.SHORT_BREAK

            timeBoxes.push({
              duration: breakDuration,
              type: workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.75 ? "long-break" as TimeBoxType : "short-break" as TimeBoxType,
              icon: "⏸️"
            })
            storyDuration += breakDuration
            workDuration = 0
          }
        })
      } else {
        // Regular task processing
        timeBoxes.push({
          duration: task.duration,
          type: "work" as TimeBoxType,
          tasks: [{
            title: task.title,
            duration: task.duration,
            isFrog: task.isFrog,
            taskCategory: getTaskType(task.taskCategory),
            projectType: task.projectType,
            isFlexible: false,
            suggestedBreaks: []
          }],
          icon: "🎯"
        })
        storyDuration += task.duration
        workDuration += task.duration
      }

      // Add break between tasks if not the last task
      if (task !== group.tasks[group.tasks.length - 1]) {
        // More aggressive break insertion - use long break at 75% of max work time
        const breakDuration = workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.75
          ? DURATION_RULES.LONG_BREAK 
          : DURATION_RULES.SHORT_BREAK

        timeBoxes.push({
          duration: breakDuration,
          type: workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.75 ? "long-break" as TimeBoxType : "short-break" as TimeBoxType,
          icon: "⏸️"
        })
        storyDuration += breakDuration
        workDuration = 0 // Reset work duration after break
      }
    }

    // Add debrief at the end of story
    timeBoxes.push({
      duration: DURATION_RULES.DEBRIEF,
      type: "debrief" as TimeBoxType,
      icon: "📝"
    })
    storyDuration += DURATION_RULES.DEBRIEF

    // Validate story duration matches sum of time boxes
    const timeBoxTotal = timeBoxes.reduce((sum, box) => sum + box.duration, 0)
    if (timeBoxTotal !== storyDuration) {
      throw new Error(`Story duration mismatch for "${group.title}": ` +
        `calculated=${storyDuration}, timeBoxSum=${timeBoxTotal}`)
    }

    storyBlocks.push({
      id: crypto.randomUUID(),
      title: group.title,
      timeBoxes,
      totalDuration: storyDuration,
      progress: 0,
      icon: await getTaskIcon(group.title),
      type: "timeboxed" as StoryType,
      taskIds: group.tasks.map(task => task.id)
    })

    totalSessionDuration += storyDuration
  }

  // Validate all frogs were scheduled
  if (frogTracker.scheduled < frogTracker.total) {
    throw new Error(`Not all frog tasks were scheduled: ${frogTracker.scheduled}/${frogTracker.total} completed`)
  }

  // Validate total session duration matches sum of story blocks
  const storyBlockTotal = storyBlocks.reduce((sum, block) => sum + block.totalDuration, 0)
  if (storyBlockTotal !== totalSessionDuration) {
    throw new Error(`Session duration mismatch: ` +
      `calculated=${totalSessionDuration}, blockSum=${storyBlockTotal}`)
  }

  const now = new Date()
  return {
    storyBlocks,
    totalDuration: totalSessionDuration,
    startTime: now.toISOString(),
    endTime: new Date(now.getTime() + totalSessionDuration * 60000).toISOString(),
    frogMetrics: {
      total: frogTracker.total,
      scheduled: frogTracker.scheduled,
      scheduledWithinTarget: storyBlocks
        .reduce((acc, block) => acc + block.timeBoxes
          .filter(box => box.type === 'work' && 
                 box.tasks?.some(t => t.isFrog) &&
                 acc <= frogDeadlineMinutes)
          .length, 0)
    }
  }
}

export function organizeTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    // Prioritize physical and high-difficulty tasks
    const aDiffValue = getDifficultyValue(a.difficulty);
    const bDiffValue = getDifficultyValue(b.difficulty);
    
    if (aDiffValue >= DIFFICULTY_WEIGHTS.PHYSICAL && bDiffValue < DIFFICULTY_WEIGHTS.PHYSICAL) return -1
    if (bDiffValue >= DIFFICULTY_WEIGHTS.PHYSICAL && aDiffValue < DIFFICULTY_WEIGHTS.PHYSICAL) return 1
    
    // Then sort by difficulty
    return bDiffValue - aDiffValue
  })
}

// Update the processing of task types to include research type
function getTaskType(rawType: string): Exclude<TaskCategory, "break"> {
  if (rawType === 'break') return 'focus';
  if (rawType === 'research') return 'research';
  if (rawType === 'learning') return 'learning';
  if (rawType === 'review') return 'review';
  return 'focus';
} 