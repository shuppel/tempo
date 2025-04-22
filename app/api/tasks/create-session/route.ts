import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DURATION_RULES as BaseDurationRules,
  TimeBox as DurationTimeBox,
  calculateDurationSummary,
} from "@/lib/durationUtils";
import type { TaskType } from "@/lib/types";
import {
  transformTaskData,
  transformStoryData,
  isSplitTaskPart,
  getBaseStoryTitle,
} from "@/lib/transformUtils";
import { createModelMessage, getOptimalModel } from "@/lib/anthropicUtils";

// Extend the duration rules to include the maximum consecutive work time
const DURATION_RULES = {
  ...BaseDurationRules,
  MAX_WORK_WITHOUT_BREAK: 90, // Maximum consecutive work minutes without a substantial break
};

// Input validation schemas
const TaskBreakSchema = z.object({
  after: z.number(),
  duration: z.number(),
  reason: z.string(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number(),
  taskCategory: z.enum(["focus", "learning", "review", "research"] as const),
  projectType: z.string().optional(),
  isFrog: z.boolean(),
  isFlexible: z.boolean(),
  originalTitle: z.string().optional(),
  splitInfo: z
    .object({
      originalTitle: z.string().optional(),
      isParent: z.boolean(),
      partNumber: z.number().optional(),
      totalParts: z.number().optional(),
    })
    .optional(),
  suggestedBreaks: z.array(TaskBreakSchema).default([]),
});

const StorySchema = z.object({
  title: z.string(),
  summary: z.string(),
  icon: z.string(),
  estimatedDuration: z.number(),
  type: z.enum(["timeboxed", "flexible", "milestone"] as const),
  projectType: z.string(),
  category: z.string(),
  tasks: z.array(TaskSchema),
});

// Add a schema for story mapping
const StoryMappingSchema = z.object({
  possibleTitle: z.string(),
  originalTitle: z.string(),
});

// Update request schema to include story mapping
const RequestSchema = z.object({
  stories: z.array(StorySchema),
  startTime: z.string(),
  storyMapping: z.array(StoryMappingSchema).optional(),
});

class SessionCreationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SessionCreationError";
  }
}

// Add types for response data structure
interface TimeBoxTask {
  id: string;
  title: string;
  duration: number;
  taskCategory?: TaskType;
  projectType?: string;
  originalTitle?: string;
  isFrog?: boolean;
  splitInfo?: {
    originalTitle?: string;
    isParent: boolean;
    partNumber?: number;
    totalParts?: number;
  };
  suggestedBreaks?: Array<{
    after: number;
    duration: number;
    reason: string;
  }>;
}

interface TimeBox extends DurationTimeBox {
  startTime: string;
  tasks: TimeBoxTask[];
}

interface StoryBlock {
  title: string;
  summary: string;
  icon: string;
  timeBoxes: TimeBox[];
  totalDuration: number;
  suggestions?: Array<{
    type: string;
    task: string;
    message: string;
    details: Record<string, unknown>;
  }>;
}

interface StoryWithTitle {
  title: string;
  estimatedDuration?: number;
  tasks: unknown[];
  originalTitle?: string;
  [key: string]: unknown;
}

interface StoryMapping {
  possibleTitle: string;
  originalTitle: string;
}

// Update findOriginalStory function to use story mapping if available
function findOriginalStory(
  storyTitle: string,
  stories: StoryWithTitle[],
  storyMapping?: StoryMapping[],
): StoryWithTitle | null {
  // Special case for "Break" blocks which don't correspond to actual stories
  if (
    storyTitle === "Break" ||
    storyTitle.toLowerCase().includes("break") ||
    storyTitle.startsWith("Story Block ") ||
    storyTitle.includes("Auto-Generated")
  ) {
    console.log(`Creating dummy story for special block: ${storyTitle}`);
    // Return a dummy story object with minimal required properties
    return {
      title: storyTitle,
      estimatedDuration: 15, // Default duration for breaks or auto-generated blocks
      tasks: [],
      type: "flexible",
      projectType: "System",
      category: storyTitle.toLowerCase().includes("break")
        ? "Break"
        : "Auto-generated",
      summary: storyTitle.toLowerCase().includes("break")
        ? "Scheduled break time"
        : "System-generated block",
    };
  }

  // First check if we have mapping data available and try to use it
  if (storyMapping && storyMapping.length > 0) {
    // Find this title in the mapping
    const mapping = storyMapping.find((m) => m.possibleTitle === storyTitle);
    if (mapping) {
      // Use the original title from mapping to find the story
      const originalStory = stories.find(
        (s) => s.title === mapping.originalTitle,
      );
      if (originalStory) {
        console.log(
          `Found story using mapping: ${storyTitle} -> ${mapping.originalTitle}`,
        );
        return originalStory;
      }
    }
  }

  // If mapping doesn't work or isn't available, try other methods

  // First try exact match
  let original = stories.find((story) => story.title === storyTitle);
  if (original) return original;

  // If not found and title contains "Part X of Y", try matching the base title
  if (isSplitTaskPart(storyTitle)) {
    const baseTitle = getBaseStoryTitle(storyTitle);
    original = stories.find((story) => story.title === baseTitle);
    if (original) return original;

    // Try fuzzy match on base title
    original = stories.find((story) => {
      return story.title.includes(baseTitle) || baseTitle.includes(story.title);
    });
    if (original) return original;
  }

  // Try fuzzy match as last resort
  original = stories.find((story) => {
    const storyWords = story.title.toLowerCase().split(/\s+/);
    const searchWords = storyTitle.toLowerCase().split(/\s+/);

    // Count matching words
    const matchCount = searchWords.filter((word) =>
      storyWords.some(
        (storyWord) => storyWord.includes(word) || word.includes(storyWord),
      ),
    ).length;

    // Require at least 50% of words to match or minimum 2 words
    return matchCount >= Math.max(2, Math.floor(searchWords.length / 2));
  });

  if (original) {
    console.log(
      `Found story using fuzzy match: ${storyTitle} -> ${original.title}`,
    );
  }

  // If all matching methods fail, check if this is a malformed block
  // that got generated during processing
  if (!original && (storyTitle === "undefined" || storyTitle === "null")) {
    console.warn(
      `Detected malformed story block with title "${storyTitle}", creating dummy story`,
    );
    return {
      title: storyTitle,
      estimatedDuration: 0,
      tasks: [],
      type: "flexible",
      projectType: "System",
      category: "Auto-generated",
      summary: "Malformed block detected during processing",
    };
  }

  return original || null;
}

