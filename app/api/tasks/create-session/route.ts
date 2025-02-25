import { Anthropic } from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  DURATION_RULES as BaseDurationRules,
  TimeBox as DurationTimeBox,
  calculateDurationSummary,
  calculateTotalDuration,
  validateTaskDuration,
  generateSchedulingSuggestion,
  suggestSplitAdjustment
} from '@/lib/durationUtils'

// Extend the duration rules to include the maximum consecutive work time
const DURATION_RULES = {
  ...BaseDurationRules,
  MAX_WORK_WITHOUT_BREAK: 90 // Maximum consecutive work minutes without a substantial break
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Input validation schemas
const TaskBreakSchema = z.object({
  after: z.number(),
  duration: z.number(),
  reason: z.string()
})

const TaskSchema = z.object({
  title: z.string(),
  duration: z.number(),
  isFrog: z.boolean(),
  type: z.enum(['focus', 'learning', 'review']),
  isFlexible: z.boolean(),
  suggestedBreaks: z.array(TaskBreakSchema)
})

const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  icon: z.string(),
  estimatedDuration: z.number(),
  type: z.enum(['timeboxed', 'flexible', 'milestone']),
  project: z.string(),
  category: z.string(),
  tasks: z.array(TaskSchema)
})

const RequestSchema = z.object({
  stories: z.array(StorySchema),
  startTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format for startTime" }
  )
})

class SessionCreationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'SessionCreationError'
  }
}

// Add types for response data structure
interface TimeBoxTask {
  title: string
  duration: number
}

interface TimeBox extends DurationTimeBox {
  startTime: string
  tasks: TimeBoxTask[]
}

interface StoryBlock {
  title: string
  summary: string
  icon: string
  timeBoxes: TimeBox[]
  totalDuration: number
  suggestions?: Array<{
    type: string
    task: string
    message: string
    details: Record<string, any>
  }>
}

interface SessionResponse {
  summary: {
    totalSessions: number
    startTime: string
    endTime: string
    totalDuration: number
  }
  storyBlocks: StoryBlock[]
}

// Add helper functions for task title handling
function getValidDurationRange(task: TimeBoxTask): { min: number; max: number } {
  return {
    min: DURATION_RULES.MIN_DURATION,
    max: DURATION_RULES.MAX_DURATION
  }
}

function getDurationDescription(range: { min: number; max: number }, type: string): string {
  return `${range.min}-${range.max} minutes (${type})`
}

function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove part numbers from split tasks
    .replace(/\s*\(part \d+ of \d+\)\s*/i, '')
    // Don't strip FROG from title matching since it's a priority indicator
    // Remove common time expressions to improve matching
    .replace(/\s*\d+\s*(?:hour|hr|h)s?\s*(?:of|for|on|in)?\s*(?:work|working)?\s*(?:on|with|at|in)?\s*/i, ' ')
    .replace(/\s*\d+\s*(?:minute|min|m)s?\s*/i, ' ')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
}

