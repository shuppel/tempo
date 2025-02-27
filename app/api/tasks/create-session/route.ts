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
import type { 
  Task, 
  TaskType, 
  StoryType,
  APIProcessedTask,
  APIProcessedStory,
  APISessionResponse
} from '@/lib/types'
import {
  transformTaskData,
  transformStoryData,
  normalizeTaskTitle,
  isSplitTaskPart,
  getBaseTaskTitle,
  getBaseStoryTitle
} from '@/lib/transformUtils'

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
  id: z.string(),
  title: z.string(),
  duration: z.number(),
  taskCategory: z.enum(['focus', 'learning', 'review', 'research'] as const),
  projectType: z.string().optional(),
  isFrog: z.boolean(),
  isFlexible: z.boolean(),
  originalTitle: z.string().optional(),
  splitInfo: z.object({
    originalTitle: z.string().optional(),
    isParent: z.boolean(),
    partNumber: z.number().optional(),
    totalParts: z.number().optional()
  }).optional(),
  suggestedBreaks: z.array(TaskBreakSchema).default([])
})

const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  icon: z.string(),
  estimatedDuration: z.number(),
  type: z.enum(['timeboxed', 'flexible', 'milestone'] as const),
  projectType: z.string(),
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
  id: string
  title: string
  duration: number
  taskCategory?: TaskType
  projectType?: string
  originalTitle?: string
  isFrog?: boolean
  splitInfo?: {
    originalTitle?: string
    isParent: boolean
    partNumber?: number
    totalParts?: number
  }
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

type SessionResponse = APISessionResponse;

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