// Add this helper function after areTitlesSimilar but before the POST handler
function detectMissingTaskParts(
  missingTasks: string[],
  originalTasks: z.infer<typeof TaskSchema>[],
): {
  hasMissingParts: boolean;
  missingPartsList: Array<{
    baseTitle: string;
    totalParts: number;
    missingParts: number[];
  }>;
} {
  // Extract base titles and part info from missing tasks
  const partPattern = /\(Part (\d+) of (\d+)\)/i;
  const missingPartsByBase: Record<
    string,
    { totalParts: number; missingParts: Set<number> }
  > = {};

  // Process all missing tasks to identify missing parts of multi-part tasks
  for (const taskTitle of missingTasks) {
    const match = taskTitle.match(partPattern);
    if (match) {
      const partNumber = parseInt(match[1], 10);
      const totalParts = parseInt(match[2], 10);
      const baseTitle = taskTitle.replace(partPattern, "").trim();

      if (!missingPartsByBase[baseTitle]) {
        missingPartsByBase[baseTitle] = { totalParts, missingParts: new Set() };
      }
      missingPartsByBase[baseTitle].missingParts.add(partNumber);
    }
  }

  // Get all base titles and part info from original tasks to find incomplete sequences
  for (const task of originalTasks) {
    const match = task.title.match(partPattern);
    if (match) {
      const partNumber = parseInt(match[1], 10);
      const totalParts = parseInt(match[2], 10);
      const baseTitle = task.title.replace(partPattern, "").trim();

      // Check if we have any missing parts for this base title
      if (!missingPartsByBase[baseTitle]) {
        // See if we can find at least one part in the scheduled tasks
        const anyPartFound = originalTasks.some((otherTask) => {
          const otherMatch = otherTask.title.match(partPattern);
          return (
            otherMatch &&
            otherTask.title.replace(partPattern, "").trim() === baseTitle &&
            !missingTasks.includes(otherTask.title)
          );
        });

        // If we found at least one part, but not all, create an entry for this base title
        if (anyPartFound) {
          missingPartsByBase[baseTitle] = {
            totalParts,
            missingParts: new Set(),
          };
        }
      }

      // If we have an entry for this base title, check if this part is missing
      if (missingPartsByBase[baseTitle] && missingTasks.includes(task.title)) {
        missingPartsByBase[baseTitle].missingParts.add(partNumber);
      }
    }
  }

  // Format results as an array
  const missingPartsList = Object.entries(missingPartsByBase).map(
    ([baseTitle, info]) => ({
      baseTitle,
      totalParts: info.totalParts,
      missingParts: Array.from(info.missingParts).sort((a, b) => a - b),
    }),
  );

  return {
    hasMissingParts: missingPartsList.length > 0,
    missingPartsList,
  };
}

function validateAllTasksIncluded(
  originalTasks: z.infer<typeof TaskSchema>[],
  scheduledTasks: TimeBoxTask[],
): {
  isMissingTasks: boolean;
  missingTasks: string[];
  scheduledCount: number;
  originalCount: number;
  partAnalysis?: {
    hasMissingParts: boolean;
    missingPartsList: Array<{
      baseTitle: string;
      totalParts: number;
      missingParts: number[];
    }>;
  };
} {
  // Create maps to track tasks by ID and title
  const originalTaskMap = new Map<string, z.infer<typeof TaskSchema>>();
  const scheduledTaskMap = new Map<string, TimeBoxTask>();
  const titleToIdMap = new Map<string, string>();
  const parentTaskMap = new Map<string, Set<string>>();

  console.log(
    `Validating ${originalTasks.length} original tasks against ${scheduledTasks.length} scheduled tasks`,
  );

  // Build maps of original tasks
  originalTasks.forEach((task) => {
    originalTaskMap.set(task.id, task);

    // Normalize the title by lowercasing
    const normalizedTitle = task.title.toLowerCase();
    titleToIdMap.set(normalizedTitle, task.id);

    // Store original title mapping if available
    if (task.originalTitle) {
      titleToIdMap.set(task.originalTitle.toLowerCase(), task.id);
    }

    // Check if this is a split task (Part X of Y)
    if (task.title.includes("Part") && task.title.includes("of")) {
      // Extract the base part by removing the (Part X of Y)
      const baseMatch = task.title.match(/(.*?)\s*\(Part \d+ of \d+\)/i);
      if (baseMatch && baseMatch[1]) {
        const baseTitle = baseMatch[1].trim().toLowerCase();

        // Create a relation between base title and parts
        if (!parentTaskMap.has(baseTitle)) {
          parentTaskMap.set(baseTitle, new Set());
        }
        parentTaskMap.get(baseTitle)!.add(task.id);

        // Also add the base title to ID mapping
        titleToIdMap.set(baseTitle, task.id);
      }
    }
  });

  console.log(
    `Created mappings for ${titleToIdMap.size} task titles and ${parentTaskMap.size} parent tasks`,
  );

  // Filter out Break blocks before validation
  const filteredScheduledTasks = scheduledTasks.filter((task) => {
    // Skip "Break" tasks in validation
    return !task.title.includes("Break");
  });

  // Track which tasks we've found in the schedule
  const foundTaskIds = new Set<string>();

  // For performance reasons, start by doing direct title matches, which are faster
  for (const task of filteredScheduledTasks) {
    const normalizedTitle = task.title.toLowerCase();
    scheduledTaskMap.set(normalizedTitle, task);

    // Direct match by title
    const taskId = titleToIdMap.get(normalizedTitle);
    if (taskId) {
      foundTaskIds.add(taskId);
      continue; // Skip to next task since we found a match
    }

    // Handle split tasks with direct match
    if (task.splitInfo?.originalTitle) {
      const originalId = titleToIdMap.get(
        task.splitInfo.originalTitle.toLowerCase(),
      );
      if (originalId) {
        foundTaskIds.add(originalId);
        continue; // Skip to next task since we found a match
      }
    }

    // Handle part titles with direct match
    if (task.title.includes("Part") && task.title.includes("of")) {
      const baseMatch = task.title.match(/(.*?)\s*\(Part \d+ of \d+\)/i);
      if (baseMatch && baseMatch[1]) {
        const baseTitle = baseMatch[1].trim().toLowerCase();

        // Find the parent task set
        const parentTaskIds = parentTaskMap.get(baseTitle);
        if (parentTaskIds) {
          // Mark all parts as found (since we're accounting for the split)
          parentTaskIds.forEach((id) => foundTaskIds.add(id));
          console.log(
            `Matched split task ${task.title} to base task ${baseTitle}`,
          );
          continue; // Skip to next task since we found matches
        }
      }
    }
  }

  // Second pass for any unmatched tasks - use more expensive fuzzy matching
  // Only do this for tasks that weren't matched in the first pass
  const remainingScheduledTasks = filteredScheduledTasks.filter((task) => {
    const normalizedTitle = task.title.toLowerCase();
    const directMatch =
      titleToIdMap.has(normalizedTitle) &&
      Array.from(titleToIdMap.entries()).some(
        ([, id]) =>
          foundTaskIds.has(id) && titleToIdMap.get(normalizedTitle) === id,
      );
    return !directMatch;
  });

  // For remaining unmatched tasks, use fuzzy matching
  if (remainingScheduledTasks.length > 0) {
    console.log(
      `Using fuzzy matching for ${remainingScheduledTasks.length} unmatched tasks`,
    );

    for (const task of remainingScheduledTasks) {
      let matched = false;

      // Get all unmatched original tasks
      const unmatchedOriginalTasks = Array.from(originalTaskMap.entries())
        .filter(([, task]) => !foundTaskIds.has(task.id))
        .map(([, task]) => task);

      // Try to find a match using areTitlesSimilar
      for (const originalTask of unmatchedOriginalTasks) {
        if (areTitlesSimilar(task.title, originalTask.title)) {
          foundTaskIds.add(originalTask.id);
          console.log(
            `Fuzzy matched: "${task.title}" to "${originalTask.title}"`,
          );
          matched = true;
          break;
        }

        // Also try matching with originalTitle if available
        if (
          originalTask.originalTitle &&
          areTitlesSimilar(task.title, originalTask.originalTitle)
        ) {
          foundTaskIds.add(originalTask.id);
          console.log(
            `Fuzzy matched: "${task.title}" to original "${originalTask.originalTitle}"`,
          );
          matched = true;
          break;
        }
      }

      if (!matched) {
        console.log(`No match found for task: "${task.title}"`);
      }
    }
  }

  // Find missing tasks by comparing original tasks with found tasks
  const missingTaskIds = Array.from(originalTaskMap.keys()).filter(
    (id) => !foundTaskIds.has(id),
  );

  const missingTasks = missingTaskIds.map(
    (id) => originalTaskMap.get(id)!.title,
  );

  console.log(
    `Found ${foundTaskIds.size}/${originalTasks.length} tasks in schedule`,
  );
  if (missingTasks.length > 0) {
    console.log(`Missing tasks: ${missingTasks.join(", ")}`);

    // Analyze missing parts of multi-part tasks
    const partAnalysis = detectMissingTaskParts(missingTasks, originalTasks);
    if (partAnalysis.hasMissingParts) {
      console.warn("Detected incomplete multi-part task sequences:");
      partAnalysis.missingPartsList.forEach((item) => {
        console.warn(
          `- "${item.baseTitle}": missing parts ${item.missingParts.join(", ")} of ${item.totalParts}`,
        );
      });
    }

    return {
      isMissingTasks: missingTasks.length > 0,
      missingTasks,
      scheduledCount: filteredScheduledTasks.length,
      originalCount: originalTasks.length,
      partAnalysis,
    };
  }

  return {
    isMissingTasks: missingTasks.length > 0,
    missingTasks,
    scheduledCount: filteredScheduledTasks.length,
    originalCount: originalTasks.length,
  };
}

