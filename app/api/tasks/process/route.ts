import { Anthropic } from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { 
  TaskType, 
  TaskCategory,
  StoryType, 
  TaskComplexity, 
  TaskBreak, 
  ProcessedTask, 
  ProcessedStory, 
  TimeBoxType,
  APIProcessResponse,
  APIProcessedStory
} from '@/lib/types'
import { 
  transformTaskData, 
  isProcessedTask, 
  isProcessedStory 
} from '@/lib/transformUtils'

// Replace the custom ProcessedResponseFromAI with the shared API type
// Define a type that represents the structure we expect from Claude's response
type ProcessedResponseFromAI = APIProcessResponse;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Input validation schema
const RequestSchema = z.object({
  tasks: z.array(z.string()).min(1, "At least one task is required")
})

// Renamed to ProjectCategory to avoid confusion with TaskCategory (task types)
export type ProjectCategory = 'UX' | 'API' | 'Development' | 'Testing' | 'Documentation' | 'Refactoring' | 'Learning' | 'Project Management' | 'Planning' | 'Research'

interface TaskAnalysis {
  hasTimeEstimate: boolean
  suggestedDuration?: number
  type: StoryType
  complexity: TaskComplexity
  projectType?: string
  category?: ProjectCategory
}

interface PreprocessedTask {
  originalText: string
  processedText: string
  isFrog: boolean
}

function preprocessTask(task: string): PreprocessedTask {
  // Match FROG with common misspellings and variations
  const frogPattern = /\b(FROG|FR0G|FROGG|FROGGY)\b/i
  const isFrog = frogPattern.test(task)
  
  // Remove the FROG keyword and clean up the text
  const processedText = task
    .replace(frogPattern, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    originalText: task,
    processedText,
    isFrog
  }
}

function analyzeTaskText(task: string): TaskAnalysis {
  const timePatterns = [
    /(\d+)\s*(?:hour|hr|h)s?/i,
    /(\d+)\s*(?:minute|min|m)s?/i,
    /(\d+):(\d+)/
  ]

  const hasExplicitTime = timePatterns.some(pattern => pattern.test(task))
  const isMilestone = /milestone|deadline|by|due|complete by/i.test(task)
  const complexityIndicators = task.split(' ').length

  // Extract project name if it exists (e.g., "Nurture:", "Retool:", etc.)
  const projectMatch = task.match(/^([^:]+):/i)
  const project = projectMatch ? projectMatch[1].trim() : undefined

  // Identify task category based on keywords
  const categoryKeywords = {
    'UX': /UX|user experience|interface|design|mockup|wireframe/i,
    'API': /API|endpoint|backend|database|integration/i,
    'Development': /develop|implement|code|build|create/i,
    'Testing': /test|QA|verify|validate/i,
    'Documentation': /document|docs|readme|wiki/i,
    'Refactoring': /refactor|cleanup|optimize|improve/i,
    'Learning': /learn|educate|training|workshop/i,
    'Project Management': /manage|coordinate|plan|schedule/i,
    'Planning': /strategy|architecture|roadmap/i,
    'Research': /investigate|analyze|study|explore/i
  } as const

  const category = Object.entries(categoryKeywords)
    .find(([_, pattern]) => pattern.test(task))?.[0] as ProjectCategory | undefined

  return {
    hasTimeEstimate: hasExplicitTime,
    type: isMilestone ? "milestone" : hasExplicitTime ? "timeboxed" : "flexible",
    complexity: complexityIndicators <= 5 ? "low" : complexityIndicators <= 10 ? "medium" : "high",
    projectType: project,
    category
  }
}

const DURATION_RULES = {
  MIN_DURATION: 15, // Minimum duration for any task
  BLOCK_SIZE: 5,   // All durations must be multiples of 5
  MAX_DURATION: 180 // Maximum duration for a single task
} as const

function roundToNearestBlock(duration: number): number {
  return Math.max(
    DURATION_RULES.MIN_DURATION,
    Math.round(duration / DURATION_RULES.BLOCK_SIZE) * DURATION_RULES.BLOCK_SIZE
  )
}

function validateTaskDuration(duration: number): boolean {
  // Must be at least minimum duration and a multiple of block size
  return duration >= DURATION_RULES.MIN_DURATION && 
         duration % DURATION_RULES.BLOCK_SIZE === 0 &&
         duration <= DURATION_RULES.MAX_DURATION
}

