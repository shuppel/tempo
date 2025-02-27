import { supabase } from './client';
import type { 
  Session, 
  StoryBlock, 
  TimeBox, 
  SessionStatus,
  TimeBoxStatus, 
  BaseStatus,
  Task
} from '../../types';
import { Database } from '../../database.types';

type SupabaseSession = Database['public']['Tables']['sessions']['Row'];
type SupabaseStory = Database['public']['Tables']['stories']['Row'];
type SupabaseTimeBox = Database['public']['Tables']['time_boxes']['Row'];
type SupabaseTask = Database['public']['Tables']['tasks']['Row'];

// Utility functions for data conversion
const convertToSupabaseSession = (date: string, session: Session): Omit<SupabaseSession, 'id' | 'created_at'> => {
  return {
    user_id: '', // This will be populated with the actual user ID from auth
    date,
    title: null,
    status: session.status,
    total_duration: session.totalDuration,
    start_time: session.storyBlocks.length > 0 ? new Date().toISOString() : null,
    end_time: null,
    last_updated: new Date().toISOString(),
    timer_state: null // Will be populated later if needed
  };
};

const convertFromSupabaseSession = async (supaSession: SupabaseSession): Promise<Session> => {
  // Fetch related story blocks
  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('session_id', supaSession.id);
  
  const storyBlocks: StoryBlock[] = await Promise.all((stories || []).map(async (story: SupabaseStory) => {
    // Fetch time boxes for this story
    const { data: timeBoxes } = await supabase
      .from('time_boxes')
      .select('*')
      .eq('story_id', story.id)
      .order('box_order', { ascending: true });
    
    // Convert time boxes and fetch associated tasks
    const convertedTimeBoxes: TimeBox[] = await Promise.all((timeBoxes || []).map(async (timeBox: SupabaseTimeBox) => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('time_box_id', timeBox.id)
        .order('task_order', { ascending: true });
      
      return {
        type: timeBox.type,
        duration: timeBox.duration,
        tasks: (tasks || []).map((task: SupabaseTask) => ({
          title: task.title,
          duration: task.duration,
          isFrog: task.is_frog,
          taskCategory: task.task_category !== 'break' ? task.task_category : undefined,
          projectType: task.project_type || undefined,
          isFlexible: task.is_flexible,
          status: task.status || undefined,
        })),
        estimatedStartTime: timeBox.estimated_start_time || undefined,
        estimatedEndTime: timeBox.estimated_end_time || undefined,
        icon: undefined,
        status: timeBox.status || undefined,
      };
    }));
    
    // Fetch task IDs for this story block
    const { data: storyTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('time_box_id', timeBoxes?.map((tb: SupabaseTimeBox) => tb.id) || []);
    
    return {
      id: story.id,
      title: story.title,
      timeBoxes: convertedTimeBoxes,
      totalDuration: story.total_duration,
      progress: story.progress,
      icon: story.icon || undefined,
      type: story.type,
      originalTitle: story.original_title || undefined,
      parentStoryId: story.parent_story_id || undefined,
      taskIds: (storyTasks || []).map((t: { id: string }) => t.id),
    };
  }));
  
  // Fetch incomplete tasks if this is an archived session
  let incompleteTasks = undefined;
  
  if (supaSession.status === 'archived') {
    const { data: incompleteTasksData } = await supabase
      .from('incomplete_tasks')
      .select('*')
      .eq('session_id', supaSession.id);
    
    if (incompleteTasksData && incompleteTasksData.length > 0) {
      incompleteTasks = {
        count: incompleteTasksData.length,
        tasks: incompleteTasksData.map((t: Database['public']['Tables']['incomplete_tasks']['Row']) => ({
          title: t.title,
          storyTitle: t.story_title,
          duration: t.duration,
          taskCategory: t.task_category || undefined,
          mitigated: t.mitigated,
          rolledOver: t.rolled_over,
        })),
      };
    }
  }
  
  return {
    date: supaSession.date,
    storyBlocks,
    status: supaSession.status,
    totalDuration: supaSession.total_duration,
    lastUpdated: supaSession.last_updated,
    incompleteTasks,
  };
};

