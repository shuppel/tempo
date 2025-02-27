// This file is currently redundant with lib/utils/supabase/server.ts
// We're commenting it out to reduce duplication in our codebase

/*
import { createClient } from '@/lib/utils/supabase/server';
import { Database } from '@/lib/database.types';

// Server-side-only function to get Supabase client
export const getServerSupabaseClient = () => {
  try {
    return createClient();
  } catch (error) {
    console.error('Error creating server Supabase client:', error);
    throw error;
  }
};
*/

// Instead, import directly from server.ts:
// import { createClient as getServerSupabaseClient } from '@/lib/utils/supabase/server';

// Instead, import directly from server.ts:
// import { createClient as getServerSupabaseClient } from '@/lib/utils/supabase/server'; 