function estimateTaskDuration(task: string, analysis: TaskAnalysis): number {
  if (analysis.hasTimeEstimate) {
    // Expanded time extraction patterns to handle more formats
    const hourPatterns = [
      /(\d+)\s*(?:hour|hr|h)s?/i,  // Basic hour pattern (2 hours, 2hr, 2h)
      /(\d+)\s*(?:hour|hr|h)s?\s*(?:of|for|on|in)\s+(?:work|working)/i,  // Format: "2 hours of work on"
      /(\d+)\s*(?:hour|hr|h)s?\s*(?:work|working)/i  // Format: "2 hours working on"
    ]
    
    const minuteMatch = /(\d+)\s*(?:minute|min|m)s?/i.exec(task)
    const timeMatch = /(\d+):(\d+)/.exec(task)

    let duration = 0
    
    // Try all hour patterns
    for (const pattern of hourPatterns) {
      const hourMatch = pattern.exec(task)
      if (hourMatch) {
        duration = parseInt(hourMatch[1]) * 60
        break  // Found a match, stop checking patterns
      }
    }
    
    // Add minutes if present
    if (minuteMatch) duration += parseInt(minuteMatch[1])
    
    // Or use time format
    if (timeMatch) duration = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])

    // Ensure minimum viable duration
    return Math.max(15, duration)
  }

  // Base duration by complexity
  const baseDuration = {
    low: 25,    // Minimum viable duration for a focused task
    medium: 45, // Good for standard complexity tasks
    high: 90    // Complex tasks that might need splitting
  }[analysis.complexity]

  // Adjust based on category
  const categoryMultipliers: Record<ProjectCategory, number> = {
    'UX': 1.2,        // UX tasks often need more time for iteration
    'API': 1.3,       // API work typically requires testing and documentation
    'Development': 1.0,
    'Testing': 0.8,   // Testing tasks are usually more straightforward
    'Documentation': 0.7,
    'Refactoring': 1.4, // Refactoring can uncover unexpected complexities
    'Learning': 1.0,
    'Project Management': 1.2,
    'Planning': 1.5,
    'Research': 1.3
  }
  
  const multiplier = analysis.category ? categoryMultipliers[analysis.category] : 1.0
  const suggestedDuration = Math.round(baseDuration * multiplier)

  // Ensure minimum viable duration
  return Math.max(15, suggestedDuration)
}

// Validation schemas for AI responses
const TaskGroupSchema = z.object({
  project: z.string(),
  feature: z.string(),
  category: z.enum([
    'UX',
    'API',
    'Development',
    'Testing',
    'Documentation',
    'Refactoring',
    'Learning',
    'Project Management',
    'Planning',
    'Research'
  ]),
  relatedTasks: z.array(z.number()),
  dependencies: z.array(z.number()).optional(),
  reasoning: z.string()
})

const StructureAnalysisSchema = z.object({
  taskGroups: z.array(TaskGroupSchema)
})

const TaskBreakSchema = z.object({
  after: z.number(),
  duration: z.number(),
  reason: z.string()
})

// Get the allowed task categories excluding 'break'
const ALLOWED_TASK_CATEGORIES: Exclude<TaskCategory, 'break'>[] = ['focus', 'learning', 'review', 'research'];

const ProcessedTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number().min(DURATION_RULES.MIN_DURATION).default(DURATION_RULES.MIN_DURATION),
  isFrog: z.boolean(),
  taskCategory: z.enum(ALLOWED_TASK_CATEGORIES as [string, ...string[]]),
  projectType: z.string().optional(),
  isFlexible: z.boolean(),
  suggestedBreaks: z.array(TaskBreakSchema).default([]),
  needsSplitting: z.boolean().optional()
})

// Get the allowed story types
const ALLOWED_STORY_TYPES: StoryType[] = ['timeboxed', 'flexible', 'milestone'];

const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  icon: z.string(),
  estimatedDuration: z.number(),
  type: z.enum(ALLOWED_STORY_TYPES as [string, ...string[]]),
  projectType: z.string(),
  category: z.string(),
  tasks: z.array(ProcessedTaskSchema),
  needsBreaks: z.boolean().optional(),
  originalTitle: z.string().optional()
})

const ProcessedDataSchema = z.object({
  stories: z.array(StorySchema)
})

class TaskProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'TaskProcessingError'
  }
}

