// This file re-exports Supabase utilities from their respective modules
// for easier imports throughout the application

// Client-side utilities
export { 
  supabase, 
  createClient as getSupabaseClient,
  auth
} from './utils/supabase/client';

// Re-export types that might be needed
export type { 
  SupabaseClient,
  User, 
  Session 
} from '@supabase/supabase-js'; 