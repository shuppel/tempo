// /features/brain-dump/services/brain-dump-services.ts
import type { ProcessedStory, ProcessedTask } from "@/lib/types"
import { isApiError } from "../types"
import { 
  DURATION_RULES,
  validateTaskDuration,
  roundToNearestBlock,
  calculateTotalDuration,
  type TimeBox
} from "@/lib/durationUtils"
import { dayLoadWorkService } from "./day-load-work-manager"

const processTasks = async (taskList: string[]) => {
  const response = await fetch("/api/tasks/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskList })
  })

  const data = await response.json()
  
  if (!response.ok) {
    // If the response contains error details, throw them
    if (isApiError(data)) {
      const errorDetails = data.details 
        ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
        : ''
      throw new Error(`${data.error}${errorDetails}`)
    }
    // If it's a raw error message
    throw new Error(data.error || 'Failed to process tasks')
  }

  return data
}

// Helper function to modify stories based on error types
const modifyStoriesForRetry = (stories: ProcessedStory[], error: any): ProcessedStory[] => {
  // Create a deep copy to avoid mutating the original data
  const modifiedStories = JSON.parse(JSON.stringify(stories)) as ProcessedStory[]
  
  console.log('Modifying stories for retry. Error details:', error?.details)
  
  // More aggressive task splitting - use duration rules from durationUtils
  modifiedStories.forEach(story => {
    console.log(`Processing story "${story.title}" with ${story.tasks.length} tasks`)
    const updatedTasks: ProcessedTask[] = []
    let cumulativeWorkTime = 0
    
    // Store original title for reference before any splitting
    const originalTitle = story.title
    
    story.tasks.forEach((task, taskIndex) => {
      // Split tasks that exceed MAX_WORK_WITHOUT_BREAK/2 to ensure breaks
      const maxTaskDuration = Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 2)
      if (task.duration > maxTaskDuration) {
        console.log(`Splitting task "${task.title}" (${task.duration} minutes) into smaller parts`)
        
        const numParts = Math.ceil(task.duration / maxTaskDuration)
        let remainingDuration = task.duration
        
        for (let i = 0; i < numParts; i++) {
          // Calculate part duration and round to nearest block
          const rawPartDuration = (i === numParts - 1) 
            ? remainingDuration 
            : Math.min(maxTaskDuration, remainingDuration)
          
          const partDuration = roundToNearestBlock(rawPartDuration)
          remainingDuration -= partDuration
          
          // Update cumulative work time
          cumulativeWorkTime += partDuration
          
          // Create new task part with explicit break requirements
          const newTask: ProcessedTask = {
            ...task,
            title: `${task.title} (Part ${i + 1} of ${numParts})`,
            duration: partDuration,
            needsSplitting: false,
            suggestedBreaks: [],
            isFlexible: task.isFlexible,
            taskCategory: task.taskCategory,
            projectType: task.projectType,
            isFrog: task.isFrog,
            originalTitle: task.title // Track original title
          }
          
          // Add breaks based on cumulative work time
          if (cumulativeWorkTime >= maxTaskDuration) {
            newTask.suggestedBreaks.push({
              after: partDuration,
              duration: DURATION_RULES.LONG_BREAK,
              reason: "Required break to prevent excessive work time"
            })
            cumulativeWorkTime = 0 // Reset after break
          } else if (i < numParts - 1) {
            // Add shorter break between parts
            newTask.suggestedBreaks.push({
              after: partDuration,
              duration: DURATION_RULES.SHORT_BREAK,
              reason: "Short break between task segments"
            })
          }
          
          updatedTasks.push(newTask)
        }
      } else {
        // For shorter tasks, still track cumulative work time
        const roundedDuration = roundToNearestBlock(task.duration)
        cumulativeWorkTime += roundedDuration
        
        const newTask: ProcessedTask = {
          ...task,
          duration: roundedDuration,
          suggestedBreaks: [...(task.suggestedBreaks || [])],
          isFlexible: task.isFlexible,
          taskCategory: task.taskCategory,
          projectType: task.projectType,
          isFrog: task.isFrog
        }
        
        // Add break if we're approaching the limit
        if (cumulativeWorkTime >= maxTaskDuration) {
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.LONG_BREAK,
            reason: "Required break to prevent excessive work time"
          })
          cumulativeWorkTime = 0 // Reset after break
        } else if (taskIndex < story.tasks.length - 1) {
          // Add short break between tasks if not the last task
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.SHORT_BREAK,
            reason: "Short break between tasks"
          })
        }
        
        updatedTasks.push(newTask)
      }
    })
    
    // If this is specifically the story mentioned in the error, ensure it gets special treatment
    if (error?.details?.block && story.title === error.details.block) {
      console.log(`Found story that caused the error: ${story.title}`)
      
      // Add a reference to the original title if this is an affected story
      story.originalTitle = originalTitle
      
      // Force breaks every maxTaskDuration if error is about consecutive work time
      if (error?.details?.consecutiveWorkTime > error?.details?.maxAllowed) {
        console.log(`Adding more aggressive break scheduling for ${story.title}`)
        
        let runningDuration = 0
        for (let i = 0; i < updatedTasks.length; i++) {
          const task = updatedTasks[i]
          runningDuration += task.duration
          
          // Ensure there's a substantial break at least every maxTaskDuration
          const maxTaskDuration = Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 2)
          if (runningDuration >= maxTaskDuration && i < updatedTasks.length - 1) {
            if (!task.suggestedBreaks.some(b => b.duration >= DURATION_RULES.LONG_BREAK)) {
              task.suggestedBreaks.push({
                after: task.duration,
                duration: DURATION_RULES.LONG_BREAK,
                reason: "Mandatory break to prevent excessive work time"
              })
            }
            runningDuration = 0 // Reset counter after break
          } else if (i < updatedTasks.length - 1 && !task.suggestedBreaks.some(b => b.duration >= DURATION_RULES.SHORT_BREAK)) {
            // Ensure at least a short break between consecutive tasks
            task.suggestedBreaks.push({
              after: task.duration,
              duration: DURATION_RULES.SHORT_BREAK,
              reason: "Short break between consecutive tasks"
            })
          }
        }
      }
    }
    
    // Replace tasks with modified versions
    story.tasks = updatedTasks
    console.log(`Updated tasks count for story "${story.title}": ${updatedTasks.length}`)
    
    // Force the story to require breaks
    story.needsBreaks = true
    
    // Add a reference to the original title if we split any tasks
    if (updatedTasks.some(task => task.title.includes('Part'))) {
      story.originalTitle = originalTitle
    }
    
    // Recalculate story duration
    recalculateStoryDuration(story)
  })
  
  return modifiedStories
}

