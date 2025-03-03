// /features/brain-dump/services/brain-dump-services.ts
// This service module provides two main functions:
// 1. processTasks: Sends a list of raw tasks to the AI processing endpoint,
//    validates and enriches the response with duration and difficulty.
// 2. createSession: Creates a session from processed stories, including
//    task splitting for workload management, error-based modifications,
//    retries with exponential backoff, and finally saving the session using
//    the SessionStorageService.

import type { DifficultyLevel } from "@/lib/types"
import type { ProcessedStory, ProcessedTask } from "../types"
import { SessionStorageService } from "@/app/features/session-manager"
import { isApiError } from "../types"
import { 
  DURATION_RULES,
  validateTaskDuration,
  roundToNearestBlock,
  calculateTotalDuration,
  type TimeBox
} from "@/lib/durationUtils"

// Create a singleton instance of SessionStorageService for saving sessions.
const sessionStorage = new SessionStorageService()

// Helper function to determine task difficulty based on its duration.
const determineDifficulty = (duration: number): DifficultyLevel => {
  if (duration <= 30) return 'low';
  if (duration <= 60) return 'medium';
  return 'high';
};

// processTasks sends a list of task strings to the API for processing.
// It validates the API response and ensures each task has a valid duration
// and an appropriate difficulty level.
const processTasks = async (taskList: string[]) => {
  // Send a POST request to the processing endpoint with the task list.
  const response = await fetch("/api/tasks/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskList })
  })

  // Parse the JSON response.
  const data = await response.json()
  
  // If the response is not OK, extract error details and throw an error.
  if (!response.ok) {
    if (isApiError(data)) {
      const errorDetails = data.details 
        ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
        : ''
      throw new Error(`${data.error}${errorDetails}`)
    }
    throw new Error(data.error || 'Failed to process tasks')
  }

  // Enrich the response: ensure each task has a valid duration and set a difficulty.
  if (data.stories) {
    data.stories = data.stories.map((story: ProcessedStory) => ({
      ...story,
      tasks: story.tasks.map((task: ProcessedTask) => {
        const validDuration = task.duration || DURATION_RULES.MIN_DURATION;
        return {
          ...task,
          duration: validDuration,
          // Use determineDifficulty helper if difficulty is not provided.
          difficulty: task.difficulty || determineDifficulty(validDuration)
        };
      })
    }))
  }

  return data
};