export const supabaseStorage = {
  /**
   * Save a session to Supabase
   */
  async saveSession(date: string, session: Session): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }
      
      const userId = userData.user.id;
      
      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .single();
      
      if (existingSession) {
        // Update existing session
        await supabase
          .from('sessions')
          .update({
            status: session.status,
            total_duration: session.totalDuration,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existingSession.id);
        
        // Update or create story blocks
        await this.updateStoryBlocks(existingSession.id, session.storyBlocks);
      } else {
        // Create new session
        const newSession = convertToSupabaseSession(date, session);
        
        const { data: insertedSession, error } = await supabase
          .from('sessions')
          .insert({
            ...newSession,
            user_id: userId,
          })
          .select()
          .single();
        
        if (error || !insertedSession) {
          throw new Error(`Failed to insert session: ${error?.message}`);
        }
        
        // Create story blocks for the new session
        await this.updateStoryBlocks(insertedSession.id, session.storyBlocks);
      }
    } catch (error) {
      console.error('Failed to save session to Supabase:', error);
      throw error;
    }
  },

  /**
   * Update story blocks for a session
   */
  async updateStoryBlocks(sessionId: string, storyBlocks: StoryBlock[]): Promise<void> {
    try {
      // Get existing stories for this session
      const { data: existingStories } = await supabase
        .from('stories')
        .select('id, title')
        .eq('session_id', sessionId);
      
      const existingStoryMap = new Map<string, string>();
      (existingStories || []).forEach((story: { id: string, title: string }) => {
        existingStoryMap.set(story.title, story.id);
      });
      
      // Process each story block
      for (const storyBlock of storyBlocks) {
        let storyId: string;
        
        if (existingStoryMap.has(storyBlock.title)) {
          // Update existing story
          storyId = existingStoryMap.get(storyBlock.title)!;
          
          await supabase
            .from('stories')
            .update({
              total_duration: storyBlock.totalDuration,
              progress: storyBlock.progress,
              updated_at: new Date().toISOString(),
            })
            .eq('id', storyId);
        } else {
          // Create new story
          const { data: newStory, error } = await supabase
            .from('stories')
            .insert({
              session_id: sessionId,
              title: storyBlock.title,
              icon: storyBlock.icon || null,
              type: storyBlock.type || 'timeboxed',
              project_type: null,
              category: null,
              summary: null,
              total_duration: storyBlock.totalDuration,
              progress: storyBlock.progress,
              original_title: storyBlock.originalTitle || null,
              parent_story_id: storyBlock.parentStoryId || null,
            })
            .select()
            .single();
          
          if (error || !newStory) {
            throw new Error(`Failed to insert story: ${error?.message}`);
          }
          
          storyId = newStory.id;
        }
        
        // Update time boxes for this story
        await this.updateTimeBoxes(storyId, storyBlock.timeBoxes);
      }
    } catch (error) {
      console.error('Failed to update story blocks:', error);
      throw error;
    }
  },

  /**
   * Update time boxes for a story
   */
  async updateTimeBoxes(storyId: string, timeBoxes: TimeBox[]): Promise<void> {
    try {
      // Get existing time boxes for this story
      const { data: existingTimeBoxes } = await supabase
        .from('time_boxes')
        .select('*')
        .eq('story_id', storyId)
        .order('box_order', { ascending: true });
      
      // Delete all existing time boxes and create new ones
      if (existingTimeBoxes && existingTimeBoxes.length > 0) {
        const timeBoxIds = existingTimeBoxes.map((tb: SupabaseTimeBox) => tb.id);
        
        // Delete associated tasks first
        await supabase
          .from('tasks')
          .delete()
          .in('time_box_id', timeBoxIds);
          
        // Delete time boxes
        await supabase
          .from('time_boxes')
          .delete()
          .in('id', timeBoxIds);
      }
      
      // Create new time boxes
      for (let i = 0; i < timeBoxes.length; i++) {
        const timeBox = timeBoxes[i];
        
        const { data: newTimeBox, error } = await supabase
          .from('time_boxes')
          .insert({
            story_id: storyId,
            type: timeBox.type,
            duration: timeBox.duration,
            estimated_start_time: timeBox.estimatedStartTime || null,
            estimated_end_time: timeBox.estimatedEndTime || null,
            status: timeBox.status || null,
            box_order: i,
          })
          .select()
          .single();
        
        if (error || !newTimeBox) {
          throw new Error(`Failed to insert time box: ${error?.message}`);
        }
        
        // Create tasks for this time box
        if (timeBox.tasks && timeBox.tasks.length > 0) {
          await this.createTasks(newTimeBox.id, timeBox.tasks);
        }
      }
    } catch (error) {
      console.error('Failed to update time boxes:', error);
      throw error;
    }
  },

  /**
   * Create tasks for a time box
   */
  async createTasks(timeBoxId: string, tasks: TimeBox['tasks']): Promise<void> {
    try {
      if (!tasks) return;
      
      // Create tasks
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        await supabase
          .from('tasks')
          .insert({
            time_box_id: timeBoxId,
            title: task.title,
            description: null,
            duration: task.duration,
            task_category: task.taskCategory || 'focus',
            is_frog: task.isFrog || false,
            project_type: task.projectType || null,
            status: task.status || null,
            difficulty: null, // Not provided in TimeBoxTask
            is_flexible: task.isFlexible || false,
            needs_splitting: false,
            original_title: null,
            refined: true, // Assuming tasks in time boxes are already refined
            task_order: i,
          });
      }
    } catch (error) {
      console.error('Failed to create tasks:', error);
      throw error;
    }
  },

  /**
   * Get a specific session from Supabase
   */
  async getSession(date: string): Promise<Session | null> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return null;
      }
      
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session) return null;
      
      return await convertFromSupabaseSession(session);
    } catch (error) {
      console.error('Failed to get session from Supabase:', error);
      return null;
    }
  },

  /**
   * Get all sessions from Supabase
   */
  async getAllSessions(): Promise<Record<string, Session>> {
    const sessions: Record<string, Session> = {};
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return sessions;
      }
      
      const { data: supabaseSessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('date', { ascending: false });
      
      if (!supabaseSessions || supabaseSessions.length === 0) {
        return sessions;
      }
      
      for (const supaSession of supabaseSessions) {
        sessions[supaSession.date] = await convertFromSupabaseSession(supaSession);
      }
    } catch (error) {
      console.error('Failed to get all sessions from Supabase:', error);
    }
    
    return sessions;
  },

  /**
   * Delete a session from Supabase
   */
  async deleteSession(date: string): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }
      
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session) return;
      
      // Deleting the session will cascade delete related records due to our DB schema
      await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);
    } catch (error) {
      console.error('Failed to delete session from Supabase:', error);
      throw error;
    }
  },

  /**
   * Update time box status in Supabase
   */
  async updateTimeBoxStatus(date: string, storyId: string, timeBoxIndex: number, status: BaseStatus): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }
      
      // Get the session
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session) return false;
      
      // Get the story
      const { data: story } = await supabase
        .from('stories')
        .select('id')
        .eq('session_id', session.id)
        .eq('id', storyId)
        .single();
      
      if (!story) return false;
      
      // Get the time box
      const { data: timeBoxes } = await supabase
        .from('time_boxes')
        .select('*')
        .eq('story_id', story.id)
        .order('box_order', { ascending: true });
      
      if (!timeBoxes || timeBoxIndex >= timeBoxes.length) return false;
      
      // Update the time box status
      await supabase
        .from('time_boxes')
        .update({ status })
        .eq('id', timeBoxes[timeBoxIndex].id);
      
      // Update session's last_updated
      await supabase
        .from('sessions')
        .update({ last_updated: new Date().toISOString() })
        .eq('id', session.id);
      
      return true;
    } catch (error) {
      console.error('Failed to update time box status in Supabase:', error);
      return false;
    }
  },

  /**
   * Update task status in Supabase
   */
  async updateTaskStatus(date: string, storyId: string, timeBoxIndex: number, taskIndex: number, status: BaseStatus): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }
      
      // Get the session
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session) return false;
      
      // Get the story
      const { data: story } = await supabase
        .from('stories')
        .select('id')
        .eq('session_id', session.id)
        .eq('id', storyId)
        .single();
      
      if (!story) return false;
      
      // Get the time box
      const { data: timeBoxes } = await supabase
        .from('time_boxes')
        .select('id')
        .eq('story_id', story.id)
        .order('box_order', { ascending: true });
      
      if (!timeBoxes || timeBoxIndex >= timeBoxes.length) return false;
      
      // Get the task
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('time_box_id', timeBoxes[timeBoxIndex].id)
        .order('task_order', { ascending: true });
      
      if (!tasks || taskIndex >= tasks.length) return false;
      
      // Update the task status
      await supabase
        .from('tasks')
        .update({ status })
        .eq('id', tasks[taskIndex].id);
      
      // Update session's last_updated
      await supabase
        .from('sessions')
        .update({ last_updated: new Date().toISOString() })
        .eq('id', session.id);
      
      return true;
    } catch (error) {
      console.error('Failed to update task status in Supabase:', error);
      return false;
    }
  },

  /**
   * Save timer state to Supabase
   */
  async saveTimerState(
    date: string, 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  ): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }
      
      // Get the session
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session) return false;
      
      // Update the session with timer state
      await supabase
        .from('sessions')
        .update({
          timer_state: {
            activeTimeBox,
            timeRemaining,
            isTimerRunning
          },
          last_updated: new Date().toISOString()
        })
        .eq('id', session.id);
      
      return true;
    } catch (error) {
      console.error('Failed to save timer state to Supabase:', error);
      return false;
    }
  },

  /**
   * Get timer state from Supabase
   */
  async getTimerState(date: string): Promise<{ 
    activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
    timeRemaining: number | null,
    isTimerRunning: boolean
  } | null> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return null;
      }
      
      // Get the session
      const { data: session } = await supabase
        .from('sessions')
        .select('timer_state')
        .eq('user_id', userData.user.id)
        .eq('date', date)
        .single();
      
      if (!session || !session.timer_state) return null;
      
      return session.timer_state as {
        activeTimeBox: { storyId: string; timeBoxIndex: number } | null,
        timeRemaining: number | null,
        isTimerRunning: boolean
      };
    } catch (error) {
      console.error('Failed to get timer state from Supabase:', error);
      return null;
    }
  }
}; 