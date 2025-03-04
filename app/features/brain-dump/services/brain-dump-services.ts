/**
 * Brain Dump Service Module
 * 
 * This service handles the flow of tasks from raw user input to organized work plans:
 * 
 * User Flow:
 * 1. User enters a list of tasks as plain text
 * 2. Tasks are processed by AI to add structure, duration, and difficulty
 * 3. The processed tasks are organized into a workplan with timeboxes
 * 4. The workplan is saved for the user to access later
 */

import type { DifficultyLevel } from "@/lib/types"
import type { ProcessedStory, ProcessedTask } from "../types"
import { WorkPlanStorageService } from "@/app/features/workplan-manager/services/workplan-storage.service"
import { isApiError } from "../types"
import { 
  DURATION_RULES,
  roundToNearestBlock
} from "@/lib/durationUtils"

// Create a singleton instance of WorkPlanStorageService for persisting workplans
const workplanStorage = new WorkPlanStorageService()

/**
 * PART 1: TASK ANALYSIS AND PROCESSING
 */

/**
 * Helper: Determine appropriate difficulty level based on task duration
 * 
 * @param duration - The task duration in minutes
 * @returns The appropriate difficulty level (low, medium, high)
 */
const determineDifficulty = (duration: number): DifficultyLevel => {
  if (duration <= 30) return 'low';       // Short tasks (30 min or less)
  if (duration <= 60) return 'medium';    // Medium tasks (31-60 min)
  return 'high';                          // Long tasks (over 60 min)
};

/**
 * Process raw task input from the user through AI analysis
 * 
 * This function:
 * 1. Sends the raw task list to the AI API endpoint
 * 2. Validates the response structure
 * 3. Ensures each task has proper duration and difficulty values
 * 
 * @param taskList - Array of raw task descriptions entered by the user
 * @returns Processed stories with structured task data
 * @throws Error if processing fails
 */
