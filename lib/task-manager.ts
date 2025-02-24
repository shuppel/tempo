import type { Task, TaskGroup, TimeBox, StoryBlock, SessionPlan, ProcessedTask, SplitInfo } from "./types"

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

async function getTaskIcon(taskTitle: string): Promise<string> {
  // Call AI to get appropriate icon suggestion
  // This would call your AI endpoint to get icon suggestions
  // For now returning placeholder
  return "🎯"
}

function shouldSplitTask(task: Task): boolean {
  return task.duration > DURATION_RULES.SPLIT_THRESHOLD
}

function calculateSplitDurations(totalDuration: number): number[] {
  if (totalDuration <= DURATION_RULES.SPLIT_THRESHOLD) {
    return [totalDuration]
  }

  if (totalDuration === 120) {
    // For 120-minute tasks, split into 3 parts: 30 + 50 + 40
    return [30, 50, 40]
  }

  if (totalDuration === 180) {
    // For 180-minute tasks, split into 3 parts: 30 + 90 + 60
    return [30, 90, 60]
  }

  // For other durations, split into appropriate chunks
  const parts: number[] = []
  let remaining = totalDuration

  // First part: 25-30 minutes
  parts.push(Math.min(30, remaining))
  remaining -= parts[0]

  while (remaining > 0) {
    if (remaining <= DURATION_RULES.FINAL_SESSION.max) {
      // Last part: remaining time (15-60 minutes)
      parts.push(remaining)
      break
    } else {
      // Middle parts: 30-60 minutes
      const middlePart = Math.min(60, remaining)
      parts.push(middlePart)
      remaining -= middlePart
    }
  }

  return parts
}

async function analyzeAndGroupTasks(tasks: Task[]): Promise<{ title: string, tasks: Task[], suggestedDuration: number }[]> {
  // First, sort tasks to prioritize frogs
  const sortedTasks = tasks.sort((a, b) => {
    // Prioritize frogs first
    if (a.isFrog && !b.isFrog) return -1
    if (!a.isFrog && b.isFrog) return 1
    
    // Then sort by difficulty within each priority level
    if (a.isFrog === b.isFrog) {
      return b.difficulty - a.difficulty
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

  // Track frog tasks to ensure they're scheduled early
  let frogTasksScheduled = 0
  const totalFrogTasks = tasks.filter(t => t.isFrog).length

  for (const group of groups) {
    const timeBoxes: TimeBox[] = []
    let storyDuration = 0
    let workDuration = 0

    // Process each task in the group
    for (const task of group.tasks) {
      // For frog tasks, ensure they're scheduled in the first half of the day
      if (task.isFrog) {
        frogTasksScheduled++
        const totalPlannedDuration = totalSessionDuration + storyDuration
        const estimatedTotalDuration = tasks.reduce((sum, t) => sum + t.duration, 0)
        
        if (totalPlannedDuration > estimatedTotalDuration / 2) {
          console.warn(`Warning: Frog task "${task.title}" scheduled late in the day`)
        }
      }

      if (task.needsSplitting) {
        // Calculate split durations
        const splitDurations = calculateSplitDurations(task.duration)
        const totalParts = splitDurations.length

        // Validate split durations sum to original ±10 minutes
        const splitTotal = splitDurations.reduce((sum, d) => sum + d, 0)
        if (Math.abs(splitTotal - task.duration) > DURATION_RULES.DURATION_TOLERANCE) {
          throw new Error(`Split duration mismatch for task "${task.title}": ` +
            `original=${task.duration}, split sum=${splitTotal}`)
        }

        // Create time boxes for each part
        splitDurations.forEach((duration, index) => {
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
            type: "work",
            tasks: [{
              title: `${task.title} (Part ${partNumber} of ${totalParts})`,
              duration,
              isFrog: task.isFrog,
              type: task.type === 'break' ? 'focus' : task.type,
              isFlexible: false,
              splitInfo,
              suggestedBreaks: []
            }],
            icon: "🎯"
          })
          storyDuration += duration
          workDuration += duration

          // Add break if not the last part
          if (partNumber < totalParts) {
            const breakDuration = workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK 
              ? DURATION_RULES.LONG_BREAK 
              : DURATION_RULES.SHORT_BREAK

            timeBoxes.push({
              duration: breakDuration,
              type: workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK ? "long-break" : "short-break",
              icon: "⏸️"
            })
            storyDuration += breakDuration
            workDuration = 0 // Reset work duration after break
          }
        })
      } else {
        // Regular task processing
        timeBoxes.push({
          duration: task.duration,
          type: "work",
          tasks: [{
            title: task.title,
            duration: task.duration,
            isFrog: task.isFrog,
            type: task.type === 'break' ? 'focus' : task.type,
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
        const breakDuration = workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK 
          ? DURATION_RULES.LONG_BREAK 
          : DURATION_RULES.SHORT_BREAK

        timeBoxes.push({
          duration: breakDuration,
          type: workDuration >= DURATION_RULES.MAX_WORK_WITHOUT_BREAK ? "long-break" : "short-break",
          icon: "⏸️"
        })
        storyDuration += breakDuration
        workDuration = 0 // Reset work duration after break
      }
    }

    // Add debrief at the end of story
    timeBoxes.push({
      duration: DURATION_RULES.DEBRIEF,
      type: "debrief",
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
      type: "timeboxed"
    })

    totalSessionDuration += storyDuration
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
    endTime: new Date(now.getTime() + totalSessionDuration * 60000).toISOString()
  }
}

export function organizeTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    // Prioritize physical and high-difficulty tasks
    if (a.difficulty >= DIFFICULTY_WEIGHTS.PHYSICAL && b.difficulty < DIFFICULTY_WEIGHTS.PHYSICAL) return -1
    if (b.difficulty >= DIFFICULTY_WEIGHTS.PHYSICAL && a.difficulty < DIFFICULTY_WEIGHTS.PHYSICAL) return 1
    
    // Then sort by difficulty
    return b.difficulty - a.difficulty
  })
} 