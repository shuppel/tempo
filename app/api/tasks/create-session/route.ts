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
import type { Task } from '@/lib/types'

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

// Add a schema for story mapping
const StoryMappingSchema = z.object({
  possibleTitle: z.string(),
  originalTitle: z.string()
})

// Update request schema to include story mapping
const RequestSchema = z.object({
  stories: z.array(StorySchema),
  startTime: z.string(),
  storyMapping: z.array(StoryMappingSchema).optional()
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
  type?: string
  suggestedBreaks?: Array<{
    after: number
    duration: number
    reason: string
  }>
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
  // Account for breaks in the duration ranges
  const minWithBreak = DURATION_RULES.MIN_DURATION + DURATION_RULES.SHORT_BREAK
  const maxWithBreak = DURATION_RULES.MAX_DURATION + DURATION_RULES.LONG_BREAK * 2 // Allow for two long breaks
  
  return {
    min: minWithBreak,
    max: maxWithBreak
  }
}

function getDurationDescription(range: { min: number; max: number }, type: string): string {
  return `${range.min}-${range.max} minutes (including breaks, ${type})`
}

function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove part numbers from split tasks
    .replace(/\s*\(part \d+ of \d+\)\s*/i, '')
    // Remove time expressions
    .replace(/\s*\d+\s*(?:hour|hr|h)s?\s*(?:of|for|on|in)?\s*(?:work|working)?\s*(?:on|with|at|in)?\s*/i, ' ')
    .replace(/\s*\d+\s*(?:minute|min|m)s?\s*/i, ' ')
    // Clean up common words that don't affect meaning
    .replace(/\b(?:working|work|on|for|in|at|with)\b/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
}

function findMatchingTaskTitle(searchTitle: string, availableTitles: string[]): string | undefined {
  const normalizedSearch = normalizeTaskTitle(searchTitle)
  
  // Log for debugging
  console.log(`Matching title: "${searchTitle}" normalized to "${normalizedSearch}"`)
  
  // First check for split task matches
  const splitMatches = availableTitles.filter(title => 
    title.includes('(Part') && 
    normalizeTaskTitle(title.split('(Part')[0]) === normalizedSearch
  )
  
  if (splitMatches.length > 0) {
    console.log(`Found split task matches: ${splitMatches.join(', ')}`)
    // Return the first part to represent the whole task
    return splitMatches[0].split('(Part')[0].trim()
  }

  // Try exact match first
  const exactMatch = availableTitles.find(title => {
    const normalizedTitle = normalizeTaskTitle(title)
    console.log(`Comparing with: "${title}" normalized to "${normalizedTitle}"`)
    return normalizedTitle === normalizedSearch
  })
  
  if (exactMatch) {
    console.log(`Found exact match: "${exactMatch}"`)
    return exactMatch
  }

  // Try fuzzy matching for project names
  const fuzzyMatch = availableTitles.find(title => {
    const normalizedTitle = normalizeTaskTitle(title)
    // Check if the core project names match
    const searchWords = normalizedSearch.split(' ').filter(word => word.length > 2)
    const titleWords = normalizedTitle.split(' ').filter(word => word.length > 2)
    
    const matchingWords = searchWords.filter(word => 
      titleWords.some((titleWord: string) => 
        titleWord.includes(word) || word.includes(titleWord)
      )
    )
    
    return matchingWords.length >= Math.min(2, searchWords.length)
  })

  if (fuzzyMatch) {
    console.log(`Found fuzzy match: "${fuzzyMatch}"`)
    return fuzzyMatch
  }

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

// Add a new function to extract the base story title
function getBaseStoryTitle(title: string): string {
  // Check if the story title contains a part indicator
  if (isSplitTaskPart(title)) {
    return getBaseTaskTitle(title);
  }
  return title;
}

// Update findOriginalStory function to use story mapping if available
function findOriginalStory(storyTitle: string, stories: any[], storyMapping?: any[]): any {
  // First check if we have mapping data available and try to use it
  if (storyMapping && storyMapping.length > 0) {
    // Find this title in the mapping
    const mapping = storyMapping.find(m => m.possibleTitle === storyTitle);
    if (mapping) {
      // Use the original title from mapping to find the story
      const originalStory = stories.find(s => s.title === mapping.originalTitle);
      if (originalStory) {
        console.log(`Found story using mapping: ${storyTitle} -> ${mapping.originalTitle}`);
        return originalStory;
      }
    }
  }
  
  // If mapping doesn't work or isn't available, try other methods

  // First try exact match
  let original = stories.find((story: any) => story.title === storyTitle);
  if (original) return original;
  
  // If not found and title contains "Part X of Y", try matching the base title
  if (isSplitTaskPart(storyTitle)) {
    const baseTitle = getBaseStoryTitle(storyTitle);
    original = stories.find((story: any) => story.title === baseTitle);
    if (original) return original;
    
    // Try fuzzy match on base title
    original = stories.find((story: any) => {
      return story.title.includes(baseTitle) || baseTitle.includes(story.title);
    });
    if (original) return original;
  }
  
  // Try fuzzy match as last resort
  original = stories.find((story: any) => {
    const storyWords = story.title.toLowerCase().split(/\s+/);
    const searchWords = storyTitle.toLowerCase().split(/\s+/);
    
    // Count matching words
    const matchCount = searchWords.filter(word => 
      storyWords.some((storyWord: string) => storyWord.includes(word) || word.includes(storyWord))
    ).length;
    
    // Require at least 50% of words to match or minimum 2 words
    return matchCount >= Math.max(2, Math.floor(searchWords.length / 2));
  });
  
  if (original) {
    console.log(`Found story using fuzzy match: ${storyTitle} -> ${original.title}`);
  }
  
  return original;
}

function buildOriginalTasksMap(stories: z.infer<typeof StorySchema>[]): Map<string, string> {
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

function validateAllTasksIncluded(originalTasks: z.infer<typeof TaskSchema>[], scheduledTasks: TimeBoxTask[]): {
  isMissingTasks: boolean;
  missingTasks: string[];
  scheduledCount: number;
  originalCount: number;
} {
  const scheduledTaskDetails: Record<string, string[]> = {}
  
  // Group scheduled tasks by their base name (without part numbers)
  scheduledTasks.forEach(task => {
    const baseTitle = task.title.split('(Part')[0].trim()
    if (!scheduledTaskDetails[baseTitle]) {
      scheduledTaskDetails[baseTitle] = []
    }
    scheduledTaskDetails[baseTitle].push(task.title)
  })

  // Instead of checking for missing tasks, we'll validate that we have at least
  // the same number of task groups as original tasks, since the AI can transform them
  const originalTaskCount = originalTasks.length
  const scheduledGroupCount = Object.keys(scheduledTaskDetails).length

  // Log for debugging
  console.log('Task count validation:')
  console.log('Original tasks:', originalTaskCount)
  console.log('Scheduled task groups:', scheduledGroupCount)
  console.log('Scheduled task details:', scheduledTaskDetails)

  // We consider tasks "missing" only if we have fewer scheduled groups than original tasks
  const isMissingTasks = scheduledGroupCount < originalTaskCount

  return {
    isMissingTasks,
    missingTasks: [], // We no longer track specific missing tasks since the AI can transform them
    scheduledCount: scheduledTasks.length,
    originalCount: originalTaskCount
  }
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

// Extract the inferred type from the schema
type Story = z.infer<typeof StorySchema>

export async function POST(req: Request) {
  const currentTime = new Date()
  let startTime
  let stories
  let storyMapping

  try {
    const body = await req.json()
    const parsedBody = RequestSchema.parse(body)
    
    stories = parsedBody.stories
    startTime = parsedBody.startTime
    storyMapping = parsedBody.storyMapping
    
    console.log(`Received ${stories.length} stories for session creation`)
    if (storyMapping) {
      console.log(`Received mapping data for ${storyMapping.length} possible story titles`)
    }
    
    const startDateTime = new Date(startTime)

    // Validate that total duration is a reasonable value
    const totalDuration = stories.reduce((sum, story) => sum + story.estimatedDuration, 0)
    if (totalDuration > 24 * 60) { // More than 24 hours
      throw new SessionCreationError(
        'Total session duration exceeds maximum limit',
        'DURATION_EXCEEDED',
        { totalDuration, maxDuration: 24 * 60 }
      )
    }

    // Create a map of original tasks for validation
    const originalTasksMap = buildOriginalTasksMap(stories);

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
          2. CRITICAL - Duration Rules:
             - Task durations INCLUDE break times
             - For a 120-minute task (2 hours total):
               * 45min work + 5min break + 25min work + 15min break + 30min work = 120min total
             - For a 180-minute task (3 hours total):
               * 45min work + 15min break + 45min work + 15min break + 45min work + 15min break = 180min total
             - Break scheduling:
               * Add 5-minute breaks between shorter work sessions
               * Add 15-minute breaks after 45+ minutes of work
               * Add 5-minute debriefs after completing each story
               * Use suggestedBreaks from input tasks when available
          3. Task Priority Rules:
             - Tasks marked with 'isFrog: true' are high priority and should be scheduled early
             - DO NOT add "FROG" to task titles - it's only a priority indicator
          4. Group related tasks together
          5. Keep the response concise and well-structured
          6. CRITICAL - Task Title and Transformation Rules:
             - You may transform task titles to be more specific or descriptive
             - For tasks with time prefixes (e.g., "2 hours of work on X"), you can remove the time prefix
             - For project tasks (e.g., "work on Project X"), you can expand to "Project X Development"
             - When splitting tasks, use the base transformed title with part numbers
             - Example transformations:
               * "2 hours of work on Toro" → "Toro Development (Part X of Y)"
               * "3 hours working on Project X" → "Project X Implementation (Part X of Y)"
          7. CRITICAL - Task splitting and duration rules:
             - Each work time box must contain exactly one task or task part
             - Break and debrief time boxes must not contain tasks
             - For tasks longer than 60 minutes:
               * Split into 2-3 parts ONLY
               * Follow the duration patterns for 120min and 180min tasks
               * Include appropriate breaks between sessions
               * Consider suggestedBreaks when splitting
             - Time box durations:
               * First work sessions: 20-30 minutes
               * Middle work sessions: 30-60 minutes (or up to 90 for 180-min tasks)
               * Final work sessions: 15-60 minutes (or up to 95 for 120-min tasks)
               * Single tasks: 20-60 minutes
               * Short breaks: 5 minutes
               * Long breaks: 15 minutes
               * Debriefs: 5 minutes
          8. CRITICAL - Duration Calculation Rules:
             - The summary.totalDuration MUST equal the sum of ALL story block durations
             - Each story block's totalDuration MUST include all work sessions, breaks, and debriefs
             - Double-check all duration calculations before returning

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
              "title": "Story title",
              "summary": "Story summary",
              "icon": "emoji",
              "timeBoxes": [{
                "type": "work" | "short-break" | "long-break" | "debrief",
                "startTime": "HH:MM",
                "duration": number,
                "tasks": [{ 
                  title: string,
                  duration: number,
                  suggestedBreaks: [{ after: number, duration: number, reason: string }]
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
            const originalStory = findOriginalStory(block.title, stories, storyMapping);
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
        const allScheduledTasks: TimeBoxTask[] = parsedData.storyBlocks.flatMap((block: StoryBlock) => 
          block.timeBoxes
            .filter((box: TimeBox) => box.type === 'work')
            .flatMap((box: TimeBox) => box.tasks || [])
        )
        
        // Validate that all original tasks are included
        const validationResult = validateAllTasksIncluded(
          stories.flatMap((story: Story) => story.tasks),
          allScheduledTasks
        )
        
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