// Add this new helper function before insertMissingBreaks
function preventExcessiveWorkTime(storyBlocks: StoryBlock[]): StoryBlock[] {
  // Create a deep copy to avoid modifying the original
  const adjustedBlocks = JSON.parse(JSON.stringify(storyBlocks));

  // Track overall modifications for logging
  let totalAdjustments = 0;

  for (const block of adjustedBlocks) {
    let adjustmentsInBlock = 0;

    // Skip if no timeBoxes
    if (
      !block.timeBoxes ||
      !Array.isArray(block.timeBoxes) ||
      block.timeBoxes.length === 0
    ) {
      continue;
    }

    let consecutiveWorkTime = 0;

    // First pass: identify potential issues
    for (let i = 0; i < block.timeBoxes.length; i++) {
      const timeBox = block.timeBoxes[i];

      if (timeBox.type === "work") {
        consecutiveWorkTime += timeBox.duration;

        // Check if we're approaching the limit
        if (consecutiveWorkTime > DURATION_RULES.MAX_WORK_WITHOUT_BREAK) {
          // Find a good place to add a break - preferably after the current box
          console.log(
            `Pre-validation: Found excessive work time (${consecutiveWorkTime}m) in "${block.title}" around timeBox ${i}`,
          );

          // Add a break after this timeBox
          const breakTimeBox: TimeBox = {
            type: "long-break",
            duration: DURATION_RULES.LONG_BREAK,
            startTime: "auto", // Will be set correctly during insertMissingBreaks
            tasks: [],
          };

          // Insert the break after the current timeBox
          block.timeBoxes.splice(i + 1, 0, breakTimeBox);

          // Reset counter since we added a break
          consecutiveWorkTime = 0;
          adjustmentsInBlock++;
          totalAdjustments++;

          // Skip the newly added break in the next iteration
          i++;
        }
      } else if (timeBox.type === "long-break") {
        consecutiveWorkTime = 0;
      } else if (timeBox.type === "short-break") {
        // Short breaks reduce the counter but don't reset it completely
        consecutiveWorkTime = Math.max(
          0,
          consecutiveWorkTime - DURATION_RULES.SHORT_BREAK_WORK_REDUCTION,
        );
      }
    }

    if (adjustmentsInBlock > 0) {
      console.log(
        `Pre-validation: Added ${adjustmentsInBlock} breaks to story "${block.title}" to prevent validation errors`,
      );
    }
  }

  if (totalAdjustments > 0) {
    console.log(
      `Pre-validation: Added a total of ${totalAdjustments} breaks across all stories to prevent excessive work time errors`,
    );
  }

  return adjustedBlocks;
}

