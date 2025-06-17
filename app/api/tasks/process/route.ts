import { Anthropic } from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { APIProcessResponse } from "@/lib/types";
import { transformTaskData } from "@/lib/transformUtils";

// Input validation schema
const RequestSchema = z.object({
  tasks: z.array(z.string()).min(1, "At least one task is required"),
});

// Renamed to ProjectCategory to avoid confusion with TaskCategory (task types)
export type ProjectCategory =
  | "UX"
  | "API"
  | "Development"
  | "Testing"
  | "Documentation"
  | "Refactoring"
  | "Learning"
  | "Project Management"
  | "Planning"
  | "Research";

const DURATION_RULES = {
  MIN_DURATION: 15, // Minimum duration for any task
  BLOCK_SIZE: 5, // All durations must be multiples of 5
  MAX_DURATION: 180, // Maximum duration for a single task
} as const;

function roundToNearestBlock(duration: number): number {
  return Math.max(
    DURATION_RULES.MIN_DURATION,
    Math.round(duration / DURATION_RULES.BLOCK_SIZE) *
      DURATION_RULES.BLOCK_SIZE,
  );
}

class TaskProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TaskProcessingError";
  }
}

// Local type for casting AI response tasks
// Matches the interface in lib/transformUtils.ts
interface TaskDataInput {
  type?: string;
  taskCategory?: string;
  project?: string;
  projectType?: string;
  [key: string]: unknown;
}

export async function POST(req: Request) {
  try {
    // Parse and validate request body
    const body = await req.json().catch(() => ({}));

    try {
      await RequestSchema.parseAsync(body);
    } catch (error) {
      console.error("Request validation failed:", error);
      return NextResponse.json(
        {
          error: "Invalid request format",
          code: "VALIDATION_ERROR",
          details: error instanceof z.ZodError ? error.errors : error,
        },
        { status: 400 },
      );
    }

    try {
      console.log(`Processing ${body.tasks.length} tasks:`, body.tasks);

      // Send task list to Claude for processing
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        temperature: 0.3,
        system:
          "You are an expert at analyzing tasks and organizing them into cohesive stories/epics. Extract structure, categorize, estimate time, and provide organization hints.",
        messages: [
          {
            role: "user",
            content: `Create a structured task plan from this brain dump of tasks:
${body.tasks.join("\n")}

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
}`,
          },
        ],
      });

      // Extract the response content
      const messageContent = response.content[0];
      if (!("text" in messageContent)) {
        throw new TaskProcessingError(
          "Invalid API response format",
          "API_RESPONSE_ERROR",
          "Response content does not contain text field",
        );
      }

      // Log the raw response for debugging
      console.log("Raw response:", messageContent.text);

      let processedData: APIProcessResponse;
      try {
        // Attempt to extract and parse JSON
        const jsonMatch = messageContent.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON object found in response");
        }

        const jsonText = jsonMatch[0];
        // Type assertion for the parsed data
        const parsedData = JSON.parse(jsonText) as { stories?: unknown[] };

        // Create processedData with proper type handling
        processedData = {
          stories: (parsedData.stories || []).map((story) => {
            const s = story as import("@/lib/types").APIProcessedStory;
            return {
              ...s,
              tasks: Array.isArray(s.tasks)
                ? (s.tasks as unknown[]).map(
                    (task) =>
                      transformTaskData(
                        task as TaskDataInput,
                      ) as unknown as import("@/lib/types").APIProcessedTask,
                  )
                : [],
            };
          }),
        };

        // Add UUIDs for any tasks that don't have IDs
        processedData.stories.forEach((story: { tasks: { id?: string }[] }) => {
          story.tasks = story.tasks.map((task: { id?: string }) => {
            // Ensure task has an ID
            if (!task.id) {
              task.id = crypto.randomUUID();
            }
            return task;
          });
        });

        // Validate task durations and suggest breaks
        processedData.stories.forEach(
          (story: {
            tasks: {
              id?: string;
              duration?: number;
              suggestedBreaks?: unknown[];
              needsSplitting?: boolean;
              title?: string;
            }[];
          }) => {
            story.tasks.forEach((task) => {
              // Round durations to the nearest 5 minutes
              if (typeof task.duration === "number") {
                task.duration = roundToNearestBlock(task.duration);
              }

              // Add suggestedBreaks if not present
              if (!task.suggestedBreaks) {
                task.suggestedBreaks = [];
              }

              // Add break suggestion for longer tasks
              if (
                typeof task.duration === "number" &&
                task.duration >= 60 &&
                task.suggestedBreaks.length === 0
              ) {
                task.suggestedBreaks.push({
                  after: 25,
                  duration: 5,
                  reason: "Short break after initial focus period",
                });

                if (task.duration >= 90) {
                  task.suggestedBreaks.push({
                    after: 70,
                    duration: 10,
                    reason: "Longer break to maintain focus",
                  });
                }
              }

              // Suggest task splitting for very long tasks
              if (
                typeof task.duration === "number" &&
                task.duration > 90 &&
                !task.needsSplitting
              ) {
                task.needsSplitting = true;
                console.log(
                  `Marking task "${task.title}" for splitting (${task.duration}min)`,
                );
              }

              // Suggest rounding the duration if it's not a multiple of 5
              if (
                typeof task.duration === "number" &&
                task.duration % 5 !== 0
              ) {
                task.suggestedBreaks.push({
                  after: 0,
                  duration: 0,
                  reason:
                    "Consider rounding to nearest 5 minutes for easier scheduling",
                });
              }
            });
          },
        );

        // Check for task coverage
        const processedTaskTitles = new Set(
          processedData.stories.flatMap(
            (story: { tasks: { title: string }[] }) =>
              story.tasks.map((task) => task.title.toLowerCase().trim()),
          ),
        );

        const missingTasks = body.tasks.filter(
          (task: string) => !processedTaskTitles.has(task.toLowerCase().trim()),
        );

        if (missingTasks.length > 0) {
          console.warn(
            "Some tasks were not included in the processed output:",
            missingTasks,
          );
        }

        return NextResponse.json(processedData);
      } catch (error) {
        console.error("JSON processing error:", error);
        throw new TaskProcessingError(
          "Failed to process AI response",
          "JSON_PROCESSING_ERROR",
          error,
        );
      }
    } catch (error) {
      if (error instanceof TaskProcessingError) throw error;
      throw new TaskProcessingError(
        "Story processing failed",
        "PROCESSING_ERROR",
        error,
      );
    }
  } catch (error) {
    console.error("Task processing error:", error);

    if (error instanceof TaskProcessingError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to process tasks",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