// Update findOriginalStory function to use story mapping if available
function findOriginalStory(storyTitle: string, stories: any[], storyMapping?: any[]): any {
  // Special case for "Break" blocks which don't correspond to actual stories
  if (storyTitle === "Break" || storyTitle.toLowerCase().includes("break")) {
    console.log(`Creating dummy story for special block: ${storyTitle}`);
    // Return a dummy story object with minimal required properties
    return {
      title: storyTitle,
      estimatedDuration: 15, // Default duration for breaks
      tasks: [],
      type: "flexible",
      projectType: "System",
      category: "Break",
      summary: "Scheduled break time"
    };
  }

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
  // Create maps to track tasks by ID and title
  const originalTaskMap = new Map<string, z.infer<typeof TaskSchema>>()
  const scheduledTaskMap = new Map<string, TimeBoxTask>()
  const titleToIdMap = new Map<string, string>()
  
  // Build maps of original tasks
  originalTasks.forEach(task => {
    originalTaskMap.set(task.id, task)
    titleToIdMap.set(task.title.toLowerCase(), task.id)
    if (task.originalTitle) {
      titleToIdMap.set(task.originalTitle.toLowerCase(), task.id)
    }
  })

  // Filter out Break blocks before validation
  const filteredScheduledTasks = scheduledTasks.filter(task => {
    // Skip "Break" tasks in validation
    return !task.title.includes("Break");
  });

  // Track scheduled tasks and their relationships
  filteredScheduledTasks.forEach(task => {
    scheduledTaskMap.set(task.title.toLowerCase(), task)
    
    // Handle split tasks
    if (task.splitInfo?.originalTitle) {
      const originalId = titleToIdMap.get(task.splitInfo.originalTitle.toLowerCase())
      if (originalId) {
        const originalTask = originalTaskMap.get(originalId)
        if (originalTask) {
          // Mark the original task as accounted for
          originalTaskMap.delete(originalId)
        }
      }
    } else {
      // Handle regular tasks
      const taskId = titleToIdMap.get(task.title.toLowerCase())
      if (taskId) {
        originalTaskMap.delete(taskId)
      }
    }
  })

  // Any tasks remaining in originalTaskMap are missing from the schedule
  const missingTasks = Array.from(originalTaskMap.values()).map(task => task.title)
  
  return {
    isMissingTasks: missingTasks.length > 0,
    missingTasks,
    scheduledCount: filteredScheduledTasks.length,
    originalCount: originalTasks.length
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

// Upgrade task objects to the session model 
function upgradeTaskToSessionTask(task: z.infer<typeof TaskSchema>): TimeBoxTask {
  return {
    id: task.id,
    title: task.title,
    duration: task.duration,
    taskCategory: task.taskCategory,
    projectType: task.projectType,
    isFrog: task.isFrog,
    originalTitle: task.originalTitle,
    splitInfo: task.splitInfo,
    suggestedBreaks: task.suggestedBreaks || []
  }
}

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

      // Use the Task type from our schema instead of the imported type
      const enhancedStories = stories.map((story: z.infer<typeof StorySchema>) => ({
        ...story,
        tasks: story.tasks.map((task: z.infer<typeof TaskSchema>) => ({
          ...task,
          originalTitle: task.originalTitle || task.title
        }))
      }));

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4096,
        temperature: 0.7,
        system: "You are an expert at creating optimized session plans with time boxes. You strictly follow provided rules and formatting requirements, producing valid, complete JSON output.",
        messages: [{
          role: "user",
          content: `Create a detailed session plan with time boxes for these stories:

Rules:
1. Stories become story blocks with tasks and breaks
2. Schedule FROG tasks early
3. Round all times to 5-minute blocks
4. Add 5-min breaks between tasks
5. Add 15-min breaks between stories
6. Don't exceed ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes of continuous work

Session Params:
- Start: ${startTime}
- Stories: ${stories.length}

Stories Data:
${JSON.stringify(enhancedStories)}

Return JSON with this structure:
{
  "summary": {
    "totalSessions": number,
    "startTime": "ISO string",
    "endTime": "ISO string", 
    "totalDuration": number
  },
  "storyBlocks": [
    {
      "title": "string",
      "summary": "string",
      "icon": "emoji",
      "timeBoxes": [
        {
          "type": "work|short-break|long-break|debrief",
          "duration": number,
          "tasks": [
            {
              "id": "string",
              "title": "string",
              "duration": number,
              "taskCategory": "focus|learning|review|research",
              "projectType": "string (optional)",
              "isFrog": boolean
            }
          ],
          "startTime": "ISO string",
          "endTime": "ISO string"
        }
      ],
      "totalDuration": number
    }
  ]
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
          let jsonText = jsonMatch ? jsonMatch[0] : messageContent.text
          
          // Check if the JSON appears to be truncated
          if (jsonText.trim().endsWith('":') || 
              jsonText.trim().endsWith(',') || 
              !jsonText.trim().endsWith('}')) {
            console.warn('JSON appears to be truncated or malformed')
            
            // Try to reconstruct if it's a known response pattern by checking the structure
            if (jsonText.includes('"storyBlocks"') && jsonText.includes('"summary"')) {
              // This is likely our expected format but truncated
              console.warn('Attempting to reconstruct truncated JSON with the expected structure')
              
              // Check if we're missing the final closing brace
              if (!jsonText.trim().endsWith('}') && jsonText.split('{').length > jsonText.split('}').length) {
                jsonText = jsonText + '}}' // Add closing braces for potentially nested unclosed objects
              }
            } else {
              throw new Error('JSON structure is too damaged to repair automatically')
            }
          }
          
          // Rest of the parsing logic remains the same
          try {
            parsedData = JSON.parse(jsonText)
          } catch (initialParseError) {
            // If standard parsing fails, try a more lenient approach
            console.warn('Standard JSON parsing failed, attempting repair:', initialParseError)
            
            // Check if we can fix common truncation issues
            const fixedJson = jsonText
              .replace(/,\s*}$/, '}')         // Fix trailing commas
              .replace(/,\s*]$/, ']')         // Fix trailing commas in arrays
              .replace(/:\s*}/, ':null}')     // Fix missing values
              .replace(/:\s*]/, ':null]')     // Fix missing values in arrays
            
            parsedData = JSON.parse(fixedJson)
          }
        } catch (parseError) {
          console.error('JSON parsing failed after repair attempts:', parseError)
          throw new SessionCreationError(
            'Failed to parse AI response as JSON',
            'JSON_PARSE_ERROR',
            {
              error: parseError,
              response: messageContent.text
            }
          )
        }

        // Validate that the parsed data has all required fields
        if (!parsedData.summary || !parsedData.storyBlocks || !Array.isArray(parsedData.storyBlocks)) {
          console.error('Parsed data is missing required fields');
          throw new SessionCreationError(
            'AI response is missing required data structure',
            'INVALID_DATA_STRUCTURE',
            {
              parsedData,
              missingFields: [
                !parsedData.summary ? 'summary' : null,
                !parsedData.storyBlocks ? 'storyBlocks' : null,
                parsedData.storyBlocks && !Array.isArray(parsedData.storyBlocks) ? 'storyBlocks (not an array)' : null
              ].filter(Boolean)
            }
          );
        }

        // Ensure each story block has the required fields
        for (let i = 0; i < parsedData.storyBlocks.length; i++) {
          const block = parsedData.storyBlocks[i];
          if (!block.title || !block.timeBoxes || !Array.isArray(block.timeBoxes)) {
            console.error(`Story block at index ${i} is missing required fields`);
            
            // Try to repair the block with minimal data
            if (!block.title) block.title = `Story Block ${i + 1}`;
            if (!block.summary) block.summary = `Tasks for story block ${i + 1}`;
            if (!block.icon) block.icon = '📋';
            if (!block.timeBoxes || !Array.isArray(block.timeBoxes)) {
              console.warn(`Reconstructing missing timeBoxes for story block ${i}`);
              block.timeBoxes = [];
            }
            block.totalDuration = block.timeBoxes.reduce((sum: number, box: any) => sum + (box.duration || 0), 0);
          }
        }

        // Transform fields to ensure consistent property names
        if (parsedData.storyBlocks && Array.isArray(parsedData.storyBlocks)) {
          parsedData.storyBlocks = parsedData.storyBlocks.map((block: any) => {
            // Transform the story block itself
            const transformedBlock = transformStoryData(block);
            
            // Transform timeBoxes and their tasks
            if (transformedBlock.timeBoxes && Array.isArray(transformedBlock.timeBoxes)) {
              transformedBlock.timeBoxes = transformedBlock.timeBoxes.map((timeBox: any) => {
                // Transform tasks within each time box
                if (timeBox.tasks && Array.isArray(timeBox.tasks)) {
                  timeBox.tasks = timeBox.tasks.map(transformTaskData);
                }
                return timeBox;
              });
            }
            
            // Transform story properties if needed
            if (!transformedBlock.storyType && transformedBlock.type) {
              console.log(`Transforming story type -> storyType for "${transformedBlock.title}"`)
              transformedBlock.storyType = transformedBlock.type
            }
            
            if (!transformedBlock.projectType && transformedBlock.project) {
              console.log(`Transforming story project -> projectType for "${transformedBlock.title}"`)
              transformedBlock.projectType = transformedBlock.project
              delete transformedBlock.project
            }
            
            return transformedBlock;
          });
        }

        // Create a map of original task durations for validation
        const originalTaskDurations = new Map<string, number>()
        stories.forEach((story: z.infer<typeof StorySchema>) => {
          story.tasks.forEach((task: z.infer<typeof TaskSchema>) => {
            originalTaskDurations.set(task.title, task.duration)
          })
        })

        // After processing and transforming the data, validate it
        // This ensures any renamed properties (type->taskCategory, project->projectType) are properly processed
        console.log('Validating processed session plan...')
        const storyBlocks = parsedData.storyBlocks || []

        // Verify all tasks have the correct properties
        storyBlocks.forEach((block: any) => {
          // Transform story properties if needed
          if (!block.storyType && block.type) {
            console.log(`Transforming story type -> storyType for "${block.title}"`)
            block.storyType = block.type
          }
          
          if (!block.projectType && block.project) {
            console.log(`Transforming story project -> projectType for "${block.title}"`)
            block.projectType = block.project
            delete block.project
          }
          
          if (block.timeBoxes && Array.isArray(block.timeBoxes)) {
            block.timeBoxes.forEach((timeBox: any) => {
              if (timeBox.tasks && Array.isArray(timeBox.tasks)) {
                timeBox.tasks.forEach((task: any) => {
                  // Ensure task has taskCategory property (originally might have been type)
                  if (!task.taskCategory && task.type) {
                    console.log(`Transforming task type -> taskCategory for "${task.title}"`)
                    task.taskCategory = task.type
                    delete task.type
                  }
                  
                  // Ensure task has projectType property (originally might have been project)
                  if (!task.projectType && task.project) {
                    console.log(`Transforming task project -> projectType for "${task.title}"`)
                    task.projectType = task.project
                    delete task.project
                  }
                })
              }
            })
          }
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
            // For break blocks, the workDuration might be 0, so use totalDuration instead
            originalStory.estimatedDuration = workDuration || totalDuration

            // Validate total duration includes both work and breaks
            // Special handling for pure break blocks which might have 0 work duration
            const expectedTotal = workDuration + breakDuration
            if (totalDuration !== expectedTotal && !(workDuration === 0 && totalDuration === breakDuration)) {
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
        const allScheduledTasks: TimeBoxTask[] = parsedData.storyBlocks.flatMap((block: StoryBlock) => {
          // Skip "Break" blocks entirely during task extraction
          if (block.title === "Break" || block.title.toLowerCase().includes("break")) {
            console.log(`Skipping Break block "${block.title}" during task validation`);
            return [];
          }
          
          return block.timeBoxes
            .filter((box: TimeBox) => box.type === 'work')
            .flatMap((box: TimeBox) => box.tasks || []);
        })
        
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
        console.error('Session creation error:', error);
        
        // Handle max_tokens errors
        if (error instanceof Error && 
            error.message.includes('invalid_request_error') && 
            error.message.includes('max_tokens')) {
          throw new SessionCreationError(
            'Invalid token limit configuration',
            'TOKEN_LIMIT_ERROR',
            error.message
          );
        }
        
        // Handle rate limiting errors
        if (error instanceof Error && 
            (error.message.includes('429') || 
            error.message.includes('529') || 
            error.message.includes('rate limit') ||
            error.message.includes('overloaded'))) {
          console.warn('Rate limit error from Anthropic API detected');
          throw new SessionCreationError(
            'Service temporarily overloaded. Please try again in a few moments.',
            'RATE_LIMITED',
            error.message
          );
        }
                
        // For other errors, wrap in SessionCreationError
        if (error instanceof SessionCreationError) throw error;
        
        throw new SessionCreationError(
          'Failed to process session plan',
          'PROCESSING_ERROR',
          error
        );
      }
    } catch (error) {
      console.error('Session creation error:', error)
      
      // Check for rate limiting errors from Anthropic
      if (error instanceof Error && 
          (error.message.includes('429') || 
          error.message.includes('529') || 
          error.message.includes('rate limit') ||
          error.message.includes('overloaded'))) {
        console.warn('Rate limit error from Anthropic API detected');
        return NextResponse.json({
          error: 'Service temporarily overloaded. Please try again in a few moments.',
          code: 'RATE_LIMITED',
          details: error.message
        }, { status: 429 });
      }
      
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
  } catch (error) {
    console.error('Session creation error:', error);
    
    // Handle max_tokens errors
    if (error instanceof Error && 
        error.message.includes('invalid_request_error') && 
        error.message.includes('max_tokens')) {
      return NextResponse.json({
        error: 'Invalid token limit configuration in API request',
        code: 'TOKEN_LIMIT_ERROR',
        details: error.message
      }, { status: 400 });
    }
    
    // Handle rate limiting errors
    if (error instanceof Error && 
        (error.message.includes('429') || 
         error.message.includes('529') || 
         error.message.includes('rate limit') ||
         error.message.includes('overloaded'))) {
      console.warn('Rate limit error from Anthropic API detected');
      return NextResponse.json({
        error: 'Service temporarily overloaded. Please try again in a few moments.',
        code: 'RATE_LIMITED',
        details: error.message
      }, { status: 429 });
    }
    
    // Handle session creation errors
    if (error instanceof SessionCreationError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 400 });
    }
    
    // Handle all other errors
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 