// Add helper function to insert breaks when work time exceeds maximum allowed
function insertMissingBreaks(storyBlocks: StoryBlock[]): StoryBlock[] {
  // Create a deep copy to avoid modifying the original directly
  const updatedBlocks = JSON.parse(JSON.stringify(storyBlocks));

  for (let blockIndex = 0; blockIndex < updatedBlocks.length; blockIndex++) {
    const block = updatedBlocks[blockIndex];
    const updatedTimeBoxes: TimeBox[] = [];

    let consecutiveWorkTime = 0;
    const currentTime = new Date();

    // Set the start time for the first time box
    if (block.timeBoxes.length > 0) {
      const [hours, minutes] = block.timeBoxes[0].startTime
        .split(":")
        .map(Number);
      currentTime.setHours(hours, minutes, 0, 0);
    }

    // First pass: identify and split any individual long work boxes
    for (let i = 0; i < block.timeBoxes.length; i++) {
      const timeBox = block.timeBoxes[i];

      // Check if this single work time box is longer than the maximum allowed
      if (
        timeBox.type === "work" &&
        timeBox.duration > DURATION_RULES.MAX_WORK_WITHOUT_BREAK
      ) {
        console.log(
          `Splitting long work box of ${timeBox.duration} minutes into multiple parts with breaks`,
        );

        // Calculate how to split this long task
        let remainingDuration = timeBox.duration;
        const startTime = timeBox.startTime;
        let currentStartTime = startTime;

        // Set time to the start of this box
        const [hours, minutes] = currentStartTime.split(":").map(Number);
        currentTime.setHours(hours, minutes, 0, 0);

        // While we have remaining duration to allocate
        while (remainingDuration > 0) {
          // Determine the current segment duration - ensure it doesn't exceed MAX_WORK_WITHOUT_BREAK
          const segmentDuration = Math.min(
            remainingDuration,
            DURATION_RULES.MAX_WORK_WITHOUT_BREAK,
          );

          // Create a work segment
          const workSegment: TimeBox = {
            ...timeBox,
            startTime: currentStartTime,
            duration: segmentDuration,
          };

          // For tasks, we need to clone them and adjust durations
          if (timeBox.tasks && timeBox.tasks.length > 0) {
            // Keep track of the original task for the first segment
            const isFirstSegment = currentStartTime === startTime;

            workSegment.tasks = timeBox.tasks.map((task: TimeBoxTask) => ({
              ...task,
              duration: segmentDuration,
              title: isFirstSegment ? task.title : `${task.title} (continued)`,
            }));
          }

          // Add the work segment
          updatedTimeBoxes.push(workSegment);

          // Update tracking variables
          remainingDuration -= segmentDuration;

          // Update time pointer
          currentTime.setMinutes(currentTime.getMinutes() + segmentDuration);

          // If we still have work remaining, insert a break
          if (remainingDuration > 0) {
            // Create a break
            const breakDuration = DURATION_RULES.LONG_BREAK;
            const breakStartTime = currentTime.toTimeString().slice(0, 5);

            const breakTimeBox: TimeBox = {
              type: "long-break",
              startTime: breakStartTime,
              duration: breakDuration,
              tasks: [],
            };

            // Add the break
            updatedTimeBoxes.push(breakTimeBox);

            // Update time pointer
            currentTime.setMinutes(currentTime.getMinutes() + breakDuration);
            currentStartTime = currentTime.toTimeString().slice(0, 5);
          }
        }
      } else {
        // For normal time boxes, add them directly
        updatedTimeBoxes.push(timeBox);
      }
    }

    // Second pass: ensure breaks between consecutive work boxes
    const finalTimeBoxes: TimeBox[] = [];
    consecutiveWorkTime = 0; // Reset for second pass
    currentTime.setHours(0, 0, 0, 0); // Reset time

    // Set the start time for the first time box
    if (updatedTimeBoxes.length > 0) {
      const [hours, minutes] = updatedTimeBoxes[0].startTime
        .split(":")
        .map(Number);
      currentTime.setHours(hours, minutes, 0, 0);
    }

    for (let i = 0; i < updatedTimeBoxes.length; i++) {
      const timeBox = updatedTimeBoxes[i];

      // Update current time based on this time box
      const [hours, minutes] = timeBox.startTime.split(":").map(Number);
      currentTime.setHours(hours, minutes, 0, 0);

      // Add the current timeBox to our final list
      finalTimeBoxes.push(timeBox);

      // Get next time after this box
      const nextTime = new Date(currentTime);
      nextTime.setMinutes(nextTime.getMinutes() + timeBox.duration);

      // Track consecutive work time
      if (timeBox.type === "work") {
        // Add this work box's duration to our running total
        consecutiveWorkTime += timeBox.duration;

        // Check if we've exceeded MAX_WORK_WITHOUT_BREAK (now using > for safety)
        const toleranceBuffer = DURATION_RULES.WORK_TIME_TOLERANCE;
        if (
          consecutiveWorkTime >
          DURATION_RULES.MAX_WORK_WITHOUT_BREAK + toleranceBuffer
        ) {
          console.log(
            `Inserting mandatory break at ${nextTime.toTimeString().slice(0, 5)} (consecutive work time: ${consecutiveWorkTime} min exceeded limit of ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} min)`,
          );

          // Create a new break time box
          const breakDuration = DURATION_RULES.LONG_BREAK;
          const breakStartTime = nextTime.toTimeString().slice(0, 5); // Format as HH:MM

          const breakTimeBox: TimeBox = {
            type: "long-break",
            startTime: breakStartTime,
            duration: breakDuration,
            tasks: [],
          };

          // Add the break
          finalTimeBoxes.push(breakTimeBox);

          // Reset consecutive work time counter
          consecutiveWorkTime = 0;

          // Update the next start time
          nextTime.setMinutes(nextTime.getMinutes() + breakDuration);
        }
      } else if (timeBox.type === "long-break") {
        // Long breaks reset the counter
        consecutiveWorkTime = 0;
      } else if (timeBox.type === "short-break") {
        // Short breaks reduce the counter but don't reset it completely
        consecutiveWorkTime = Math.max(
          0,
          consecutiveWorkTime - DURATION_RULES.SHORT_BREAK_WORK_REDUCTION,
        );
      }

      // Update start times for all subsequent time boxes if this isn't the last one
      if (i < updatedTimeBoxes.length - 1) {
        for (let j = i + 1; j < updatedTimeBoxes.length; j++) {
          const nextBox = updatedTimeBoxes[j];
          nextBox.startTime = nextTime.toTimeString().slice(0, 5);

          // Update next time for following boxes
          nextTime.setMinutes(nextTime.getMinutes() + nextBox.duration);
        }
      }
    }

    // Update the timeBoxes array with our final version
    block.timeBoxes = finalTimeBoxes;

    // Recalculate the block's total duration
    const { totalDuration } = calculateDurationSummary(block.timeBoxes);
    block.totalDuration = totalDuration;
  }

  return updatedBlocks;
}

// Extract the inferred type from the schema
type Story = z.infer<typeof StorySchema>;

