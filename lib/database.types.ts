export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          date: string
          title: string | null
          status: 'planned' | 'in-progress' | 'completed' | 'archived'
          total_duration: number
          start_time: string | null
          end_time: string | null
          last_updated: string
          timer_state: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          title?: string | null
          status: 'planned' | 'in-progress' | 'completed' | 'archived'
          total_duration: number
          start_time?: string | null
          end_time?: string | null
          last_updated?: string
          timer_state?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          title?: string | null
          status?: 'planned' | 'in-progress' | 'completed' | 'archived'
          total_duration?: number
          start_time?: string | null
          end_time?: string | null
          last_updated?: string
          timer_state?: Json | null
          created_at?: string
        }
      }
      stories: {
        Row: {
          id: string
          session_id: string
          title: string
          icon: string | null
          type: 'timeboxed' | 'flexible' | 'milestone'
          project_type: string | null
          category: string | null
          summary: string | null
          total_duration: number
          progress: number
          original_title: string | null
          parent_story_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          title: string
          icon?: string | null
          type: 'timeboxed' | 'flexible' | 'milestone'
          project_type?: string | null
          category?: string | null
          summary?: string | null
          total_duration: number
          progress?: number
          original_title?: string | null
          parent_story_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          title?: string
          icon?: string | null
          type?: 'timeboxed' | 'flexible' | 'milestone'
          project_type?: string | null
          category?: string | null
          summary?: string | null
          total_duration?: number
          progress?: number
          original_title?: string | null
          parent_story_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      time_boxes: {
        Row: {
          id: string
          story_id: string
          type: 'work' | 'short-break' | 'long-break' | 'debrief'
          duration: number
          estimated_start_time: string | null
          estimated_end_time: string | null
          status: 'todo' | 'completed' | 'in-progress' | 'mitigated' | null
          box_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          story_id: string
          type: 'work' | 'short-break' | 'long-break' | 'debrief'
          duration: number
          estimated_start_time?: string | null
          estimated_end_time?: string | null
          status?: 'todo' | 'completed' | 'in-progress' | 'mitigated' | null
          box_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          type?: 'work' | 'short-break' | 'long-break' | 'debrief'
          duration?: number
          estimated_start_time?: string | null
          estimated_end_time?: string | null
          status?: 'todo' | 'completed' | 'in-progress' | 'mitigated' | null
          box_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          time_box_id: string
          title: string
          description: string | null
          duration: number
          task_category: 'focus' | 'learning' | 'review' | 'break' | 'research'
          is_frog: boolean
          project_type: string | null
          status: 'todo' | 'completed' | 'in-progress' | 'mitigated' | 'pending' | null
          difficulty: 'low' | 'medium' | 'high' | null
          is_flexible: boolean
          needs_splitting: boolean
          original_title: string | null
          refined: boolean
          task_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          time_box_id: string
          title: string
          description?: string | null
          duration: number
          task_category: 'focus' | 'learning' | 'review' | 'break' | 'research'
          is_frog?: boolean
          project_type?: string | null
          status?: 'todo' | 'completed' | 'in-progress' | 'mitigated' | 'pending' | null
          difficulty?: 'low' | 'medium' | 'high' | null
          is_flexible?: boolean
          needs_splitting?: boolean
          original_title?: string | null
          refined?: boolean
          task_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          time_box_id?: string
          title?: string
          description?: string | null
          duration?: number
          task_category?: 'focus' | 'learning' | 'review' | 'break' | 'research'
          is_frog?: boolean
          project_type?: string | null
          status?: 'todo' | 'completed' | 'in-progress' | 'mitigated' | 'pending' | null
          difficulty?: 'low' | 'medium' | 'high' | null
          is_flexible?: boolean
          needs_splitting?: boolean
          original_title?: string | null
          refined?: boolean
          task_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      split_infos: {
        Row: {
          id: string
          task_id: string
          is_parent: boolean
          part_number: number | null
          total_parts: number | null
          original_duration: number | null
          parent_task_id: string | null
          original_title: string | null
          story_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          is_parent: boolean
          part_number?: number | null
          total_parts?: number | null
          original_duration?: number | null
          parent_task_id?: string | null
          original_title?: string | null
          story_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          is_parent?: boolean
          part_number?: number | null
          total_parts?: number | null
          original_duration?: number | null
          parent_task_id?: string | null
          original_title?: string | null
          story_id?: string | null
          created_at?: string
        }
      }
      task_breaks: {
        Row: {
          id: string
          task_id: string
          after_duration: number
          duration: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          after_duration: number
          duration: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          after_duration?: number
          duration?: number
          reason?: string | null
          created_at?: string
        }
      }
      task_groups: {
        Row: {
          id: string
          session_id: string
          total_difficulty: number | null
          completed: boolean
          estimated_duration: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          total_difficulty?: number | null
          completed?: boolean
          estimated_duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          total_difficulty?: number | null
          completed?: boolean
          estimated_duration?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      task_group_tasks: {
        Row: {
          task_group_id: string
          task_id: string
        }
        Insert: {
          task_group_id: string
          task_id: string
        }
        Update: {
          task_group_id?: string
          task_id?: string
        }
      }
      incomplete_tasks: {
        Row: {
          id: string
          session_id: string
          title: string
          story_title: string
          duration: number
          task_category: string | null
          mitigated: boolean
          rolled_over: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          title: string
          story_title: string
          duration: number
          task_category?: string | null
          mitigated?: boolean
          rolled_over?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          title?: string
          story_title?: string
          duration?: number
          task_category?: string | null
          mitigated?: boolean
          rolled_over?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 