// Helper function to recalculate story duration based on tasks and breaks
function recalculateStoryDuration(story: ProcessedStory): void {
  // Calculate total duration including breaks
  const totalWorkTime = story.tasks.reduce((sum, task) => sum + task.duration, 0)
  const totalBreakTime = story.tasks.reduce((sum, task) => 
    sum + (task.suggestedBreaks?.reduce((bSum, b) => bSum + b.duration, 0) || 0), 
  0)
  
  story.estimatedDuration = roundToNearestBlock(totalWorkTime + totalBreakTime)
  console.log(`Recalculated duration for "${story.title}": ${story.estimatedDuration} minutes (work: ${totalWorkTime}, breaks: ${totalBreakTime})`)
}

const createSession = async (stories: ProcessedStory[], startTime: string, maxRetries = 10) => {
  let currentStories = [...stories]
  let retryCount = 0
  let lastError = null
  
  // Create a map of story titles (including modified ones) to original stories
  // This will help with story matching on the server side
  const titleToStoryMap = new Map<string, ProcessedStory>()
  
  // Pre-process the stories before first attempt - be proactive
  currentStories = modifyStoriesForRetry(currentStories, {
    details: { 
      preventiveModification: true
    }
  })
  
  // Build mapping of all story titles (original and split) to their original stories
  currentStories.forEach(story => {
    // Store by current title
    titleToStoryMap.set(story.title, story)
    
    // If there's an original title stored, map that too
    if (story.originalTitle && story.originalTitle !== story.title) {
      titleToStoryMap.set(story.originalTitle, story)
    }
    
    // Also add mappings for task titles with parts
    story.tasks.forEach(task => {
      if (task.title.includes('Part') && task.originalTitle) {
        // Create a synthetic story title that might be generated by task splitting
        const syntheticStoryTitle = `${story.title}: ${task.title}`
        titleToStoryMap.set(syntheticStoryTitle, story)
        
        // Also try with just the original task title
        const baseStoryTitle = `${story.title}: ${task.originalTitle}`
        titleToStoryMap.set(baseStoryTitle, story)
      }
    })
  })
  
  console.log(`Created mapping for ${titleToStoryMap.size} potential story titles`)
  
  // Handle task overflow - only schedule what fits in today
  currentStories = dayLoadWorkService.getTodayStories(currentStories)
  
  // Only validate that the totalDuration is a valid multiple of BLOCK_SIZE and above MIN_DURATION
  const totalDuration = currentStories.reduce((sum, story) => sum + story.estimatedDuration, 0)
  if (totalDuration < DURATION_RULES.MIN_DURATION || totalDuration % DURATION_RULES.BLOCK_SIZE !== 0) {
    throw new Error(`Invalid total duration: ${totalDuration} minutes. Must be at least ${DURATION_RULES.MIN_DURATION} minutes and a multiple of ${DURATION_RULES.BLOCK_SIZE} minutes.`)
  }
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to create session (attempt ${retryCount + 1}/${maxRetries})`)
      console.log('Total duration:', totalDuration, 'minutes')
      
      // Ensure all tasks have IDs before sending
      currentStories.forEach(story => {
        story.tasks.forEach(task => {
          if (!task.id) {
            task.id = crypto.randomUUID();
            console.log(`Added missing ID to task: ${task.title}`);
          }
        });
      });
      
      // Add story mapping to the request
      const request = {
        stories: currentStories,
        startTime,
        storyMapping: Array.from(titleToStoryMap.keys())
          .map(title => ({
            possibleTitle: title,
            originalTitle: titleToStoryMap.get(title)?.originalTitle || titleToStoryMap.get(title)?.title
          }))
      }
      
      const response = await fetch("/api/tasks/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      })

      // Get the raw text first to handle potential parsing issues
      const rawText = await response.text()
      
      // Validate response size
      if (rawText.length > 10_000_000) { // 10MB limit
        throw new Error('Response too large', {
          cause: { code: 'RESPONSE_TOO_LARGE', size: rawText.length }
        })
      }

      let data
      try {
        data = JSON.parse(rawText)
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError)
        console.log('Raw response:', rawText.substring(0, 1000) + '...')
        
        // Try to recover from common JSON issues
        const cleanedText = rawText
          .replace(/\n/g, '')
          .replace(/\r/g, '')
          .replace(/\t/g, '')
          .trim()
        
        try {
          data = JSON.parse(cleanedText)
        } catch (secondaryParseError) {
          throw new Error('Failed to parse API response as JSON', {
            cause: {
              code: 'PARSE_ERROR',
              originalError: parseError,
              secondaryError: secondaryParseError,
              rawResponse: rawText.substring(0, 1000) + '...' // First 1000 chars for debugging
            }
          })
        }
      }
      
      if (!response.ok) {
        // If the response contains error details, throw them
        if (isApiError(data)) {
          const errorDetails = data.details 
            ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
            : ''
          throw new Error(`${data.error}${errorDetails}`, { cause: data })
        }
        // If it's a raw error message
        throw new Error(data.error || 'Failed to create session', { cause: data })
      }

      // Validate the response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid session response: not an object', {
          cause: { code: 'INVALID_RESPONSE', response: data }
        })
      }
      
      if (!data.storyBlocks || !Array.isArray(data.storyBlocks)) {
        throw new Error('Invalid session response: missing storyBlocks array', {
          cause: { code: 'MISSING_STORY_BLOCKS', response: data }
        })
      }
      
      // Validate each story block
      for (const block of data.storyBlocks) {
        if (!block.title || !block.timeBoxes || !Array.isArray(block.timeBoxes)) {
          throw new Error('Invalid story block structure', {
            cause: { code: 'INVALID_BLOCK_STRUCTURE', block }
          })
        }
      }
      
      if (typeof data.totalDuration !== 'number' || data.totalDuration <= 0) {
        // If totalDuration is missing or invalid, calculate it from story blocks
        console.warn('Session response missing valid totalDuration, calculating from story blocks')
        
        const calculatedTotalDuration = data.storyBlocks.reduce(
          (sum: number, block: any) => sum + (block.totalDuration || 0), 
          0
        )
        
        if (calculatedTotalDuration <= 0) {
          throw new Error('Cannot calculate valid session duration from story blocks', {
            cause: { code: 'INVALID_DURATION', response: data }
          })
        }
        
        // Set the calculated duration
        data.totalDuration = calculatedTotalDuration
        console.log(`Set totalDuration to calculated value: ${calculatedTotalDuration} minutes`)
      }

      // Success! Return the data
      return data
    } catch (error) {
      console.error(`Session creation attempt ${retryCount + 1} failed:`, error)
      lastError = error
      
      // Check if this is a parsing error that might benefit from retry
      const shouldRetry = error instanceof Error && 
        (error.message.includes('parse') || error.message.includes('JSON'))
      
      // Don't retry on the last attempt or if it's not a parsing error
      if (retryCount >= maxRetries - 1 || !shouldRetry) {
        console.error(`Maximum retry limit (${maxRetries}) reached or non-retryable error. Giving up.`)
        break
      }
      
      // For parsing errors, we don't modify the stories, just retry
      if (!shouldRetry) {
        // Modify stories based on the error
        currentStories = modifyStoriesForRetry(currentStories, 
          error instanceof Error ? error.cause || error : error)
      }
      
      retryCount++
      
      // Wait a moment before retrying, longer for parsing errors
      await new Promise(resolve => setTimeout(resolve, shouldRetry ? 2000 : 1000))
    }
  }
  
  // If we've exhausted all retries, throw the last error
  if (lastError) {
    if (lastError instanceof Error) {
      throw lastError
    } else {
      throw new Error('Failed to create session after multiple attempts', { cause: lastError })
    }
  }
  
  throw new Error('Failed to create session due to unknown error')
}

export const brainDumpService = {
  processTasks,
  createSession
} as const