// Add helper to optimize fuzzy matching for task titles
function areTitlesSimilar(title1: string, title2: string): boolean {
  // Normalize both titles by converting to lowercase and trimming
  const normalizedTitle1 = title1.toLowerCase().trim();
  const normalizedTitle2 = title2.toLowerCase().trim();

  // Check for exact match after normalization
  if (normalizedTitle1 === normalizedTitle2) {
    return true;
  }

  // Check if one contains the other
  if (
    normalizedTitle1.includes(normalizedTitle2) ||
    normalizedTitle2.includes(normalizedTitle1)
  ) {
    return true;
  }

  // For tasks with "Part X of Y" pattern, try to match the base title
  const basePattern = /(.*?)\s*\(?Part \d+ of \d+\)?/i;
  const baseMatch1 = normalizedTitle1.match(basePattern);
  const baseMatch2 = normalizedTitle2.match(basePattern);

  const baseTitle1 = baseMatch1 ? baseMatch1[1].trim() : normalizedTitle1;
  const baseTitle2 = baseMatch2 ? baseMatch2[1].trim() : normalizedTitle2;

  // Compare base titles
  if (baseTitle1 === baseTitle2) {
    return true;
  }

  // Check for significant word overlap to catch fuzzy matches
  const words1 = baseTitle1.split(/\s+/);
  const words2 = baseTitle2.split(/\s+/);

  // Count matching words
  const matchingWords = words1.filter((word) =>
    words2.some((w) => w.includes(word) || word.includes(w)),
  ).length;

  // Require at least 50% of words to match or minimum 2 words for longer titles
  const minimumMatch = Math.max(2, Math.min(words1.length, words2.length) / 2);

  return matchingWords >= minimumMatch;
}

// Add this function after the detectMissingTaskParts function
function shouldAttemptTaskReconciliation(
  validationResult: ReturnType<typeof validateAllTasksIncluded>,
): boolean {
  // Check if we're missing more than 25% of tasks
  if (
    validationResult.originalCount > 0 &&
    validationResult.scheduledCount / validationResult.originalCount < 0.75
  ) {
    console.warn(
      `Missing too many tasks (${validationResult.scheduledCount}/${validationResult.originalCount}), suggesting potential truncation`,
    );
    return true;
  }

  // Check if we have missing parts of multi-part tasks with high part numbers
  if (validationResult.partAnalysis?.hasMissingParts) {
    // Check if any missing parts are higher numbers (e.g., parts 7 or 8 of 8)
    const hasMissingHighPartNumbers =
      validationResult.partAnalysis.missingPartsList.some((item) => {
        const highestPartNumber = Math.max(...item.missingParts);
        return (
          highestPartNumber >= 7 && highestPartNumber >= item.totalParts - 1
        );
      });

    if (hasMissingHighPartNumbers) {
      console.warn(
        "Missing high-numbered parts of multi-part tasks, suggesting truncation",
      );
      return true;
    }
  }

  return false;
}