const processTasks = async (taskList: string[]) => {
  // STEP 1: Send tasks to the AI for processing
  const response = await fetch("/api/tasks/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskList })
  })

  // STEP 2: Parse the JSON response
  const data = await response.json()
  
  // STEP 3: Handle error responses
  if (!response.ok) {
    if (isApiError(data)) {
      // Format API error message with details if available
      const errorDetails = data.details 
        ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}`
        : ''
      throw new Error(`${data.error}${errorDetails}`)
    }
    throw new Error(data.error || 'Failed to process tasks')
  }

  // STEP 4: Validate and enhance the response data
  if (data.stories) {
    data.stories = data.stories.map((story: ProcessedStory) => ({
      ...story,
      tasks: story.tasks.map((task: ProcessedTask) => {
        // Ensure each task has a valid duration (use minimum if missing)
        const validDuration = task.duration || DURATION_RULES.MIN_DURATION;
        return {
          ...task,
          duration: validDuration,
          // Set difficulty based on duration if not provided
          difficulty: task.difficulty || determineDifficulty(validDuration)
        };
      })
    }))
  }

  // STEP 5: Return the processed data
  return data
};

/**
 * PART 2: WORKPLAN CREATION
 */

/**
 * Prepare stories for workplan creation by ensuring tasks are properly sized
 * and breaks are added where needed
 * 
 * This function handles:
 * 1. Splitting long tasks into smaller segments
 * 2. Adding breaks between tasks to prevent burnout
 * 3. Correcting problems that may have caused errors in previous attempts
 * 
 * @param stories - Original processed stories from AI
 * @param error - Optional error from previous creation attempt
 * @returns Modified stories ready for workplan creation
 */
const modifyStoriesForRetry = (stories: ProcessedStory[], error: any): ProcessedStory[] => {
  // Create a deep copy to avoid modifying the original stories
  const modifiedStories = JSON.parse(JSON.stringify(stories)) as ProcessedStory[]
  
  console.log('Modifying stories for retry. Error details:', error?.details)
  
  // Check if a specific story block caused problems
  const problematicBlock = error?.details?.block
  
  // Process each story to ensure tasks are properly sized with breaks
  modifiedStories.forEach(story => {
    console.log(`Processing story "${story.title}" with ${story.tasks.length} tasks`)
    const updatedTasks: ProcessedTask[] = []
    let cumulativeWorkTime = 0
    
    // Save original title for reference (useful for error tracking)
    const originalTitle = story.title
    
    // Determine maximum task duration - more strict for problematic blocks
    const isProblematicBlock = problematicBlock && story.title === problematicBlock
    const maxTaskDuration = isProblematicBlock 
      ? Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 3) // Aggressive splitting for problem blocks (~30 mins)
      : Math.floor(DURATION_RULES.MAX_WORK_WITHOUT_BREAK / 2) // Standard limit (~45 mins)
    
    // STEP 1: Process each task, splitting long ones and tracking cumulative work time
    story.tasks.forEach((task, taskIndex) => {
      // Check if adding this task would exceed continuous work time limit
      const wouldExceedLimit = (cumulativeWorkTime + task.duration) > DURATION_RULES.MAX_WORK_WITHOUT_BREAK
      
      // CASE A: Task needs splitting (too long or would exceed work limit)
      if (task.duration > maxTaskDuration || wouldExceedLimit) {
        console.log(`Splitting task "${task.title}" (${task.duration} minutes) into smaller parts`)
        
        // Calculate effective max duration considering remaining work time
        const effectiveMaxTaskDuration = Math.min(
          maxTaskDuration, 
          wouldExceedLimit ? DURATION_RULES.MAX_WORK_WITHOUT_BREAK - cumulativeWorkTime : maxTaskDuration
        )
        
        // Calculate number of parts needed
        const numParts = Math.max(2, Math.ceil(task.duration / effectiveMaxTaskDuration))
        let remainingDuration = task.duration
        
        // Create multiple smaller tasks for each part
        for (let i = 0; i < numParts; i++) {
          // Reset cumulative work time after each part (assumes breaks between parts)
          if (i > 0) {
            cumulativeWorkTime = 0
          }
          
          // Calculate duration for this part
          const rawPartDuration = (i === numParts - 1) 
            ? remainingDuration  // Last part gets whatever is left
            : Math.min(effectiveMaxTaskDuration, remainingDuration)  // Other parts get max allowed
          const partDuration = roundToNearestBlock(rawPartDuration)  // Round to nearest 5 minutes
          remainingDuration -= partDuration
          
          // Track cumulative work time
          cumulativeWorkTime += partDuration
          
          // Create task object for this part
          const newTask: ProcessedTask = {
            ...task,
            title: `${task.title} (Part ${i + 1} of ${numParts})`,
            duration: partDuration,
            difficulty: task.difficulty || determineDifficulty(partDuration),
            needsSplitting: false,  // Already split
            suggestedBreaks: [],
            isFlexible: task.isFlexible,
            taskCategory: task.taskCategory,
            projectType: task.projectType,
            isFrog: task.isFrog,
            originalTitle: task.title  // Store original for reference
          }
          
          // Add a break after all parts except the final one
          if (i < numParts - 1) {
            newTask.suggestedBreaks.push({
              after: partDuration,
              duration: DURATION_RULES.LONG_BREAK,
              reason: "Required break between task segments"
            })
            cumulativeWorkTime = 0  // Reset work time after a break
          }
          
          updatedTasks.push(newTask)
        }
      } 
      // CASE B: Task is short enough - keep as is with proper breaks
      else {
        // Round duration to nearest allowed block
        const roundedDuration = roundToNearestBlock(task.duration)
        cumulativeWorkTime += roundedDuration
        
        // Create normalized task object
        const newTask: ProcessedTask = {
          ...task,
          duration: roundedDuration,
          suggestedBreaks: [...(task.suggestedBreaks || [])],
          isFlexible: task.isFlexible,
          taskCategory: task.taskCategory,
          projectType: task.projectType,
          isFrog: task.isFrog
        }
        
        // Add appropriate breaks based on cumulative work time
        // CASE B.1: Approaching work limit - add long break
        if (cumulativeWorkTime >= (DURATION_RULES.MAX_WORK_WITHOUT_BREAK * 0.7)) {
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.LONG_BREAK,
            reason: "Preemptive break to prevent excessive work time"
          })
          cumulativeWorkTime = 0  // Reset work time counter
        } 
        // CASE B.2: Not the last task - add short break
        else if (taskIndex < story.tasks.length - 1) {
          newTask.suggestedBreaks.push({
            after: roundedDuration,
            duration: DURATION_RULES.SHORT_BREAK,
            reason: "Short break between tasks"
          })
        }
        
        updatedTasks.push(newTask)
      }
    })
    
    // STEP 2: For problematic stories, do another pass to ensure no continuous work exceeds limits
    if (isProblematicBlock) {
      console.log(`Found story that caused the error: ${story.title}`)
      story.originalTitle = originalTitle  // Keep original title for reference
      
      let runningWorkTime = 0
      const finalTasks: ProcessedTask[] = []
      
      // Second pass - extra cautious to ensure no work time exceeds limit
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i]
        
        // Insert an additional break if adding this task would exceed the limit
        if (runningWorkTime + task.duration > DURATION_RULES.MAX_WORK_WITHOUT_BREAK) {
          console.log(`Inserting additional break before task "${task.title}" (running work time: ${runningWorkTime})`)
          if (!task.suggestedBreaks || task.suggestedBreaks.length === 0) {
            task.suggestedBreaks = [{
              after: 0,
              duration: DURATION_RULES.LONG_BREAK,
              reason: "Required break to prevent excessive consecutive work time"
            }]
          }
          runningWorkTime = task.duration  // Reset counter
        } else {
          runningWorkTime += task.duration
        }
        
        finalTasks.push(task)
        
        // Reset running time if task ends with a break
        if (task.suggestedBreaks && task.suggestedBreaks.some(b => b.after === task.duration)) {
          runningWorkTime = 0
        }
      }
      
      // Replace tasks with final adjusted list
      story.tasks = finalTasks
    } else {
      // For non-problematic stories, use the first-pass tasks
      story.tasks = updatedTasks
    }
    
    // STEP 3: Recalculate the overall story duration
    recalculateStoryDuration(story)
  })
  
  return modifiedStories
};

/**
 * Helper: Recalculate a story's total duration after task modifications
 * 
 * @param story - The story to update
 */
function recalculateStoryDuration(story: ProcessedStory): void {
  // Add up all task durations
  const totalWorkTime = story.tasks.reduce((sum, task) => sum + task.duration, 0)
  
  // Add up all break durations from suggested breaks
  const totalBreakTime = story.tasks.reduce(
    (sum, task) => sum + (task.suggestedBreaks?.reduce((bSum, b) => bSum + b.duration, 0) || 0),
    0
  )
  
  // Update the story's duration and round to nearest block
  story.estimatedDuration = roundToNearestBlock(totalWorkTime + totalBreakTime)
  console.log(`Recalculated duration for "${story.title}": ${story.estimatedDuration} minutes (work: ${totalWorkTime}, breaks: ${totalBreakTime})`)
}

/**
 * Create a workplan from processed stories with intelligent retry handling
 * 
 * This function:
 * 1. Prepares stories for workplan creation
 * 2. Sends data to the API to create timeboxes
 * 3. Handles errors with retries and exponential backoff
 * 4. Validates and saves the final workplan
 * 
 * @param stories - Processed stories from AI analysis
 * @param startTime - ISO string of when the workplan should start
 * @param maxRetries - Maximum number of retry attempts
 * @returns The created workplan object
 * @throws Error if workplan creation fails after retries
 */
const createWorkPlan = async (stories: ProcessedStory[], startTime: string, maxRetries = 1) => {
  let currentStories = [...stories]
  let retryCount = 0
  let lastError = null
  
  // STEP 1: Build mapping of possible story titles to handle variations in API responses
  const titleToStoryMap = new Map<string, ProcessedStory>()
  
  // Preemptively modify stories to avoid common errors
  currentStories = modifyStoriesForRetry(currentStories, {
    details: { preventiveModification: true }
  })
  
  // Build comprehensive mapping of all possible story title variations
  currentStories.forEach(story => {
    // Map main title
    titleToStoryMap.set(story.title, story)
    
    // Map original title if different
    if (story.originalTitle && story.originalTitle !== story.title) {
      titleToStoryMap.set(story.originalTitle, story)
    }
    
    // Map split task variations (for parts of split tasks)
    story.tasks.forEach(task => {
      if (task.title.includes('Part') && task.originalTitle) {
        const syntheticStoryTitle = `${story.title}: ${task.title}`
        titleToStoryMap.set(syntheticStoryTitle, story)
        const baseStoryTitle = `${story.title}: ${task.originalTitle}`
        titleToStoryMap.set(baseStoryTitle, story)
      }
    })
  })

  // STEP 2: Attempt workplan creation with retries
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to create workplan (attempt ${retryCount + 1}/${maxRetries})`)
      
      // Ensure every task has a unique ID
      currentStories.forEach(story => {
        story.tasks.forEach(task => {
          if (!task.id) {
            task.id = crypto.randomUUID();
            console.log(`Added missing ID to task: ${task.title}`);
          }
        });
      });
      
      // STEP 2.1: Prepare the request data
      const request = {
        stories: currentStories,
        startTime,
        // Send mapping data to help API match story variants
        storyMapping: Array.from(titleToStoryMap.keys()).map(title => ({
          possibleTitle: title,
          originalTitle: titleToStoryMap.get(title)?.originalTitle || titleToStoryMap.get(title)?.title
        }))
      }

      // STEP 2.2: Send request to create a workplan with timeboxes
      const response = await fetch("/api/tasks/create-workplan", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(request)
      })

      // STEP 2.3: Validate response content type
      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        console.error("Received non-JSON response:", contentType)
        const rawText = await response.text()
        console.error("Raw response:", rawText.substring(0, 1000))
        throw new Error("Server returned non-JSON response", {
          cause: {
            contentType,
            statusCode: response.status,
            responsePreview: rawText.substring(0, 1000)
          }
        })
      }

      // STEP 2.4: Parse JSON response with robust error handling
      let data
      try {
        const rawText = await response.text()
        
        // Check for empty response
        if (!rawText.trim()) {
          throw new Error("Empty response from server")
        }

        // Check for HTML content (error page)
        if (rawText.trim().startsWith("<!DOCTYPE") || rawText.trim().startsWith("<html")) {
          console.error("Received HTML response instead of JSON")
          throw new Error("Server returned HTML instead of JSON", {
            cause: {
              responsePreview: rawText.substring(0, 1000)
            }
          })
        }

        // First attempt at parsing JSON
        try {
          data = JSON.parse(rawText)
        } catch (parseError) {
          console.error("Failed to parse response as JSON:", parseError)
          console.log("Raw response:", rawText.substring(0, 1000))
          
          // Fallback: Try cleaning the response before parsing
          const cleanedText = rawText
            .replace(/\n/g, "")
            .replace(/\r/g, "")
            .replace(/\t/g, "")
            .trim()
          
          try {
            data = JSON.parse(cleanedText)
          } catch (secondaryParseError) {
            throw new Error("Failed to parse API response as JSON", {
              cause: {
                originalError: parseError,
                secondaryError: secondaryParseError,
                rawResponse: rawText.substring(0, 1000)
              }
            })
          }
        }
      } catch (error) {
        // If we get here, we failed to parse the response
        console.error("Failed to process response:", error)
        
        // Check if it's a rate limit or server error (retryable)
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Server error (${response.status})`, {
            cause: {
              statusCode: response.status,
              error
            }
          })
        }
        
        throw error
      }

      // STEP 2.5: Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid workplan response: not an object', {
          cause: { code: 'INVALID_RESPONSE', response: data }
        })
      }
      
      if (!data.storyBlocks || !Array.isArray(data.storyBlocks)) {
        throw new Error('Invalid workplan response: missing storyBlocks array', {
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
      
      // STEP 2.6: Validate total duration
      if (typeof data.totalDuration !== 'number' || data.totalDuration <= 0) {
        console.warn('Workplan response missing valid totalDuration, calculating from story blocks')
        // Calculate total duration from story blocks if not provided
        const calculatedTotalDuration = data.storyBlocks.reduce(
          (sum: number, block: any) => sum + (block.totalDuration || 0), 
          0
        )
        if (calculatedTotalDuration <= 0) {
          throw new Error('Cannot calculate valid workplan duration from story blocks', {
            cause: { code: 'INVALID_DURATION', response: data }
          })
        }
        data.totalDuration = calculatedTotalDuration
        console.log(`Set totalDuration to calculated value: ${calculatedTotalDuration} minutes`)
      }

      // STEP 3: Save the workplan
      try {
        const today = new Date(startTime).toISOString().split('T')[0]
        console.log(`Saving workplan for date: ${today} with data:`, {
          summary: {
            totalDuration: data.totalDuration,
            storyBlocksCount: data.storyBlocks.length,
            startTime
          }
        })
        
        // STEP 3.1: Prepare workplan object for storage
        const workplanToSave = {
          ...data,
          id: today,  // Use date as ID
          status: "planned",  // Initial status
          totalDuration: data.totalDuration,
          lastUpdated: new Date().toISOString(),
          totalSessions: 1,  // First session
          startTime: startTime,
          // Calculate end time based on total duration
          endTime: new Date(new Date(startTime).getTime() + (data.totalDuration * 60 * 1000)).toISOString(),
          // Ensure all story blocks have IDs and initial status values
          storyBlocks: data.storyBlocks.map((block: any, index: number) => ({
            ...block,
            id: block.id || `story-${index}-${Date.now()}`,
            progress: 0,  // Initial progress
            timeBoxes: (block.timeBoxes || []).map((timeBox: any, boxIndex: number) => ({
              ...timeBox,
              status: timeBox.status || 'todo',  // Default status
              tasks: (timeBox.tasks || []).map((task: any) => ({
                ...task,
                status: task.status || 'todo'  // Default status
              }))
            }))
          }))
        }
        
        // STEP 3.2: Save the workplan using storage service
        await workplanStorage.saveWorkPlan(workplanToSave)
        console.log(`WorkPlan saved using WorkPlanStorageService for date: ${today}`)
        
        // STEP 3.3: Verify that the workplan was saved
        const savedWorkPlan = await workplanStorage.getWorkPlan(today)
        if (!savedWorkPlan) {
          console.error('Failed to verify saved workplan - not found in workplan storage')
          throw new Error('WorkPlan was not properly saved to storage')
        } else {
          console.log(`WorkPlan successfully saved and verified with ${savedWorkPlan.storyBlocks?.length || 0} story blocks`)
        }
        
        // STEP 3.4: Return the created workplan
        return workplanToSave
      } catch (error) {
        console.error('Failed to save workplan:', error)
        throw new Error('Failed to save workplan to storage')
      }
    } catch (error) {
      console.error(`Workplan creation attempt ${retryCount + 1} failed:`, error)
      lastError = error
      
      // STEP 4: Determine if error is retryable
      const isRetryableError = 
        error instanceof Error && (
          // Parse errors
          error.message.includes('parse') || 
          error.message.includes('JSON') ||
          // Rate limit errors
          error.message.includes('429') ||
          error.message.includes('529') ||
          error.message.includes('rate limit') ||
          error.message.includes('overloaded') ||
          // Server errors
          error.message.includes('Server error') ||
          // Non-JSON responses
          error.message.includes('non-JSON response') ||
          error.message.includes('HTML instead of JSON')
        )
      
      // Check if we've hit max retries or error isn't retryable
      if (retryCount >= maxRetries - 1 || !isRetryableError) {
        console.error(`Maximum retry limit (${maxRetries}) reached or non-retryable error. Giving up.`)
        break
      }
      
      // STEP 5: Retry with exponential backoff
      retryCount++
      
      // Calculate backoff delay - longer for server errors
      const baseDelay = isRetryableError ? 2000 : 1000
      const backoffDelay = baseDelay * Math.pow(2, retryCount)
      
      console.log(`Waiting ${backoffDelay}ms before retry ${retryCount + 1}`)
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
  }
  
  // If we get here, all retries failed
  if (lastError) {
    throw lastError
  }
  
  throw new Error('Failed to create workplan due to unknown error')
}

/**
 * Exported service object with public API methods
 */
export const brainDumpService = {
  processTasks,     // Step 1: Process raw tasks
  createWorkPlan    // Step 2: Create workplan from processed tasks
} as const