function findMatchingTaskTitle(searchTitle: string, availableTitles: string[]): string | undefined {
  const normalizedSearch = normalizeTaskTitle(searchTitle)
  
  // Log for debugging
  console.log(`Matching title: "${searchTitle}" normalized to "${normalizedSearch}"`)
  
  // Try exact match first (ignoring part numbers and FROG prefix)
  const exactMatch = availableTitles.find(title => {
    const normalizedTitle = normalizeTaskTitle(title)
    console.log(`Comparing with: "${title}" normalized to "${normalizedTitle}"`)
    return normalizedTitle === normalizedSearch
  })
  if (exactMatch) {
    console.log(`Found exact match: "${exactMatch}"`)
    return exactMatch
  }

  // Try contains match (both ways, ignoring part numbers and FROG prefix)
  const containsMatch = availableTitles.find(title => {
    const normalizedTitle = normalizeTaskTitle(title)
    return normalizedTitle.includes(normalizedSearch) ||
           normalizedSearch.includes(normalizedTitle)
  })
  if (containsMatch) {
    console.log(`Found contains match: "${containsMatch}"`)
    return containsMatch
  }

  // Try matching key terms (for project timeline case)
  const searchTerms = normalizedSearch.split(' ').filter(term => 
    term.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'work', 'app', 'development'].includes(term)
  )
  
  console.log(`Searching by key terms: ${searchTerms.join(', ')}`)
  
  // Check for substantial term overlap
  const termMatches = availableTitles.map(title => {
    const normalizedTitle = normalizeTaskTitle(title)
    const matchingTerms = searchTerms.filter(term => normalizedTitle.includes(term))
    return {
      title,
      normalizedTitle,
      matchCount: matchingTerms.length,
      matchRatio: searchTerms.length > 0 ? matchingTerms.length / searchTerms.length : 0
    }
  }).filter(match => match.matchRatio > 0)
  
  // Sort by match ratio (highest first)
  termMatches.sort((a, b) => b.matchRatio - a.matchRatio)
  
  // If we have a match with at least 50% of terms matching, use it
  const bestMatch = termMatches.length > 0 && termMatches[0].matchRatio >= 0.5 ? termMatches[0].title : undefined
  
  if (bestMatch) {
    console.log(`Found term match: "${bestMatch}" with match ratio ${termMatches[0].matchRatio}`)
    return bestMatch
  }

  // No match found
  console.log(`No match found for "${searchTitle}"`)
  return undefined
}

// Add function to check if a task is a split part
function isSplitTaskPart(title: string): boolean {
  return /\(part \d+ of \d+\)$/i.test(title)
}

// Add function to get base task title without part number
function getBaseTaskTitle(title: string): string {
  return title.replace(/\s*\(part \d+ of \d+\)\s*$/i, '').trim()
}

function buildOriginalTasksMap(stories: any[]): Map<string, string> {
  // Create a map of normalized task titles to original task titles
  const tasksMap = new Map<string, string>();
  
  stories.forEach(story => {
    story.tasks.forEach((task: any) => {
      const normalizedTitle = normalizeTaskTitle(task.title);
      tasksMap.set(normalizedTitle, task.title);
    });
  });
  
  return tasksMap;
}

function validateAllTasksIncluded(originalTasksMap: Map<string, string>, scheduledTasks: string[]): {
  isMissingTasks: boolean;
  missingTasks: string[];
  originalTaskCount: number;
  scheduledTaskCount: number;
  scheduledTaskDetails: Record<string, string[]>;
} {
  // Normalize scheduled tasks
  const normalizedScheduledTasks = scheduledTasks.map(task => normalizeTaskTitle(task));
  
  // Group scheduled tasks by base name (to handle split tasks)
  const scheduledTaskGroups: Record<string, string[]> = {};
  scheduledTasks.forEach(task => {
    const baseTitle = getBaseTaskTitle(task);
    if (!scheduledTaskGroups[baseTitle]) {
      scheduledTaskGroups[baseTitle] = [];
    }
    scheduledTaskGroups[baseTitle].push(task);
  });
  
  // Check for missing tasks
  const missingTasks: string[] = [];
  const normalizedOriginalTasks = Array.from(originalTasksMap.keys());
  
  normalizedOriginalTasks.forEach(normalizedOriginal => {
    const originalTitle = originalTasksMap.get(normalizedOriginal);
    if (!originalTitle) return;
    
    // Check if this task was included in the schedule
    const wasIncluded = normalizedScheduledTasks.some(normalizedScheduled => {
      // Direct match
      if (normalizedScheduled.includes(normalizedOriginal) || normalizedOriginal.includes(normalizedScheduled)) {
        return true;
      }
      return false;
    });
    
    if (!wasIncluded) {
      missingTasks.push(originalTitle);
    }
  });
  
  return {
    isMissingTasks: missingTasks.length > 0,
    missingTasks,
    originalTaskCount: normalizedOriginalTasks.length,
    scheduledTaskCount: scheduledTasks.length,
    scheduledTaskDetails: scheduledTaskGroups
  };
}