// modifyStoriesForRetry adjusts stories when errors occur.
// It performs aggressive task splitting to ensure no block exceeds MAX_WORK_WITHOUT_BREAK.
// It also adds explicit breaks between split task parts and recalculates story duration.
const modifyStoriesForRetry = (stories: ProcessedStory[], error: any): ProcessedStory[] => {
  // Deep copy stories to avoid mutating the original array.
  const modifiedStories = JSON.parse(JSON.stringify(stories)) as ProcessedStory[]
  
  console.log('Modifying stories for retry. Error details:', error?.details)
  
  // Identify if a specific block is problematic.
  const problematicBlock = error?.details?.block
  
  // Process each story individually.
  modifiedStories.forEach(story => {
    console.log(`Processing story "${story.title}" with ${story.tasks.length} tasks`)
    const updatedTasks: ProcessedTask[] = []
    let cumulativeWorkTime = 0
    
    // Save the original title for reference.
    const originalTitle = story.title
    
    // Determine a maximum task duration based on whether this block is problematic.
    const isProblematicBlock = problematicBlock && story.title === problematicBlock
    const maxTaskDuration = isProblematicBlock 
      ? Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 3) // More aggressive splitting for problem blocks (e.g. 30 mins)
      : Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 2)  // Standard limit (e.g. 45 mins)
    
    // First pass: Process each task, splitting tasks that are too long or would push cumulative work time over the limit.
    story.tasks.forEach((task, taskIndex) => {
      // Check if adding the task would exceed the allowed continuous work time.
      const wouldExceedLimit = (cumulativeWorkTime + task.duration) > DURATION_RULES.MAX_WORK_WITHOUT_BREAK
      
      // If the task is too long or would push the limit, split it into smaller parts.
      if (task.duration > maxTaskDuration || wouldExceedLimit) {
        console.log(`Splitting task "${task.title}" (${task.duration} minutes) into smaller parts`)
        
        // Calculate effective max duration for splitting, considering remaining work time.
        const effectiveMaxTaskDuration = Math.min(
          maxTaskDuration, 
          wouldExceedLimit ? DURATION_RULES.MAX_WORK_WITHOUT_BREAK - cumulativeWorkTime : maxTaskDuration
        )
        
        const numParts = Math.max(2, Math.ceil(task.duration / effectiveMaxTaskDuration))
        let remainingDuration = task.duration
        
        // Split the task into parts.
        for (let i = 0; i < numParts; i++) {
          // Reset cumulative work time after each part assuming a break is inserted.
          if (i > 0) {
            cumulativeWorkTime = 0
          }
          
          // Determine the duration of the current part, rounding to the nearest block.
          const rawPartDuration = (i === numParts - 1) 
            ? remainingDuration 
            : Math.min(effectiveMaxTaskDuration, remainingDuration)
          const partDuration = roundToNearestBlock(rawPartDuration)
          remainingDuration -= partDuration
          
          // Update cumulative work time with this part.
          cumulativeWorkTime += partDuration
          
          // Create a new task object representing this part.
          const newTask: ProcessedTask = {
            ...task,
            title: `${task.title} (Part ${i + 1} of ${numParts})`,
            duration: partDuration,
            difficulty: task.difficulty || determineDifficulty(partDuration),
            needsSplitting: false,
            suggestedBreaks: [],
            isFlexible: task.isFlexible,
            taskCategory: task.taskCategory,
            projectType: task.projectType,
            isFrog: task.isFrog,
            originalTitle: task.title // Preserve original title for reference.
          }
          
          // Insert a break after each part except the final one.
          if (i < numParts - 1) {
            newTask.suggestedBreaks.push({
              after: partDuration,
              duration: DURATION_RULES.LONG_BREAK,
              reason: "Required break between task segments"
            })
            cumulativeWorkTime = 0 // Reset cumulative work time after a break.
          }
          
          updatedTasks.push(newTask)
        }
      } else {
        // For tasks that are short enough, round duration and track cumulative work time.
        const roundedDuration = roundToNearestBlock(task.duration)
        cumulativeWorkTime += roundedDuration
        
        const newTask: ProcessedTask = {
          ...task,
          duration: roundedDuration,
          // Preserve any existing break suggestions.
          suggestedBreaks: [...(task.suggestedBreaks || [])],
          isFlexible: task.isFlexible,
          taskCategory: task.taskCategory,
          projectType: task.projectType,
          isFrog: task.isFrog
        }
        
        // If nearing the work limit (70% threshold), add a preemptive long break.
        if (cumulativeWorkTime >= (DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.7)) {
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.LONG_BREAK,
            reason: "Preemptive break to prevent excessive work time"
          })
          cumulativeWorkTime = 0 // Reset after adding a break.
        } else if (taskIndex < story.tasks.length - 1) {
          // Otherwise, add a short break between tasks if not the last one.
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.SHORT_BREAK,
            reason: "Short break between tasks"
          })
        }
        
        updatedTasks.push(newTask)
      }
    })
    
    // For a problematic story, perform a second pass to ensure no continuous work exceeds limits.
    if (isProblematicBlock) {
      console.log(`Found story that caused the error: ${story.title}`)
      story.originalTitle = originalTitle  // Preserve the original title.
      
      let runningWorkTime = 0
      const finalTasks: ProcessedTask[] = []
      
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i]
        
        // Insert an additional break if adding the task would exceed the limit.
        if (runningWorkTime + task.duration > DURATION_RULES.MAX_WORK_WITHOUT_BREAK) {
          console.log(`Inserting additional break before task "${task.title}" (running work time: ${runningWorkTime})`)
          if (!task.suggestedBreaks || task.suggestedBreaks.length === 0) {
            task.suggestedBreaks = [{
              after: 0,
              duration: DURATION_RULES.LONG_BREAK,
              reason: "Required break to prevent excessive consecutive work time"
            }]
          }
          runningWorkTime = task.duration
        } else {
          runningWorkTime += task.duration
        }
        
        finalTasks.push(task)
        
        // Reset running time if the task ends with a break.
        if (task.suggestedBreaks && task.suggestedBreaks.some(b => b.after === task.duration)) {
          runningWorkTime = 0
        }
      }
      
      // Replace the story's tasks with the final adjusted list.
      story.tasks = finalTasks
    } else {
      // For non-problematic stories, use the tasks from the first pass.
      story.tasks = updatedTasks
    }
    
    // Recalculate the overall estimated duration of the story, including both work and breaks.
    recalculateStoryDuration(story)
  })
  
  return modifiedStories
};