// Add this function after JSON parsing but before validation
function normalizeStoryBlocks(storyBlocks: StoryBlock[]): StoryBlock[] {
  if (!Array.isArray(storyBlocks)) {
    console.warn(
      "Received non-array storyBlocks to normalize, returning empty array",
    );
    return [];
  }

  const normalizedBlocks: StoryBlock[] = [];

  for (let i = 0; i < storyBlocks.length; i++) {
    const block = storyBlocks[i];

    // Skip null/undefined blocks
    if (!block) {
      console.warn(`Skipping null/undefined block at index ${i}`);
      continue;
    }

    // Check if this is actually a timeBox mistakenly placed at the story block level
    if (
      (block as Partial<TimeBox>).type &&
      ["work", "short-break", "long-break", "debrief"].includes(
        (block as Partial<TimeBox>).type as string,
      ) &&
      typeof (block as Partial<TimeBox>).duration === "number" &&
      !(block as Partial<StoryBlock>).timeBoxes
    ) {
      // Only treat as TimeBox if it has required TimeBox properties
      const maybeTimeBox = block as Partial<TimeBox>;
      if (
        typeof maybeTimeBox.startTime === "string" &&
        Array.isArray(maybeTimeBox.tasks) &&
        typeof maybeTimeBox.type === "string" &&
        typeof maybeTimeBox.duration === "number"
      ) {
        const properBlock: StoryBlock = {
          title:
            maybeTimeBox.type === "long-break"
              ? "Break"
              : `Auto-Generated Block ${i + 1}`,
          summary:
            maybeTimeBox.type === "long-break"
              ? "Scheduled break time"
              : "System-generated block",
          icon: maybeTimeBox.type === "long-break" ? "⏸️" : "📋",
          timeBoxes: [maybeTimeBox as TimeBox],
          totalDuration: maybeTimeBox.duration,
        };
        normalizedBlocks.push(properBlock);
      } else {
        console.warn(
          `Block at index ${i} looked like a TimeBox but is missing required properties, skipping.`,
        );
      }
    } else if (
      !(block as Partial<StoryBlock>).timeBoxes ||
      !Array.isArray((block as Partial<StoryBlock>).timeBoxes)
    ) {
      console.warn(
        `Block at index ${i} missing timeBoxes array, creating an empty one`,
      );
      // Ensure the block has a timeBoxes array property
      const fixedBlock: StoryBlock = {
        ...(block as Partial<StoryBlock>),
        title: (block as Partial<StoryBlock>).title || `Story Block ${i + 1}`,
        summary:
          (block as Partial<StoryBlock>).summary ||
          `Tasks for story block ${i + 1}`,
        icon: (block as Partial<StoryBlock>).icon || "📋",
        timeBoxes: [],
        totalDuration: 0,
      };
      normalizedBlocks.push(fixedBlock);
    } else {
      // Block is already properly structured
      normalizedBlocks.push(block as StoryBlock);
    }
  }

  console.log(
    `Normalized ${storyBlocks.length} blocks into ${normalizedBlocks.length} properly structured blocks`,
  );
  return normalizedBlocks;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stories, startTime, storyMapping } = RequestSchema.parse(body);

    console.log(`Received ${stories.length} stories for session creation`);
    if (storyMapping) {
      console.log(
        `Received mapping data for ${storyMapping.length} possible story titles`,
      );
    }

    const startDateTime = new Date(startTime);

    // Validate that total duration is a reasonable value
    const totalDuration = stories.reduce(
      (sum, story) => sum + story.estimatedDuration,
      0,
    );
    if (totalDuration > 24 * 60) {
      // More than 24 hours
      const hoursPlanned = Math.round(totalDuration / 60);
      throw new SessionCreationError(
        `Whoa there, overachiever! We've calculated that what you want to achieve is about ${hoursPlanned} hours? This is a day planner, not "How to Master the Universe in One Session". Unless you've discovered time travel, try reducing your scope a bit.`,
        "DURATION_EXCEEDED",
        {
          totalDuration,
          maxDuration: 24 * 60,
          suggestion:
            "Consider breaking this into multiple sessions or scaling back your ambitions... just slightly.",
        },
      );
    }

    try {
      // Log input data
      console.log(
        "Creating session with stories:",
        JSON.stringify(stories, null, 2),
      );
      console.log("Start time:", startDateTime.toLocaleTimeString());

      // Use the Task type from our schema instead of the imported type
      const enhancedStories = stories.map(
        (story: z.infer<typeof StorySchema>) => ({
          ...story,
          tasks: story.tasks.map((task: z.infer<typeof TaskSchema>) => ({
            ...task,
            originalTitle: task.originalTitle || task.title,
          })),
        }),
      );

      // Get the optimal model based on our requirements
      // For large task sets, we need a higher token limit
      const model = await getOptimalModel({
        preferredFamily: "haiku",
        maxTokensRequired: 8000,
        prioritizeSpeed: true,
      });

      // Use our new utility function instead of directly calling the API
      const response = await createModelMessage({
        model,
        maxTokens: 8000,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `Based on these stories, create a detailed session plan with time boxes.

Rules:
1. Each story becomes a "story block" containing all its tasks and breaks
2. FROG tasks should be scheduled as early as possible
3. Follow all duration, break and constraints exactly as specified
4. Round all times to 5-minute increments
5. Add a short break (5 mins) between tasks within a story
6. Add a longer break (15 mins) between story blocks
7. CRITICAL: NEVER allow more than ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes of continuous work without inserting a break
8. CRITICAL: For any work session > ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes, split it into smaller segments with long breaks in between
9. CRITICAL: Ensure ALL parts of multi-part tasks are included - do not omit later parts like "Part 8 of 8"
10. IMPORTANT: Keep your response as concise as possible while maintaining accuracy

Break Requirements:
- A long break (15 min) is REQUIRED after every ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes of work
- Even within a single task, if duration > ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes, split the task with breaks
- If consecutive work time approaches ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes, preemptively add a break
- Short breaks (5 min) only reduce accumulated work time partially - they don't reset the counter

Session Parameter Details:
- Start Time: ${startTime}
- Total Stories: ${stories.length}

Stories Data:
${JSON.stringify(enhancedStories, null, 2)}

Respond with a JSON session plan that follows this exact structure:
{
  "summary": {
    "totalSessions": number,
    "startTime": "ISO string",
    "endTime": "ISO string", 
    "totalDuration": number
  },
  "storyBlocks": [
    {
      "title": "Story title",
      "summary": "Story summary",
      "icon": "emoji",
      "timeBoxes": [
        {
          "type": "work" | "short-break" | "long-break" | "debrief",
          "duration": number,
          "tasks": [
            {
              "id": "string",
              "title": "string",
              "duration": number,
              "taskCategory": "focus" | "learning" | "review" | "research",
              "projectType": "string" (optional),
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
}

CRITICAL RULES:
- Keep summaries extremely brief - just a few words is sufficient
- Use short emoji icons
- ENSURE your complete response fits within the available tokens
- NEVER omit or truncate any part of the JSON structure
- Produce valid, complete JSON with no trailing commas
- NEVER change the story or task order provided
- Preserve all task properties exactly as provided
- Use ISO date strings for all times
- Include empty tasks array for break time boxes
- Ensure all durations are in minutes
- Calculate accurate start and end times for each time box
- CRITICAL: All multi-part tasks MUST be included in full - do not drop any parts
- CRITICAL: Ensure no continuous work time exceeds ${DURATION_RULES.MAX_WORK_WITHOUT_BREAK} minutes without a long break`,
          },
        ],
      });

      const messageContent = response.content[0];
      if (!("text" in messageContent)) {
        throw new SessionCreationError(
          "Invalid response format from AI",
          "INVALID_RESPONSE",
          messageContent,
        );
      }

      try {
        // Log the raw response for debugging
        console.log("Raw session plan response:", messageContent.text);

        let parsedData;
        try {
          // Try to extract JSON if the response contains multiple objects
          const jsonMatch = messageContent.text.match(/\{[\s\S]*\}/);
          let jsonText = jsonMatch ? jsonMatch[0] : messageContent.text;

          // Check if the JSON appears to be truncated
          if (
            jsonText.trim().endsWith('":') ||
            jsonText.trim().endsWith(",") ||
            !jsonText.trim().endsWith("}")
          ) {
            console.warn("JSON appears to be truncated or malformed");

            // Try to reconstruct if it's a known response pattern by checking the structure
            if (
              jsonText.includes('"storyBlocks"') &&
              jsonText.includes('"summary"')
            ) {
              // This is likely our expected format but truncated
              console.warn(
                "Attempting to reconstruct truncated JSON with the expected structure",
              );

              // Check if we're missing the final closing brace
              if (
                !jsonText.trim().endsWith("}") &&
                jsonText.split("{").length > jsonText.split("}").length
              ) {
                jsonText = jsonText + "}}"; // Add closing braces for potentially nested unclosed objects
              }
            } else {
              throw new Error(
                "JSON structure is too damaged to repair automatically",
              );
            }
          }

          // Rest of the parsing logic remains the same
          try {
            parsedData = JSON.parse(jsonText);
          } catch (initialParseError) {
            // If standard parsing fails, try a more lenient approach
            console.warn(
              "Standard JSON parsing failed, attempting repair:",
              initialParseError,
            );

            // Check if we can fix common truncation issues
            const fixedJson = jsonText
              .replace(/,\s*}$/, "}") // Fix trailing commas
              .replace(/,\s*]$/, "]") // Fix trailing commas in arrays
              .replace(/:\s*}/, ":null}") // Fix missing values
              .replace(/:\s*]/, ":null]"); // Fix missing values in arrays

            parsedData = JSON.parse(fixedJson);
          }
        } catch (parseError) {
          console.error(
            "JSON parsing failed after repair attempts:",
            parseError,
          );
          throw new SessionCreationError(
            "Failed to parse AI response as JSON",
            "JSON_PARSE_ERROR",
            {
              error: parseError,
              response: messageContent.text,
            },
          );
        }

        // Validate that the parsed data has all required fields
        if (
          !parsedData.summary ||
          !parsedData.storyBlocks ||
          !Array.isArray(parsedData.storyBlocks)
        ) {
          console.error("Parsed data is missing required fields");
          throw new SessionCreationError(
            "AI response is missing required data structure",
            "INVALID_DATA_STRUCTURE",
            {
              parsedData,
              missingFields: [
                !parsedData.summary ? "summary" : null,
                !parsedData.storyBlocks ? "storyBlocks" : null,
                parsedData.storyBlocks && !Array.isArray(parsedData.storyBlocks)
                  ? "storyBlocks (not an array)"
                  : null,
              ].filter(Boolean),
            },
          );
        }

        // Normalize the story blocks structure
        console.log("Normalizing storyBlocks structure...");
        parsedData.storyBlocks = normalizeStoryBlocks(parsedData.storyBlocks);

        // Ensure each story block has the required fields
        for (let i = 0; i < parsedData.storyBlocks.length; i++) {
          const block = parsedData.storyBlocks[i];
          if (
            !block.title ||
            !block.timeBoxes ||
            !Array.isArray(block.timeBoxes)
          ) {
            console.error(
              `Story block at index ${i} is missing required fields`,
            );

            // Try to repair the block with minimal data
            if (!block.title) block.title = `Story Block ${i + 1}`;
            if (!block.summary)
              block.summary = `Tasks for story block ${i + 1}`;
            if (!block.icon) block.icon = "📋";
            if (!block.timeBoxes || !Array.isArray(block.timeBoxes)) {
              console.warn(
                `Reconstructing missing timeBoxes for story block ${i}`,
              );
              block.timeBoxes = [];
            }
            block.totalDuration = block.timeBoxes.reduce(
              (sum: number, box: { duration?: number }) =>
                sum + (box.duration || 0),
              0,
            );
          }
        }

        // Transform fields to ensure consistent property names
        if (parsedData.storyBlocks && Array.isArray(parsedData.storyBlocks)) {
          parsedData.storyBlocks = parsedData.storyBlocks.map(
            (block: Record<string, unknown>) => {
              // Transform the story block itself
              const transformedBlock = transformStoryData(block);

              // Transform timeBoxes and their tasks
              if (
                transformedBlock.timeBoxes &&
                Array.isArray(transformedBlock.timeBoxes)
              ) {
                transformedBlock.timeBoxes = transformedBlock.timeBoxes.map(
                  (timeBox: Record<string, unknown>) => {
                    // Transform tasks within each time box
                    if (timeBox.tasks && Array.isArray(timeBox.tasks)) {
                      timeBox.tasks = timeBox.tasks.map(transformTaskData);
                    }
                    return timeBox;
                  },
                );
              }

              // Transform story properties if needed
              if (!transformedBlock.storyType && transformedBlock.type) {
                console.log(
                  `Transforming story type -> storyType for "${transformedBlock.title}"`,
                );
                transformedBlock.storyType = String(transformedBlock.type);
              }

              if (!transformedBlock.projectType && transformedBlock.project) {
                console.log(
                  `Transforming story project -> projectType for "${transformedBlock.title}"`,
                );
                transformedBlock.projectType = String(transformedBlock.project);
              }

              return transformedBlock;
            },
          );
        }

        // Create a map of original task durations for validation
        const originalTaskDurations = new Map<string, number>();
        stories.forEach((story: z.infer<typeof StorySchema>) => {
          story.tasks.forEach((task: z.infer<typeof TaskSchema>) => {
            originalTaskDurations.set(task.title, task.duration);
          });
        });

        // After processing and transforming the data, validate it
        // This ensures any renamed properties (type->taskCategory, project->projectType) are properly processed
        console.log("Validating processed session plan...");
        const storyBlocks = parsedData.storyBlocks || [];

        // Verify all tasks have the correct properties
        storyBlocks.forEach(
          (block: {
            storyType?: string;
            type?: string;
            projectType?: string;
            project?: string;
            timeBoxes?: unknown[];
            title?: string;
          }) => {
            // Transform story properties if needed
            if (!block.storyType && block.type) {
              console.log(
                `Transforming story type -> storyType for "${block.title}"`,
              );
              block.storyType = block.type;
            }

            if (!block.projectType && block.project) {
              console.log(
                `Transforming story project -> projectType for "${block.title}"`,
              );
              block.projectType = block.project;
              delete block.project;
            }

            if (block.timeBoxes && Array.isArray(block.timeBoxes)) {
              (block.timeBoxes as Array<{ tasks?: unknown[] }>).forEach(
                (timeBox) => {
                  if (timeBox.tasks && Array.isArray(timeBox.tasks)) {
                    (timeBox.tasks as Array<Record<string, unknown>>).forEach(
                      (task) => {
                        // Ensure task has taskCategory property (originally might have been type)
                        if (!task.taskCategory && task.type) {
                          console.log(
                            `Transforming task type -> taskCategory for "${task.title}"`,
                          );
                          task.taskCategory = task.type;
                          delete task.type;
                        }

                        // Ensure task has projectType property (originally might have been project)
                        if (!task.projectType && task.project) {
                          console.log(
                            `Transforming task project -> projectType for "${task.title}"`,
                          );
                          task.projectType = task.project;
                          delete task.project;
                        }
                      },
                    );
                  }
                },
              );
            }
          },
        );

        // Add additional duration validations
        try {
          // Pre-validation: add breaks where needed to prevent validation errors
          console.log(
            "Pre-validation: Checking for potential excessive work time...",
          );
          parsedData.storyBlocks = preventExcessiveWorkTime(
            parsedData.storyBlocks,
          );

          // Then run the existing insertMissingBreaks function
          console.log("Checking for and inserting missing breaks...");
          parsedData.storyBlocks = insertMissingBreaks(parsedData.storyBlocks);

          // Validate each story block's duration matches its time boxes
          for (const block of parsedData.storyBlocks) {
            console.log(`\nValidating story block: ${block.title}`);

            // Use the utility functions for duration calculations
            const { workDuration, breakDuration, totalDuration } =
              calculateDurationSummary(block.timeBoxes);

            console.log("- Work time total:", workDuration);
            console.log("- Break time total:", breakDuration);
            console.log("- Total duration:", totalDuration);

            // Find the original story to update its duration
            const originalStory = findOriginalStory(
              block.title,
              stories,
              storyMapping,
            );
            if (!originalStory) {
              throw new SessionCreationError(
                "Story not found in original stories",
                "UNKNOWN_STORY",
                { block: block.title },
              );
            }

            // Update the story's estimated duration to match the actual work time
            // For break blocks, the workDuration might be 0, so use totalDuration instead
            originalStory.estimatedDuration = workDuration || totalDuration;

            // Validate total duration includes both work and breaks
            // Special handling for pure break blocks which might have 0 work duration
            const expectedTotal = workDuration + breakDuration;
            if (
              totalDuration !== expectedTotal &&
              !(workDuration === 0 && totalDuration === breakDuration)
            ) {
              throw new SessionCreationError(
                "Story block duration calculation error",
                "BLOCK_DURATION_ERROR",
                {
                  block: block.title,
                  totalDuration,
                  workDuration,
                  breakDuration,
                  expectedTotal: workDuration + breakDuration,
                },
              );
            }

            // Update the story block's totalDuration
            block.totalDuration = totalDuration;

            // Log the final durations for debugging
            console.log("Final block durations:");
            console.log("- Total (with breaks):", totalDuration);
            console.log("- Work time:", workDuration);
            console.log("- Break time:", breakDuration);

            // Add validation for maximum work time without substantial break
            let consecutiveWorkTime = 0;
            let lastBreakIndex = -1;

            for (let i = 0; i < block.timeBoxes.length; i++) {
              const currentBox = block.timeBoxes[i];

              if (currentBox.type === "work") {
                consecutiveWorkTime += currentBox.duration;

                // Allow a small buffer over the limit to prevent edge case errors
                const toleranceBuffer = DURATION_RULES.WORK_TIME_TOLERANCE;
                if (
                  consecutiveWorkTime >
                  DURATION_RULES.MAX_WORK_WITHOUT_BREAK + toleranceBuffer
                ) {
                  const breakTypes = block.timeBoxes
                    .slice(lastBreakIndex + 1, i)
                    .filter(
                      (box: TimeBox) =>
                        box.type === "short-break" || box.type === "long-break",
                    )
                    .map((box: TimeBox) => box.type);

                  throw new SessionCreationError(
                    "Too much work time without a substantial break",
                    "EXCESSIVE_WORK_TIME",
                    {
                      block: block.title,
                      timeBox: currentBox.startTime,
                      consecutiveWorkTime,
                      maxAllowed: DURATION_RULES.MAX_WORK_WITHOUT_BREAK,
                      breaksSince: breakTypes,
                    },
                  );
                }
              } else if (currentBox.type === "long-break") {
                consecutiveWorkTime = 0;
                lastBreakIndex = i;
              } else if (currentBox.type === "short-break") {
                // Increase the effect of short breaks based on the configuration
                consecutiveWorkTime = Math.max(
                  0,
                  consecutiveWorkTime -
                    DURATION_RULES.SHORT_BREAK_WORK_REDUCTION,
                );
                lastBreakIndex = i;
              }
            }
          }

          // Validate total session duration
          const calculatedDuration = parsedData.storyBlocks.reduce(
            (acc: number, block: StoryBlock) =>
              acc + (block.totalDuration || 0),
            0,
          );

          console.log("\nValidating total session duration:");
          console.log("- Calculated:", calculatedDuration);
          console.log("- Reported:", parsedData.summary.totalDuration);

          // Update the summary total duration to match calculated
          parsedData.summary.totalDuration = calculatedDuration;
        } catch (error) {
          if (error instanceof SessionCreationError) throw error;
          throw new SessionCreationError(
            "Duration validation failed",
            "VALIDATION_ERROR",
            error,
          );
        }

        // Extract all scheduled task titles for validation
        const allScheduledTasks: TimeBoxTask[] = parsedData.storyBlocks.flatMap(
          (block: StoryBlock) => {
            // Skip "Break" blocks entirely during task extraction
            if (
              block.title === "Break" ||
              block.title.toLowerCase().includes("break")
            ) {
              console.log(
                `Skipping Break block "${block.title}" during task validation`,
              );
              return [];
            }

            return block.timeBoxes
              .filter((box: TimeBox) => box.type === "work")
              .flatMap((box: TimeBox) => box.tasks || []);
          },
        );

        // Validate that all original tasks are included
        const validationResult = validateAllTasksIncluded(
          stories.flatMap((story: Story) => story.tasks),
          allScheduledTasks,
        );

        if (validationResult.isMissingTasks) {
          console.error(
            "Missing tasks in schedule:",
            validationResult.missingTasks,
          );

          // Add special handling for tasks with missing parts
          if (validationResult.partAnalysis?.hasMissingParts) {
            const partInfo = validationResult.partAnalysis.missingPartsList
              .map(
                (item) =>
                  `${item.baseTitle} (missing parts ${item.missingParts.join(", ")} of ${item.totalParts})`,
              )
              .join("; ");

            // Check if we should attempt to fix the task list
            if (shouldAttemptTaskReconciliation(validationResult)) {
              console.warn(
                "Attempting task reconciliation due to suspected truncation",
              );

              // Create a warning message for the user but allow the schedule to be created
              console.warn(
                `Note: Some parts of multi-part tasks are not explicitly scheduled: ${partInfo}`,
              );
              console.warn(
                "This often happens with very large tasks. Consider breaking tasks into smaller pieces before scheduling.",
              );

              // Add a suggestion to the response, but don't fail
              if (!parsedData.suggestions) {
                parsedData.suggestions = [];
              }

              parsedData.suggestions.push({
                type: "warning",
                message:
                  "Some parts of multi-part tasks could not be explicitly scheduled. Consider breaking large tasks into smaller pieces.",
                details: {
                  missingParts: validationResult.partAnalysis.missingPartsList,
                },
              });

              // We'll allow the schedule to be created rather than failing
              console.warn(
                "Proceeding with incomplete schedule after adding warnings",
              );
              return NextResponse.json(parsedData);
            }

            throw new SessionCreationError(
              "Incomplete multi-part tasks detected in schedule",
              "INCOMPLETE_PART_SEQUENCE",
              {
                ...validationResult,
                partInfo,
                suggestion:
                  "Try reducing the task complexity or splitting large tasks before scheduling",
              },
            );
          }

          throw new SessionCreationError(
            "Some tasks are missing from the schedule",
            "MISSING_TASKS",
            validationResult,
          );
        }

        return NextResponse.json(parsedData);
      } catch (error) {
        if (error instanceof SessionCreationError) throw error;

        throw new SessionCreationError(
          "Failed to process session plan",
          "PROCESSING_ERROR",
          error,
        );
      }
    } catch (error) {
      console.error("Session creation error:", error);

      if (error instanceof SessionCreationError) {
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
          error: "Failed to create session plan",
          code: "INTERNAL_ERROR",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Session creation error:", error);

    if (error instanceof SessionCreationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("overloaded")) {
      return NextResponse.json(
        {
          type: "error",
          error: {
            type: "overloaded_error",
            message: "Service is temporarily overloaded, please try again",
          },
        },
        { status: 529 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
