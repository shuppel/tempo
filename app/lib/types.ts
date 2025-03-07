export type BaseStatus = 'todo' | 'completed' | 'in-progress' | 'mitigated';
export type TimeBoxStatus = BaseStatus;
export type TodoWorkPlanStatus = 'planned' | 'in-progress' | 'completed' | 'archived';
export type TimeBoxType = 'work' | 'short-break' | 'long-break' | 'debrief';
export type StoryType = 'timeboxed' | 'flexible' | 'milestone';

export interface TimeBoxTask {
  title: string;
  status?: BaseStatus;
  description?: string;
  duration: number;
  taskCategory?: string;
  projectType?: string;
  isFlexible?: boolean;
}

export interface TimeBox {
  type: TimeBoxType;
  duration: number;
  status?: TimeBoxStatus;
  tasks?: TimeBoxTask[];
  description?: string;
  estimatedStartTime?: string;
  estimatedEndTime?: string;
  icon?: string;
}

export interface StoryBlock {
  id: string;
  title: string;
  timeBoxes: TimeBox[];
  progress: number;
  totalDuration: number;
  taskIds: string[];
  icon?: string;
  type?: StoryType;
  originalTitle?: string;
  parentStoryId?: string;
}

export interface TimerState {
  activeTimeBox: { storyId: string; timeBoxIndex: number } | null;
  timeRemaining: number | null;
  isTimerRunning: boolean;
}

export interface TodoWorkPlan {
  id: string;
  status: TodoWorkPlanStatus;
  startTime: string;
  endTime: string;
  storyBlocks: StoryBlock[];
  totalDuration: number;
  lastUpdated: string;
  activeTimeBox: { storyId: string; timeBoxIndex: number } | null;
  timeRemaining: number | null;
  isTimerRunning: boolean;
  incompleteTasks?: {
    count: number;
    tasks: Array<{
      title: string;
      storyTitle: string;
      duration: number;
      taskCategory?: string;
      mitigated: boolean;
      rolledOver: boolean;
    }>;
  };
} 