// recalculateStoryDuration computes a story's total duration by summing work and break times,
// then rounding to the nearest allowed block.
function recalculateStoryDuration(story: ProcessedStory): void {
  const totalWorkTime = story.tasks.reduce((sum, task) => sum + task.duration, 0)
  const totalBreakTime = story.tasks.reduce(
    (sum, task) => sum + (task.suggestedBreaks?.reduce((bSum, b) => bSum + b.duration, 0) || 0),
    0
  )
  
  story.estimatedDuration = roundToNearestBlock(totalWorkTime + totalBreakTime)
  console.log(`Recalculated duration for "${story.title}": ${story.estimatedDuration} minutes (work: ${totalWorkTime}, breaks: ${totalBreakTime})`)
}

// createSession builds a session from processed stories, handles retries with exponential backoff,
// validates the total duration, saves the session, and returns the session data.
const createSession = async (stories: ProcessedStory[], startTime: string, maxRetries = 1) => {
  let currentStories = [...stories]
  let retryCount = 0
  let lastError = null
  
  // Build a mapping of story titles (current, original, and synthetic from task parts)
  // to help the server match stories during session creation.
  const titleToStoryMap = new Map<string, ProcessedStory>()
  currentStories = modifyStoriesForRetry(currentStories, {
    details: { preventiveModification: true }
  })
  currentStories.forEach(story => {
    titleToStoryMap.set(story.title, story)
    if (story.originalTitle && story.originalTitle !== story.title) {
      titleToStoryMap.set(story.originalTitle, story)
    }
    story.tasks.forEach(task => {
      if (task.title.includes('Part') && task.originalTitle) {
        const syntheticStoryTitle = `${story.title}: ${task.title}`
        titleToStoryMap.set(syntheticStoryTitle, story)
        const baseStoryTitle = `${story.title}: ${task.originalTitle}`
        titleToStoryMap.set(baseStoryTitle, story)
      }
    })
  })
  
  console.log(`Created mapping for ${titleToStoryMap.size} potential story titles`)
  
  // Validate overall session duration: must be at least the minimum and a multiple of the block size.
  const totalDuration = currentStories.reduce((sum, story) => sum + story.estimatedDuration, 0)
  if (totalDuration < DURATION_RULES.MIN_DURATION || totalDuration % DURATION_RULES.BLOCK_SIZE !== 0) {
    throw new Error(`Invalid total duration: ${totalDuration} minutes. Must be at least ${DURATION_RULES.MIN_DURATION} minutes and a multiple of ${DURATION_RULES.BLOCK_SIZE} minutes.`)
  }
  
  // Retry loop for session creation.
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to create session (attempt ${retryCount + 1}/${maxRetries})`)
      console.log('Total duration:', totalDuration, 'minutes')
      
      // Ensure every task has a unique ID; generate one if missing.
      currentStories.forEach(story => {
        story.tasks.forEach(task => {
          if (!task.id) {
            task.id = crypto.randomUUID();
            console.log(`Added missing ID to task: ${task.title}`);
          }
        });
      });
      
      // Prepare the request payload, including the stories, start time, and a mapping for story titles.
      const request = {
        stories: currentStories,
        startTime,
        storyMapping: Array.from(titleToStoryMap.keys()).map(title => ({
          possibleTitle: title,
          originalTitle: titleToStoryMap.get(title)?.originalTitle || titleToStoryMap.get(title)?.title
        }))
      }
      
      const response = await fetch("/api/tasks/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      })

      // Retrieve the raw response text to preempt JSON parsing issues.
      const rawText = await response.text()
      
      // Enforce a response size limit to prevent processing overly large payloads.
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
        const cleanedText = rawText.replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').trim()
        try {
          data = JSON.parse(cleanedText)
        } catch (secondaryParseError) {
          throw new Error('Failed to parse API response as JSON', {
            cause: {
              code: 'PARSE_ERROR',
              originalError: parseError,
              secondaryError: secondaryParseError,
              rawResponse: rawText.substring(0, 1000) + '...'
            }
          })
        }
      }
      
      // If the API returns an error, throw it with detailed info.
      if (!response.ok) {
        if (isApiError(data)) {
          const errorDetails = data.details 
            ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
            : ''
          throw new Error(`${data.error}${errorDetails}`, { cause: data })
        }
        throw new Error(data.error || 'Failed to create session', { cause: data })
      }

      // Validate that the response has the expected structure.
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
      
      for (const block of data.storyBlocks) {
        if (!block.title || !block.timeBoxes || !Array.isArray(block.timeBoxes)) {
          throw new Error('Invalid story block structure', {
            cause: { code: 'INVALID_BLOCK_STRUCTURE', block }
          })
        }
      }
      
      // Validate total duration; if missing, calculate it from the story blocks.
      if (typeof data.totalDuration !== 'number' || data.totalDuration <= 0) {
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
        data.totalDuration = calculatedTotalDuration
        console.log(`Set totalDuration to calculated value: ${calculatedTotalDuration} minutes`)
      }

      // --- Session Saving Logic ---
      try {
        const today = new Date(startTime).toISOString().split('T')[0]
        console.log(`Saving session for date: ${today} with data:`, {
          summary: {
            totalDuration: data.totalDuration,
            storyBlocksCount: data.storyBlocks.length,
            startTime
          }
        })
        
        // Build a session object with required fields for storage.
        const sessionToSave = {
          ...data,
          status: "planned",
          totalDuration: data.totalDuration,
          lastUpdated: new Date().toISOString(),
          totalSessions: 1,
          startTime: startTime,
          endTime: new Date(new Date(startTime).getTime() + (data.totalDuration * 60 * 1000)).toISOString(),
          storyBlocks: data.storyBlocks.map((block: any, index: number) => ({
            ...block,
            id: block.id || `story-${index}-${Date.now()}`,
            progress: 0,
            timeBoxes: (block.timeBoxes || []).map((timeBox: any, boxIndex: number) => ({
              ...timeBox,
              status: timeBox.status || 'todo',
              tasks: (timeBox.tasks || []).map((task: any) => ({
                ...task,
                status: task.status || 'todo'
              }))
            }))
          }))
        }
        
        // Save the session using the SessionStorageService.
        await sessionStorage.saveSession(today, sessionToSave);
        console.log(`Session saved using SessionStorageService for date: ${today}`)
        
        // Verify that the session was saved.
        const savedSession = await sessionStorage.getSession(today);
        if (!savedSession) {
          console.error('Failed to verify saved session - not found in session storage');
          throw new Error('Session was not properly saved to storage');
        } else {
          console.log(`Session successfully saved and verified with ${savedSession.storyBlocks?.length || 0} story blocks`);
        }
        
        return data;
      } catch (error) {
        console.error('Failed to save session:', error)
        throw new Error('Failed to save session to storage')
      }
    } catch (error) {
      console.error(`Session creation attempt ${retryCount + 1} failed:`, error)
      lastError = error
      
      // Determine if the error is due to rate limiting by checking keywords.
      const isRateLimitError = 
        (error instanceof Error && (
          error.message.includes('429') || 
          error.message.includes('529') || 
          error.message.includes('rate limit') ||
          error.message.includes('overloaded')
        ));
      
      // Check if it’s an overloaded error (specific 529 error).
      const isOverloadedError = isRateLimitError && 
        (error instanceof Error && (
          error.message.includes('529') || 
          error.message.includes('overloaded')
        ));
      
      // Decide if we should retry the request: parsing or rate limit errors are retryable.
      const shouldRetry = (error instanceof Error && 
        (error.message.includes('parse') || error.message.includes('JSON'))) || isRateLimitError;
      
      if (isRateLimitError) {
        console.warn('Rate limit error detected. Adding longer backoff before retry.');
      }
      
      // If maximum retries reached or error is not retryable, break the loop.
      if (retryCount >= maxRetries - 1 || !shouldRetry) {
        console.error(`Maximum retry limit (${maxRetries}) reached or non-retryable error. Giving up.`)
        break
      }
      
      // If needed, modify the stories based on error details before retrying.
      if (!shouldRetry) {
        currentStories = modifyStoriesForRetry(currentStories, 
          error instanceof Error ? error.cause || error : error)
      }
      
      retryCount++
      
      // Calculate backoff delay using exponential backoff and extra delay for rate limit errors.
      const baseDelay = shouldRetry ? 2000 : 1000;
      let backoffDelay = baseDelay * Math.pow(2, retryCount);
      
      if (isRateLimitError) {
        backoffDelay = Math.max(backoffDelay, 5000) * 2; // Minimum 10 seconds.
        if (isOverloadedError) {
          backoffDelay = Math.max(backoffDelay, 15000); // Minimum 15 seconds.
          console.log(`529 Overloaded error detected. Using extended backoff: ${backoffDelay}ms`);
        } else {
          console.log(`Rate limit error detected. Using extended backoff: ${backoffDelay}ms`);
        }
      }
      
      console.log(`Waiting ${backoffDelay}ms before retry ${retryCount + 1}`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  // If all retries fail, throw the last encountered error.
  if (lastError) {
    if (lastError instanceof Error) {
      throw lastError
    } else {
      throw new Error('Failed to create session after multiple attempts', { cause: lastError })
    }
  }
  
  throw new Error('Failed to create session due to unknown error')
}

// Export the brainDumpService as a constant object.
export const brainDumpService = {
  processTasks,
  createSession
} as const
