import { 
  ProcessedTask, 
  ProcessedStory
} from './types';

/**
 * Transforms task data by ensuring consistent property names
 * 
 * Specifically:
 * - Renames 'type' to 'taskCategory' if needed
 * - Renames 'project' to 'projectType' if needed
 * 
 * @param task Any task object that may contain legacy property names
 * @returns A transformed task with consistent property names
 */
interface TaskDataInput {
  type?: string;
  taskCategory?: string;
  project?: string;
  projectType?: string;
  [key: string]: unknown;
}

interface TaskDataOutput extends Record<string, unknown> {
  taskCategory?: string;
  projectType?: string;
}

export function transformTaskData(task: TaskDataInput): TaskDataOutput {
  const transformedTask = { ...task };

  // Rename the type field to taskCategory if it exists
  if (transformedTask.type && !transformedTask.taskCategory) {
    transformedTask.taskCategory = transformedTask.type;
    delete transformedTask.type;
  }

  // Rename the project field to projectType if it exists
  if (transformedTask.project && !transformedTask.projectType) {
    transformedTask.projectType = transformedTask.project;
    delete transformedTask.project;
  }

  return transformedTask;
}

/**
 * Transforms story data by ensuring consistent property names
 * 
 * Specifically:
 * - Renames 'type' to 'storyType' if needed
 * - Renames 'project' to 'projectType' if needed
 * - Transforms all tasks within the story
 * 
 * @param story Any story object that may contain legacy property names
 * @returns A transformed story with consistent property names
 */
interface StoryDataInput {
  type?: string;
  storyType?: string;
  project?: string;
  projectType?: string;
  tasks?: TaskDataInput[];
  [key: string]: unknown;
}

interface StoryDataOutput extends Record<string, unknown> {
  storyType?: string;
  projectType?: string;
  tasks?: TaskDataOutput[];
}

export function transformStoryData(story: StoryDataInput): StoryDataOutput {
  const transformedStory = { ...story };

  // Rename the type property if needed
  if (transformedStory.type && !transformedStory.storyType) {
    transformedStory.storyType = transformedStory.type;
  }

  // Rename the project property if needed
  if (transformedStory.project && !transformedStory.projectType) {
    transformedStory.projectType = transformedStory.project;
    delete transformedStory.project;
  }

  // Transform all tasks in the story
  if (Array.isArray(transformedStory.tasks)) {
    transformedStory.tasks = transformedStory.tasks.map(transformTaskData);
  }

  return transformedStory;
}

/**
 * Helper function to normalize a task title for comparison purposes
 * Removes whitespace, makes lowercase, and strips common prefixes/suffixes
 */
export function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(task|todo|activity):\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/g, ''); // Remove trailing parentheticals like "(Part 1 of 2)"
}

/**
 * Determines if a task title appears to be part of a split task
 */
export function isSplitTaskPart(title: string): boolean {
  return /\b(part|section|segment)\s+\d+\s+of\s+\d+\b/i.test(title);
}

/**
 * Extracts the base task title without part information
 */
export function getBaseTaskTitle(title: string): string {
  // Extract base title by removing the part indicator
  return title.replace(/\s*\(?(part|section|segment)\s+\d+\s+of\s+\d+\)?.*$/i, '').trim();
}

/**
 * Extracts the base story title
 */
export function getBaseStoryTitle(title: string): string {
  // Check if the story title contains a part indicator
  if (isSplitTaskPart(title)) {
    return getBaseTaskTitle(title);
  }
  return title;
}

/**
 * Type guard for checking if an object implements the ProcessedTask interface
 */
export function isProcessedTask(obj: unknown): obj is ProcessedTask {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.duration === 'number' &&
    typeof o.isFrog === 'boolean' &&
    (
      typeof o.taskCategory === 'string' || 
      typeof o.type === 'string' // Allow legacy field
    )
  );
}

/**
 * Type guard for checking if an object implements the ProcessedStory interface
 */
export function isProcessedStory(obj: unknown): obj is ProcessedStory {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.summary === 'string' &&
    typeof o.estimatedDuration === 'number' &&
    (
      typeof o.type === 'string' || 
      typeof o.storyType === 'string' // Allow legacy field
    ) &&
    Array.isArray(o.tasks)
  );
} 