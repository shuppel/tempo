/**
 * DayLoadWorkManager Service
 * 
 * This service sits between task processing and session creation to manage
 * the distribution of tasks across multiple days based on user schedules.
 */

import type { ProcessedStory, ProcessedTask } from "@/lib/types"
import { 
  BRAIN_DUMP_DURATION_RULES,
  DAY_LOAD_WORK_MANAGER_RULES
} from "../rules/brain-dump-rules"
import { roundToNearestBlock } from "@/lib/durationUtils"

// Time window interface
interface TimeWindow {
  startTime: string;
  endTime: string;
  availableMinutes: number;
}

// Day schedule interface
interface DaySchedule {
  date: string;
  timeWindows: TimeWindow[];
  totalAvailableMinutes: number;
  assignedStories: ProcessedStory[];
  totalAssignedMinutes: number;
}

// Task overflow result
interface TaskOverflowResult {
  currentDayStories: ProcessedStory[];
  futureDayStories: Map<string, ProcessedStory[]>; // Key is date in YYYY-MM-DD format
  scheduleSummary: {
    totalTaskMinutes: number;
    totalScheduledMinutes: number;
    totalOverflowMinutes: number;
    daysRequired: number;
  };
}

/**
 * The DayLoadWorkManager is responsible for:
 * 1. Accepting user-defined schedules (start/end times)
 * 2. Analyzing task load against available time
 * 3. Distributing tasks across multiple days if needed
 * 4. Optimizing task placement based on priority and dependencies
 */
export class DayLoadWorkManager {
  private userStartTime?: string;
  private userEndTime?: string;
  private daySchedules: Map<string, DaySchedule> = new Map();

  constructor(
    startTime?: string, 
    endTime?: string
  ) {
    this.userStartTime = startTime;
    this.userEndTime = endTime;
  }

  /**
   * Sets or updates the user's preferred work schedule
   */
  setWorkSchedule(startTime: string, endTime: string): void {
    this.userStartTime = startTime;
    this.userEndTime = endTime;
  }

  /**
   * Calculate available minutes in a day between start and end time
   */
  private calculateAvailableMinutes(startTime: string, endTime: string): number {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    
    // If end is before start, assume it's the next day
    const diffMs = end >= start 
      ? end.getTime() - start.getTime() 
      : end.getTime() - start.getTime() + 24 * 60 * 60 * 1000;
      
    return Math.floor(diffMs / 60000);
  }

  /**
   * Initialize day schedules based on task load and user preferences
   */
  private initializeDaySchedules(stories: ProcessedStory[]): void {
    // Calculate total minutes needed for all stories
    const totalMinutes = stories.reduce((sum, story) => sum + story.estimatedDuration, 0);
    
    // Get start and end times (use defaults if not provided)
    const startTime = this.userStartTime || DAY_LOAD_WORK_MANAGER_RULES.TIME_WINDOWS.DEFAULT_START;
    const endTime = this.userEndTime || DAY_LOAD_WORK_MANAGER_RULES.TIME_WINDOWS.DEFAULT_END;
    
    // Calculate available minutes per day
    const availableMinutesPerDay = this.calculateAvailableMinutes(startTime, endTime);
    
    // Calculate how many days we need
    const daysNeeded = Math.ceil(totalMinutes / availableMinutesPerDay);
    
    // Initialize day schedules
    const today = new Date();
    this.daySchedules.clear();
    
    for (let i = 0; i < daysNeeded; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      this.daySchedules.set(dateStr, {
        date: dateStr,
        timeWindows: [{
          startTime,
          endTime,
          availableMinutes: availableMinutesPerDay
        }],
        totalAvailableMinutes: availableMinutesPerDay,
        assignedStories: [],
        totalAssignedMinutes: 0
      });
    }
  }

  /**
   * Handle task overflow by distributing stories across multiple days
   */
  handleTaskOverflow(stories: ProcessedStory[]): TaskOverflowResult {
    // Initialize day schedules
    this.initializeDaySchedules(stories);
    
    // First, calculate the total minutes
    const totalTaskMinutes = stories.reduce((sum, story) => sum + story.estimatedDuration, 0);
    
    // Make a copy of stories to work with
    const storiesCopy = JSON.parse(JSON.stringify(stories)) as ProcessedStory[];
    
    // Sort stories by priority (frogs first, then by duration)
    storiesCopy.sort((a, b) => {
      // Check if either story has frog tasks
      const aHasFrog = a.tasks.some(task => task.isFrog);
      const bHasFrog = b.tasks.some(task => task.isFrog);
      
      if (aHasFrog && !bHasFrog) return -1;
      if (!aHasFrog && bHasFrog) return 1;
      
      // If frog status is the same, sort by duration (shorter first)
      return a.estimatedDuration - b.estimatedDuration;
    });
    
    // Initialize result
    const result: TaskOverflowResult = {
      currentDayStories: [],
      futureDayStories: new Map(),
      scheduleSummary: {
        totalTaskMinutes,
        totalScheduledMinutes: 0,
        totalOverflowMinutes: 0,
        daysRequired: this.daySchedules.size
      }
    };
    
    // Distribute stories across days
    const dayScheduleEntries = Array.from(this.daySchedules.entries());
    let scheduledMinutes = 0;
    
    for (const [index, story] of storiesCopy.entries()) {
      // Find the first day with enough capacity
      let assigned = false;
      
      for (const [date, schedule] of dayScheduleEntries) {
        const remainingMinutes = schedule.totalAvailableMinutes - schedule.totalAssignedMinutes;
        
        if (remainingMinutes >= story.estimatedDuration) {
          // This day has enough capacity
          schedule.assignedStories.push(story);
          schedule.totalAssignedMinutes += story.estimatedDuration;
          scheduledMinutes += story.estimatedDuration;
          
          // Add to result
          if (date === dayScheduleEntries[0][0]) {
            // Current day
            result.currentDayStories.push(story);
          } else {
            // Future day
            if (!result.futureDayStories.has(date)) {
              result.futureDayStories.set(date, []);
            }
            result.futureDayStories.get(date)!.push(story);
          }
          
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        // Couldn't fit this story in any day
        // In a real implementation, we would create additional days
        console.warn(`Story "${story.title}" couldn't be assigned to any day`);
      }
    }
    
    // Update schedule summary
    result.scheduleSummary.totalScheduledMinutes = scheduledMinutes;
    result.scheduleSummary.totalOverflowMinutes = totalTaskMinutes - scheduledMinutes;
    
    return result;
  }
  
  /**
   * Get stories for today only (current implementation for backward compatibility)
   */
  getTodayStories(stories: ProcessedStory[]): ProcessedStory[] {
    return this.handleTaskOverflow(stories).currentDayStories;
  }
}

// Create a singleton instance
export const dayLoadWorkManager = new DayLoadWorkManager();

// Export service methods
export const dayLoadWorkService = {
  /**
   * Set the user's preferred work schedule
   */
  setWorkSchedule(startTime: string, endTime: string): void {
    dayLoadWorkManager.setWorkSchedule(startTime, endTime);
  },
  
  /**
   * Prioritize and distribute stories across days based on capacity
   */
  handleTaskOverflow(stories: ProcessedStory[]): TaskOverflowResult {
    return dayLoadWorkManager.handleTaskOverflow(stories);
  },
  
  /**
   * Get only the stories that fit in today's schedule
   * (for current implementation before UI is updated)
   */
  getTodayStories(stories: ProcessedStory[]): ProcessedStory[] {
    return dayLoadWorkManager.getTodayStories(stories);
  }
}; 