export async function POST(req: Request) {
  try {
    // Parse and validate request body
    const body = await req.json().catch(() => ({}))
    
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

    try {
      console.log(`Processing ${body.tasks.length} tasks:`, body.tasks)
      
      // Send task list to Claude for processing
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        temperature: 0.3,
        system: "You are an expert at analyzing tasks and organizing them into cohesive stories/epics. Extract structure, categorize, estimate time, and provide organization hints.",
        messages: [{
          role: "user",
          content: `Create a structured task plan from this brain dump of tasks:
${body.tasks.join('\n')}

Rules:
1. Group similar tasks into cohesive stories based on project/topic
2. Each story should have 1-5 tasks
3. Mark high priority tasks with isFrog=true
4. Parse time estimates from task descriptions when available
5. Use these task categories:
   - focus: deep focus work
   - learning: studying or learning new material
   - review: reviewing or providing feedback
   - research: exploring or investigating options

Provide the result as a JSON object with this EXACT structure:
{
  "stories": [
    {
      "title": "Story title",
      "summary": "Brief description",
      "icon": "Emoji representing the story",
      "estimatedDuration": number (total minutes),
      "type": "timeboxed" | "flexible" | "milestone",
      "projectType": "Project type or area",
      "category": "General category",
      "tasks": [
        {
          "id": "UUID",
          "title": "Task title",
          "duration": number (minutes),
          "isFrog": boolean (true for high priority),
          "taskCategory": "focus" | "learning" | "review" | "research",
          "projectType": "string (optional)",
          "isFlexible": boolean,
          "needsSplitting": boolean (for tasks > 60 minutes),
          "suggestedBreaks": [
            {
              "after": number (minutes into task),
              "duration": number (break duration in minutes),
              "reason": "string explaining reason for break"
            }
          ]
        }
      ]
    }
  ]
}`
        }]
      })

      // Extract the response content
      const messageContent = response.content[0]
      if (!('text' in messageContent)) {
        throw new TaskProcessingError(
          'Invalid API response format',
          'API_RESPONSE_ERROR',
          'Response content does not contain text field'
        )
      }

      // Log the raw response for debugging
      console.log('Raw response:', messageContent.text)
      
      let processedData: ProcessedResponseFromAI
      try {
        // Attempt to extract and parse JSON
        const jsonMatch = messageContent.text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('No JSON object found in response')
        }

        const jsonText = jsonMatch[0]
        // Type assertion for the parsed data
        const parsedData = JSON.parse(jsonText) as any
        
        // Create processedData with proper type handling
        processedData = {
          stories: parsedData.stories.map((story: any) => ({
            ...story,
            tasks: Array.isArray(story.tasks) 
              ? story.tasks.map(transformTaskData) 
              : []
          }))
        };

        // Add UUIDs for any tasks that don't have IDs
        processedData.stories.forEach((story: any) => {
          story.tasks = story.tasks.map((task: any) => {
            // Ensure task has an ID
            if (!task.id) {
              task.id = crypto.randomUUID()
            }
            return task
          })
        });

        // Validate task durations and suggest breaks
        processedData.stories.forEach((story: any) => {
          story.tasks.forEach((task: any) => {
            // Round durations to the nearest 5 minutes
            if (task.duration) {
              task.duration = roundToNearestBlock(task.duration)
            }

            // Add suggestedBreaks if not present
            if (!task.suggestedBreaks) {
              task.suggestedBreaks = []
            }

            // Add break suggestion for longer tasks
            if (task.duration >= 60 && task.suggestedBreaks.length === 0) {
              task.suggestedBreaks.push({
                after: 25,
                duration: 5,
                reason: "Short break after initial focus period"
              })

              if (task.duration >= 90) {
                task.suggestedBreaks.push({
                  after: 70,
                  duration: 10,
                  reason: "Longer break to maintain focus"
                })
              }
            }

            // Suggest task splitting for very long tasks
            if (task.duration > 90 && !task.needsSplitting) {
              task.needsSplitting = true
              console.log(`Marking task "${task.title}" for splitting (${task.duration}min)`)
            }

            // Suggest rounding the duration if it's not a multiple of 5
            if (task.duration % 5 !== 0) {
              task.suggestedBreaks.push({
                after: 0,
                duration: 0,
                reason: "Consider rounding to nearest 5 minutes for easier scheduling"
              })
            }
          })
        });

        // Check for task coverage
        const processedTaskTitles = new Set(
          processedData.stories.flatMap((story: any) => 
            story.tasks.map((task: any) => task.title.toLowerCase().trim())
          )
        )
        
        const missingTasks = body.tasks.filter((task: string) => 
          !processedTaskTitles.has(task.toLowerCase().trim())
        )

        if (missingTasks.length > 0) {
          console.warn('Some tasks were not included in the processed output:', missingTasks)
        }

        return NextResponse.json(processedData)
      } catch (error) {
        console.error('JSON processing error:', error)
        throw new TaskProcessingError(
          'Failed to process AI response',
          'JSON_PROCESSING_ERROR',
          error
        )
      }
    } catch (error) {
      if (error instanceof TaskProcessingError) throw error
      throw new TaskProcessingError(
        'Story processing failed',
        'PROCESSING_ERROR',
        error
      )
    }
  } catch (error) {
    console.error('Task processing API error:', error)
    
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
    
    if (error instanceof TaskProcessingError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 400 })
    }
    
    return NextResponse.json({
      error: 'Failed to process tasks',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 