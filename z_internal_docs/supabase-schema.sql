-- Supabase Schema for Toro Task Pomodoro App

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (extending Supabase auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a trigger to automatically insert a user record when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'display_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Sessions Table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in-progress', 'completed', 'archived')),
  total_duration INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timer_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint
  UNIQUE(user_id, date)
);

-- Stories Table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT,
  type TEXT NOT NULL CHECK (type IN ('timeboxed', 'flexible', 'milestone')),
  project_type TEXT,
  category TEXT,
  summary TEXT,
  total_duration INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  original_title TEXT,
  parent_story_id UUID REFERENCES stories(id) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time Boxes Table
CREATE TABLE time_boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('work', 'short-break', 'long-break', 'debrief')),
  duration INTEGER NOT NULL,
  estimated_start_time TIMESTAMP WITH TIME ZONE,
  estimated_end_time TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('todo', 'completed', 'in-progress', 'mitigated')),
  box_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_box_id UUID REFERENCES time_boxes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  task_category TEXT NOT NULL CHECK (task_category IN ('focus', 'learning', 'review', 'break', 'research')),
  is_frog BOOLEAN DEFAULT FALSE,
  project_type TEXT,
  status TEXT CHECK (status IN ('todo', 'completed', 'in-progress', 'mitigated', 'pending')),
  difficulty TEXT CHECK (difficulty IN ('low', 'medium', 'high')),
  is_flexible BOOLEAN DEFAULT FALSE,
  needs_splitting BOOLEAN DEFAULT FALSE,
  original_title TEXT,
  refined BOOLEAN DEFAULT FALSE,
  task_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Split Info Table
CREATE TABLE split_infos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  is_parent BOOLEAN NOT NULL,
  part_number INTEGER,
  total_parts INTEGER,
  original_duration INTEGER,
  parent_task_id UUID REFERENCES tasks(id),
  original_title TEXT,
  story_id UUID REFERENCES stories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Breaks Table
CREATE TABLE task_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  after_duration INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Groups Table
CREATE TABLE task_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  total_difficulty INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  estimated_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Group Tasks Junction Table
CREATE TABLE task_group_tasks (
  task_group_id UUID REFERENCES task_groups(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_group_id, task_id)
);

-- Incomplete Tasks Table (for archived sessions)
CREATE TABLE incomplete_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story_title TEXT NOT NULL,
  duration INTEGER NOT NULL,
  task_category TEXT,
  mitigated BOOLEAN DEFAULT FALSE,
  rolled_over BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Row Level Security (RLS) policies
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_infos ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomplete_tasks ENABLE ROW LEVEL SECURITY;

-- Users RLS policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Sessions RLS policies
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Stories RLS policies
CREATE POLICY "Users can view own stories" ON stories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions WHERE sessions.id = stories.session_id AND sessions.user_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can insert own stories" ON stories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions WHERE sessions.id = stories.session_id AND sessions.user_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can update own stories" ON stories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions WHERE sessions.id = stories.session_id AND sessions.user_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can delete own stories" ON stories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sessions WHERE sessions.id = stories.session_id AND sessions.user_id = auth.uid()
    )
  );

-- Time boxes RLS policies (following same pattern for the remaining tables)
CREATE POLICY "Users can view own time boxes" ON time_boxes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stories 
      JOIN sessions ON stories.session_id = sessions.id
      WHERE time_boxes.story_id = stories.id AND sessions.user_id = auth.uid()
    )
  );
  
-- Apply similar policies for remaining tables (tasks, split_infos, task_breaks, etc.)
-- The pattern is similar, building the relationship chain back to the user

-- Create indexes for better query performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_stories_session_id ON stories(session_id);
CREATE INDEX idx_time_boxes_story_id ON time_boxes(story_id);
CREATE INDEX idx_tasks_time_box_id ON tasks(time_box_id);
CREATE INDEX idx_split_infos_task_id ON split_infos(task_id);
CREATE INDEX idx_task_breaks_task_id ON task_breaks(task_id);
CREATE INDEX idx_task_groups_session_id ON task_groups(session_id);
CREATE INDEX idx_incomplete_tasks_session_id ON incomplete_tasks(session_id); 