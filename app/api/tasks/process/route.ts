import { Anthropic } from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Input validation schema
const RequestSchema = z.object({
  tasks: z.array(z.string()).min(1, "At least one task is required")
})

type TaskCategory = 'UX' | 'API' | 'Development' | 'Testing' | 'Documentation' | 'Refactoring' | 'Learning' | 'Project Management' | 'Planning' | 'Research'

interface TaskAnalysis {
  hasTimeEstimate: boolean
  suggestedDuration?: number
  type: "timeboxed" | "flexible" | "milestone"
  complexity: "low" | "medium" | "high"
  project?: string
  category?: TaskCategory
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
    .find(([_, pattern]) => pattern.test(task))?.[0] as TaskCategory | undefined

  return {
    hasTimeEstimate: hasExplicitTime,
    type: isMilestone ? "milestone" : hasExplicitTime ? "timeboxed" : "flexible",
    complexity: complexityIndicators <= 5 ? "low" : complexityIndicators <= 10 ? "medium" : "high",
    project,
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
  const categoryMultipliers: Record<TaskCategory, number> = {
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

const ProcessedTaskSchema = z.object({
  title: z.string(),
  duration: z.number(),
  isFrog: z.boolean(),
  type: z.enum(['focus', 'learning', 'review']),
  isFlexible: z.boolean(),
  suggestedBreaks: z.array(TaskBreakSchema),
  needsSplitting: z.boolean().optional() // Add this field to indicate if task needs splitting
})

const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  icon: z.string(),
  estimatedDuration: z.number(),
  type: z.enum(['timeboxed', 'flexible', 'milestone']),
  project: z.string(),
  category: z.string(),
  tasks: z.array(ProcessedTaskSchema)
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

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => ({}))
    
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

    // Preprocess tasks to detect FROG status
    const preprocessedTasks = body.tasks.map((task: string) => preprocessTask(task))
    
    // Use processed text for analysis but keep FROG information
    const analyzedTasks = preprocessedTasks.map((preprocessed: PreprocessedTask) => {
      try {
        const analysis = analyzeTaskText(preprocessed.processedText)
        const suggestedDuration = estimateTaskDuration(preprocessed.processedText, analysis)
        return { 
          task: preprocessed.processedText,
          originalTask: preprocessed.originalText,
          isFrog: preprocessed.isFrog,
          analysis, 
          suggestedDuration 
        }
      } catch (error) {
        throw new TaskProcessingError(
          'Task analysis failed',
          'ANALYSIS_ERROR',
          { task: preprocessed.originalText, error }
        )
      }
    })

    // First AI call for structure analysis
    let structureAnalysis
    try {
      const structureMessage = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Analyze these tasks and create specific, focused groupings. Important rules:
          1. Keep projects separate - don't combine tasks from different projects
          2. Within a project, group by specific feature/component/goal
          3. Identify clear dependencies within each group
          4. Don't create overly broad groupings
          5. Respect explicit project prefixes (e.g., "Nurture:", "Retool:")
          6. Consider task type and category when grouping
          7. Keep responses concise and focused
          8. CRITICAL: Do not consider or analyze task priority - this is already determined

          Tasks:
          ${JSON.stringify(analyzedTasks.map((t: { task: string; isFrog: boolean }) => ({ 
            id: analyzedTasks.indexOf(t),
            text: t.task,
            isFrog: t.isFrog
          })), null, 2)}

          Categorize each task group using ONLY these specific categories:
          - UX: User interface and experience work
          - API: Backend and API development
          - Development: General software development
          - Testing: QA and testing activities
          - Documentation: Writing and maintaining docs
          - Refactoring: Code improvement and cleanup
          - Learning: Educational and training tasks
          - Project Management: Planning and coordination
          - Planning: Strategy and architecture
          - Research: Investigation and analysis

          Respond with your analysis in this exact JSON format:
          {
            "taskGroups": [{
              "project": "Project name",
              "feature": "Specific feature/component",
              "category": "UX" | "API" | "Development" | "Testing" | "Documentation" | "Refactoring" | "Learning" | "Project Management" | "Planning" | "Research",
              "relatedTasks": [task indices],
              "dependencies": [task indices],
              "reasoning": "Brief explanation"
            }]
          }`
        }]
      })

      const structureContent = structureMessage.content[0]
      if (!('text' in structureContent)) {
        throw new TaskProcessingError(
          'Invalid API response format',
          'API_RESPONSE_ERROR',
          'Response content does not contain text field'
        )
      }

      try {
        // Log the raw response for debugging
        console.log('Raw structure analysis response:', structureContent.text)
        
        // Parse and validate the structure
        const parsedStructure = JSON.parse(structureContent.text)
        structureAnalysis = await StructureAnalysisSchema.parseAsync(parsedStructure)
      } catch (error) {
        console.error('Structure analysis parsing failed:', error)
        console.error('Raw AI response:', structureContent.text)
        
        // Enhanced error handling for category validation
        if (error instanceof z.ZodError) {
          const invalidCategories = error.issues
            .filter(issue => 
              issue.code === 'invalid_enum_value' && 
              issue.path.includes('category')
            )
            .map(issue => {
              const enumIssue = issue as z.ZodInvalidEnumValueIssue
              return enumIssue.received
            })
          
          if (invalidCategories.length > 0) {
            throw new TaskProcessingError(
              'Invalid task categories detected',
              'INVALID_CATEGORIES',
              {
                message: 'The AI returned categories that are not in the allowed list',
                invalidCategories,
                allowedCategories: TaskGroupSchema.shape.category._def.values
              }
            )
          }
        }
        
        throw new TaskProcessingError(
          'Invalid structure analysis format',
          'PARSING_ERROR',
          { error, response: structureContent.text }
        )
      }
    } catch (error) {
      if (error instanceof TaskProcessingError) throw error
      throw new TaskProcessingError(
        'Structure analysis failed',
        'STRUCTURE_ERROR',
        error
      )
    }

    // Second AI call for story creation
    let processedData
    try {
      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Create specific, focused story groupings based on this task analysis.
          Important rules:
          1. Each story should represent a specific, focused piece of work
          2. Don't combine different projects into one story
          3. Use project and feature information to create distinct groupings
          4. Keep related tasks together (e.g., API work with its testing)
          5. For tasks over 60 minutes, mark them as needsSplitting: true
          6. Keep responses concise and focused
          7. Keep original task durations - DO NOT split tasks yet
          8. Add a note in the summary if a task will need splitting later
          9. CRITICAL: Use the provided isFrog value for each task - DO NOT analyze priority
          
          Original Tasks:
          ${JSON.stringify(body.tasks.map((task: string, index: number) => ({ id: index, text: task })), null, 2)}

          Task Analysis: ${JSON.stringify(analyzedTasks, null, 2)}
          Structure Analysis: ${JSON.stringify(structureAnalysis, null, 2)}

          Respond with this exact JSON format:
          {
            "stories": [{
              "title": "Story title (specific to project/feature)",
              "summary": "Brief description of the specific work",
              "icon": "Suggested emoji icon",
              "estimatedDuration": number (in minutes),
              "type": "timeboxed" | "flexible" | "milestone",
              "project": "string",
              "category": "string",
              "tasks": [{
                "title": "Task title",
                "duration": number (in minutes),
                "isFrog": boolean (use the provided value, DO NOT determine priority),
                "type": "focus" | "learning" | "review",
                "isFlexible": boolean,
                "needsSplitting": boolean (true if duration > 60),
                "suggestedBreaks": [{
                  "after": number (minutes),
                  "duration": number (minutes),
                  "reason": "string"
                }]
              }]
            }]
          }`
        }]
      })

      const messageContent = message.content[0]
      if (!('text' in messageContent)) {
        throw new TaskProcessingError(
          'Invalid API response format',
          'API_RESPONSE_ERROR',
          'Response content does not contain text field'
        )
      }

      try {
        // Log the raw response for debugging
        console.log('Raw story creation response:', messageContent.text)
        
        let parsedData
        try {
          parsedData = JSON.parse(messageContent.text)
        } catch (parseError) {
          console.error('JSON parsing failed:', parseError)
          throw new TaskProcessingError(
            'Failed to parse AI response as JSON',
            'JSON_PARSE_ERROR',
            {
              error: parseError,
              response: messageContent.text
            }
          )
        }

        // Validate the response has the required structure before full validation
        if (!parsedData || typeof parsedData !== 'object' || !('stories' in parsedData)) {
          throw new TaskProcessingError(
            'Invalid response structure',
            'INVALID_STRUCTURE',
            {
              received: parsedData,
              expected: 'Object with stories array'
            }
          )
        }

        // Perform full schema validation
        processedData = await ProcessedDataSchema.parseAsync(parsedData)
      } catch (error) {
        console.error('Story processing parsing failed:', error)
        console.error('Raw AI response:', messageContent.text)
        
        if (error instanceof TaskProcessingError) {
          throw error
        }
        
        throw new TaskProcessingError(
          'Invalid processed data format',
          'PARSING_ERROR',
          { error, response: messageContent.text }
        )
      }

      // Validate story data
      if (!processedData.stories || processedData.stories.length === 0) {
        throw new TaskProcessingError(
          'No stories generated',
          'EMPTY_OUTPUT',
          'AI processing resulted in no stories'
        )
      }

      // Validate story durations match task durations
      for (const story of processedData.stories) {
        // Calculate total task duration for the story
        const totalTaskDuration = story.tasks.reduce((sum, task) => sum + task.duration, 0)
        
        // Set the story's estimated duration to match total task duration
        story.estimatedDuration = totalTaskDuration

        // For each task, add scheduling suggestions
        for (const task of story.tasks) {
          // Find the original task in analyzedTasks
          const originalTask = analyzedTasks.find((t: { task: string; suggestedDuration: number }) => 
            t.task.toLowerCase().includes(task.title.toLowerCase()) ||
            task.title.toLowerCase().includes(t.task.toLowerCase())
          )

          if (originalTask) {
            // Add scheduling suggestions for the session planner
            if (task.duration < 15) {
              task.suggestedBreaks.push({
                after: 0,
                duration: 0,
                reason: "Consider combining with another task - duration less than recommended 15 minutes"
              })
            }
            if (task.duration > 60) {
              task.needsSplitting = true
              task.suggestedBreaks.push({
                after: 0,
                duration: 0,
                reason: "Consider splitting into smaller sessions (15-60 minutes each)"
              })
            }
            if (task.duration % 5 !== 0) {
              task.suggestedBreaks.push({
                after: 0,
                duration: 0,
                reason: "Consider rounding to nearest 5 minutes for easier scheduling"
              })
            }
          }
        }
      }

      // Check for task coverage
      const processedTaskTitles = new Set(
        processedData.stories.flatMap(story => 
          story.tasks.map(task => task.title.toLowerCase().trim())
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
      if (error instanceof TaskProcessingError) throw error
      throw new TaskProcessingError(
        'Story processing failed',
        'PROCESSING_ERROR',
        error
      )
    }
  } catch (error) {
    console.error('Task processing error:', error)

    if (error instanceof TaskProcessingError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 400 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Data validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 