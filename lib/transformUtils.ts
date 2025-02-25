import { 
  Task, 
  ProcessedTask, 
  ProcessedStory, 
  TaskCategory 
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
export function transformTaskData(task: any): any {
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
export function transformStoryData(story: any): any {
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
export function isProcessedTask(obj: any): obj is ProcessedTask {
  return obj && 
    typeof obj === 'object' &&
    typeof obj.title === 'string' &&
    typeof obj.duration === 'number' &&
    typeof obj.isFrog === 'boolean' &&
    (
      typeof obj.taskCategory === 'string' || 
      typeof obj.type === 'string' // Allow legacy field
    );
}

/**
 * Type guard for checking if an object implements the ProcessedStory interface
 */
export function isProcessedStory(obj: any): obj is ProcessedStory {
  return obj && 
    typeof obj === 'object' &&
    typeof obj.title === 'string' &&
    typeof obj.summary === 'string' &&
    typeof obj.estimatedDuration === 'number' &&
    (
      typeof obj.type === 'string' || 
      typeof obj.storyType === 'string' // Allow legacy field
    ) &&
    Array.isArray(obj.tasks);
} 