// Add helper function to insert breaks when work time exceeds maximum allowed
function insertMissingBreaks(storyBlocks: StoryBlock[]): StoryBlock[] {
  // Create a deep copy to avoid modifying the original directly
  const updatedBlocks = JSON.parse(JSON.stringify(storyBlocks));
  
  for (let blockIndex = 0; blockIndex < updatedBlocks.length; blockIndex++) {
    const block = updatedBlocks[blockIndex];
    const updatedTimeBoxes: TimeBox[] = [];
    
    let consecutiveWorkTime = 0;
    let currentTime = new Date();
    
    // Set the start time for the first time box
    if (block.timeBoxes.length > 0) {
      const [hours, minutes] = block.timeBoxes[0].startTime.split(':').map(Number);
      currentTime.setHours(hours, minutes, 0, 0);
    }
    
    for (let i = 0; i < block.timeBoxes.length; i++) {
      const timeBox = block.timeBoxes[i];
      
      // Add the current timeBox to our updated list
      updatedTimeBoxes.push(timeBox);
      
      // Update current time based on this time box
      const [hours, minutes] = timeBox.startTime.split(':').map(Number);
      currentTime.setHours(hours, minutes, 0, 0);
      
      // Get next time after this box
      const nextTime = new Date(currentTime);
      nextTime.setMinutes(nextTime.getMinutes() + timeBox.duration);
      
      // Track consecutive work time
      if (timeBox.type === 'work') {
        consecutiveWorkTime += timeBox.duration;
        
        // Check if we need to insert a break
        if (consecutiveWorkTime > DURATION_RULES.MAX_WORK_WITHOUT_BREAK && 
            (i === block.timeBoxes.length - 1 || block.timeBoxes[i + 1].type === 'work')) {
          
          console.log(`Inserting break after ${timeBox.duration} min work session at ${nextTime.toTimeString().slice(0, 5)} (consecutive work time: ${consecutiveWorkTime} min)`);
          
          // Create a new break time box
          const breakDuration = 15; // Use a long break when hitting the max work threshold
          const breakStartTime = nextTime.toTimeString().slice(0, 5); // Format as HH:MM
          
          const breakTimeBox: TimeBox = {
            type: 'long-break',
            startTime: breakStartTime,
            duration: breakDuration,
            tasks: []
          };
          
          // Add the break
          updatedTimeBoxes.push(breakTimeBox);
          
          // Reset consecutive work time counter
          consecutiveWorkTime = 0;
          
          // Update the next start time for subsequent time boxes
          nextTime.setMinutes(nextTime.getMinutes() + breakDuration);
        }
      } else if (timeBox.type === 'long-break') {
        consecutiveWorkTime = 0;
      } else if (timeBox.type === 'short-break') {
        consecutiveWorkTime = Math.max(0, consecutiveWorkTime - 25); // Reduce accumulated work time
      }
      
      // Update start times for all subsequent time boxes
      if (i < block.timeBoxes.length - 1) {
        for (let j = i + 1; j < block.timeBoxes.length; j++) {
          const nextBox = block.timeBoxes[j];
          nextBox.startTime = nextTime.toTimeString().slice(0, 5);
          
          // Update next time for following boxes
          nextTime.setMinutes(nextTime.getMinutes() + nextBox.duration);
        }
      }
    }
    
    // Update the timeBoxes array with our modified version
    block.timeBoxes = updatedTimeBoxes;
    
    // Recalculate the block's total duration
    const { totalDuration } = calculateDurationSummary(block.timeBoxes);
    block.totalDuration = totalDuration;
  }
  
  return updatedBlocks;
}

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        details: error instanceof Error ? error.message : error
      }, { status: 400 })
    }

    try {
      await RequestSchema.parseAsync(body)
    } catch (error) {
      console.error('Request validation failed:', error)
      return NextResponse.json({
        error: 'Invalid request format',
        code: 'VALIDATION_ERROR',
        details: error instanceof z.ZodError ? error.errors : error
      }, { status: 400 })
    }

    const { stories, startTime } = body
    const startDateTime = new Date(startTime)

    // Create a map of original tasks for validation
    const originalTasksMap = buildOriginalTasksMap(stories);

    // Validate total duration doesn't exceed reasonable limits
    const totalDuration = stories.reduce((acc: number, story: z.infer<typeof StorySchema>) => acc + story.estimatedDuration, 0)
    if (totalDuration > 24 * 60) { // More than 24 hours
      throw new SessionCreationError(
        'Total session duration exceeds maximum limit',
        'DURATION_EXCEEDED',
        { totalDuration, maxDuration: 24 * 60 }
      )
    }

    try {
      // Log input data
      console.log('Creating session with stories:', JSON.stringify(stories, null, 2))
      console.log('Start time:', startDateTime.toLocaleTimeString())

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Create an optimized work session schedule for these stories/tasks. Follow these rules:
          1. Start at ${startDateTime.toLocaleTimeString()}
          2. Session duration rules:
             - First sessions: 20-30 minutes (warm-up/pomodoro style)
             - Middle sessions: 30-60 minutes (flow state)
             - Final sessions: 15-60 minutes (flexible completion)
             - Single tasks: 20-60 minutes
          3. Break scheduling rules:
             - Add 5-minute breaks between regular sessions
             - Add 15-minute breaks after completing 90+ minutes of work
             - Add 5-minute debriefs after completing each story
             - Never schedule more than 90 minutes of work without a substantial break
          4. Task Priority Rules:
             - Tasks marked with 'isFrog: true' are high priority and should be scheduled early
             - DO NOT add "FROG" to task titles - it's only a priority indicator
             - Use original task titles exactly as provided
          5. Group related tasks together
          6. Keep the response concise and well-structured
          7. CRITICAL - Task splitting and duration rules:
             - Each work time box must contain exactly one task or task part
             - Break and debrief time boxes must not contain tasks
             - For tasks longer than 60 minutes:
               * Split into 2-3 parts ONLY, following these rules:
                 - For 120-minute tasks:
                   * Split into 3 parts: First (25-30) + Middle (45-55) + Final (35-45)
                   * Split into 2 parts: First (25-30) + Final (90-95)
                   * NEVER split into more than 3 parts
                   * Total MUST equal 120 ±10 minutes
                 - For 180-minute tasks:
                   * Split into 3 parts: First (25-30) + Middle (90) + Final (60-65)
                   * NEVER split into more than 3 parts
                   * Total MUST equal 180 ±10 minutes
               * Include appropriate breaks between sessions
             - Time box durations:
               * First work sessions: 20-30 minutes
               * Middle work sessions: 30-60 minutes (or up to 90 for 180-min tasks)
               * Final work sessions: 15-60 minutes (or up to 95 for 120-min tasks)
               * Single tasks: 20-60 minutes
               * Short breaks: 5 minutes
               * Long breaks: 15 minutes
               * Debriefs: 5 minutes
             - Each story block's totalDuration must include all work sessions and breaks
             - For split tasks, use the format: "taskTitle (Part X of Y)" in the title field
             - CRITICAL: When splitting tasks:
               * Use 2-3 parts maximum
               * Ensure parts sum to original duration ±10 minutes
               * Follow the duration patterns above
               * NEVER split into 4 or more parts
               * NEVER exceed original duration by more than 10 minutes
          8. CRITICAL - Duration Calculation Rules:
             - The summary.totalDuration MUST equal the sum of ALL story block durations
             - Each story block's totalDuration MUST include:
               * All work session durations
               * All break durations (5 or 15 minutes)
               * Final debrief duration (5 minutes)
             - Double-check all duration calculations before returning
             - Verify that summary.totalDuration matches the sum of block durations
          9. CRITICAL - Title Handling Rules:
             - Use exact task titles from the input - DO NOT modify them
             - DO NOT add "FROG" prefix to any titles
             - For split tasks, only add the part number: "Original Title (Part X of Y)"
             - Preserve original story titles exactly as provided

          Stories:
          ${JSON.stringify(stories, null, 2)}

          CRITICAL RESPONSE FORMAT INSTRUCTIONS:
          1. You MUST return a SINGLE JSON object
          2. Do NOT return multiple separate JSON objects
          3. All stories MUST be included in the storyBlocks array
          4. The response MUST be valid JSON that can be parsed with JSON.parse()
          5. Follow this exact format:

          {
            "summary": {
              "totalSessions": number,
              "startTime": "HH:MM",
              "endTime": "HH:MM",
              "totalDuration": number (minutes, MUST equal sum of all block durations)
            },
            "storyBlocks": [{
              "title": "Story title (exactly as provided)",
              "summary": "Story summary",
              "icon": "emoji",
              "timeBoxes": [{
                "type": "work" | "short-break" | "long-break" | "debrief",
                "startTime": "HH:MM",
                "duration": number,
                "tasks": [{ 
                  title: string (use "Original Title (Part X of Y)" format for split tasks),
                  duration: number (must match time box duration for work sessions)
                }] (empty for breaks/debriefs, exactly one task for work)
              }],
              "totalDuration": number (MUST include work sessions, breaks, and debrief)
            }]
          }`
        }]
      })

      const messageContent = message.content[0]
      if (!('text' in messageContent)) {
        throw new SessionCreationError(
          'Invalid API response format',
          'API_RESPONSE_ERROR',
          'Response content does not contain text field'
        )
      }

      try {
        // Log the raw response for debugging
        console.log('Raw session plan response:', messageContent.text)
        
        let parsedData
        try {
          // Try to extract JSON if the response contains multiple objects
          const jsonMatch = messageContent.text.match(/\{[\s\S]*\}/)
          const jsonText = jsonMatch ? jsonMatch[0] : messageContent.text
          parsedData = JSON.parse(jsonText)
        } catch (parseError) {
          console.error('JSON parsing failed:', parseError)
          throw new SessionCreationError(
            'Failed to parse AI response as JSON',
            'JSON_PARSE_ERROR',
            {
              error: parseError,
              response: messageContent.text
            }
          )
        }

        // Create a map of original task durations for validation
        const originalTaskDurations = new Map<string, number>()
        stories.forEach((story: z.infer<typeof StorySchema>) => {
          story.tasks.forEach((task: z.infer<typeof TaskSchema>) => {
            originalTaskDurations.set(task.title, task.duration)
          })
        })

        // Add additional duration validations
        try {
          // After parsing the AI response but before validation, insert missing breaks
          console.log('Checking for and inserting missing breaks...');
          parsedData.storyBlocks = insertMissingBreaks(parsedData.storyBlocks);
          
          // Validate each story block's duration matches its time boxes
          for (const block of parsedData.storyBlocks) {
            console.log(`\nValidating story block: ${block.title}`)
            
            // Use the utility functions for duration calculations
            const { workDuration, breakDuration, totalDuration } = calculateDurationSummary(block.timeBoxes)
            
            console.log('- Work time total:', workDuration)
            console.log('- Break time total:', breakDuration)
            console.log('- Total duration:', totalDuration)

            // Find the original story to update its duration
            const originalStory = stories.find((story: z.infer<typeof StorySchema>) => story.title === block.title)
            if (!originalStory) {
              throw new SessionCreationError(
                'Story not found in original stories',
                'UNKNOWN_STORY',
                { block: block.title }
              )
            }

            // Update the story's estimated duration to match the actual work time
            originalStory.estimatedDuration = workDuration

            // Validate total duration includes both work and breaks
            if (totalDuration !== workDuration + breakDuration) {
              throw new SessionCreationError(
                'Story block duration calculation error',
                'BLOCK_DURATION_ERROR',
                {
                  block: block.title,
                  totalDuration,
                  workDuration,
                  breakDuration,
                  expectedTotal: workDuration + breakDuration
                }
              )
            }

            // Update the story block's totalDuration
            block.totalDuration = totalDuration

            // Log the final durations for debugging
            console.log('Final block durations:')
            console.log('- Total (with breaks):', totalDuration)
            console.log('- Work time:', workDuration)
            console.log('- Break time:', breakDuration)

            // Add validation for maximum work time without substantial break
            let consecutiveWorkTime = 0
            let lastBreakIndex = -1
            
            for (let i = 0; i < block.timeBoxes.length; i++) {
              const currentBox = block.timeBoxes[i]
              
              if (currentBox.type === 'work') {
                consecutiveWorkTime += currentBox.duration
                
                if (consecutiveWorkTime > DURATION_RULES.MAX_WORK_WITHOUT_BREAK) {
                  const breakTypes = block.timeBoxes
                    .slice(lastBreakIndex + 1, i)
                    .filter((box: TimeBox) => box.type === 'short-break' || box.type === 'long-break')
                    .map((box: TimeBox) => box.type)
                  
                  throw new SessionCreationError(
                    'Too much work time without a substantial break',
                    'EXCESSIVE_WORK_TIME',
                    {
                      block: block.title,
                      timeBox: currentBox.startTime,
                      consecutiveWorkTime,
                      maxAllowed: DURATION_RULES.MAX_WORK_WITHOUT_BREAK,
                      breaksSince: breakTypes
                    }
                  )
                }
              } else if (currentBox.type === 'long-break') {
                consecutiveWorkTime = 0
                lastBreakIndex = i
              } else if (currentBox.type === 'short-break') {
                consecutiveWorkTime = Math.max(0, consecutiveWorkTime - 25) // Reduce accumulated work time
                lastBreakIndex = i
              }
            }
          }
          
          // Validate total session duration
          const calculatedDuration = parsedData.storyBlocks.reduce(
            (acc: number, block: StoryBlock) => acc + calculateTotalDuration(block.timeBoxes),
            0
          )

          console.log('\nValidating total session duration:')
          console.log('- Calculated:', calculatedDuration)
          console.log('- Reported:', parsedData.summary.totalDuration)

          // Update the summary total duration to match calculated
          parsedData.summary.totalDuration = calculatedDuration
        } catch (error) {
          if (error instanceof SessionCreationError) throw error
          throw new SessionCreationError(
            'Duration validation failed',
            'VALIDATION_ERROR',
            error
          )
        }
        
        // Extract all scheduled task titles for validation
        const allScheduledTasks: string[] = [];
        
        parsedData.storyBlocks.forEach((block: any) => {
          block.timeBoxes.forEach((timeBox: any) => {
            if (timeBox.tasks && timeBox.tasks.length > 0) {
              timeBox.tasks.forEach((task: any) => {
                allScheduledTasks.push(task.title);
              });
            }
          });
        });
        
        // Validate that all original tasks are included
        const validationResult = validateAllTasksIncluded(originalTasksMap, allScheduledTasks);
        
        if (validationResult.isMissingTasks) {
          console.error('Missing tasks in schedule:', validationResult.missingTasks);
          throw new SessionCreationError(
            'Some tasks are missing from the schedule',
            'MISSING_TASKS',
            validationResult
          );
        }

        return NextResponse.json(parsedData)
      } catch (error) {
        if (error instanceof SessionCreationError) throw error
        
        throw new SessionCreationError(
          'Failed to process session plan',
          'PROCESSING_ERROR',
          error
        )
      }
    } catch (error) {
      console.error('Session creation error:', error)
      
      if (error instanceof SessionCreationError) {
        return NextResponse.json({
          error: error.message,
          code: error.code,
          details: error.details
        }, { status: 400 })
      }

      return NextResponse.json({
        error: 'Failed to create session plan',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Session creation error:', error)
    
    if (error instanceof SessionCreationError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 