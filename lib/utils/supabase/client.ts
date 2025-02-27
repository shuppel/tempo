import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// These environment variables will be filled in from our .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log diagnostic information in development mode
if (process.env.NODE_ENV === 'development') {
  if (!supabaseUrl) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!supabaseAnonKey) {
    console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  console.log('Supabase URL length check:', supabaseUrl ? 'Set' : 'Not set');
  console.log('Supabase Anon Key length check:', supabaseAnonKey ? 'Set' : 'Not set');
}

// Safely create the Supabase client
let supabaseClient;
try {
  // Log more detailed information about the environment variables
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase client initialization:');
    console.log('- URL length:', supabaseUrl?.length || 0);
    console.log('- Anon key length:', supabaseAnonKey?.length || 0);
    console.log('- URL ends with:', supabaseUrl?.slice(-10) || 'N/A');
  }
  
  // Create a single supabase client for the entire app
  supabaseClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase client created successfully');
    // Test if the client works by making a simple auth check
    supabaseClient.auth.getSession()
      .then(() => console.log('Auth session check successful'))
      .catch(err => console.error('Auth session check failed:', err));
  }
} catch (error) {
  console.error('Error creating Supabase client:', error);
  console.error('Details:', error instanceof Error ? error.message : 'Unknown error');
  
  if (error instanceof Error && error.message.includes('fetch')) {
    console.error('Network error detected. Please check your connectivity.');
  }
  
  // Create a dummy client that will show appropriate errors rather than crash the app
  supabaseClient = {
    auth: {
      signUp: async () => ({ error: new Error('Failed to initialize Supabase client'), data: { user: null, session: null } }),
      signInWithPassword: async () => ({ error: new Error('Failed to initialize Supabase client'), data: { user: null, session: null } }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: new Error('Failed to initialize Supabase client'), data: {} }),
      getUser: async () => ({ error: null, data: { user: null } }),
      getSession: async () => ({ error: null, data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => ({ match: () => ({ data: null, error: new Error('Failed to initialize Supabase client') }) }),
      insert: () => ({ error: new Error('Failed to initialize Supabase client') }),
      update: () => ({ match: () => ({ error: new Error('Failed to initialize Supabase client') }) }),
      delete: () => ({ match: () => ({ error: new Error('Failed to initialize Supabase client') }) })
    })
  } as any;
}

// Export the client instance for direct use
export const supabase = supabaseClient;

// Export the createClient function to create new instances when needed
export const createClient = () => {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

// Direct fetch implementation for auth as a fallback
const directFetch = async (endpoint: string, options: RequestInit) => {
  try {
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Direct fetch error:', error);
    throw error;
  }
};

// Helper functions for auth operations
export const auth = {
  signUp: async (email: string, password: string, firstName?: string, lastName?: string) => {
    let retryCount = 0;
    const MAX_RETRIES = 2;

    const attemptSignUp = async () => {
      try {
        console.log(`Attempting signup for ${email} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
        const displayName = firstName && lastName ? `${firstName} ${lastName}` : '';
        
        // Add console.log to see if we get this far
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log('Auth key configured:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        
        return await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
            data: {
              first_name: firstName || '',
              last_name: lastName || '',
              display_name: displayName
            }
          }
        });
      } catch (error) {
        console.error('Error during sign up attempt:', error);
        
        // If we have retries left, try again
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Retrying signup, attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);
          
          // Wait for a short time before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return attemptSignUp();
        }
        
        // No more retries, throw the error
        return { 
          data: { user: null, session: null }, 
          error: error instanceof Error ? error : new Error('Failed to connect to authentication service')
        };
      }
    };
    
    return attemptSignUp();
  },
  
  signIn: async (email: string, password: string) => {
    try {
      return await supabase.auth.signInWithPassword({
        email,
        password,
      });
    } catch (error) {
      console.error('Error during sign in:', error);
      return { data: { user: null, session: null }, error: error as Error };
    }
  },
  
  signOut: async () => {
    try {
      return await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      return { error: error as Error };
    }
  },
  
  resetPassword: async (email: string) => {
    try {
      return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
      });
    } catch (error) {
      console.error('Error during password reset:', error);
      return { data: {}, error: error as Error };
    }
  },
  
  getCurrentUser: async () => {
    try {
      return await supabase.auth.getUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      return { data: { user: null }, error: error as Error };
    }
  },
  
  getSession: async () => {
    try {
      return await supabase.auth.getSession();
    } catch (error) {
      console.error('Error getting session:', error);
      return { data: { session: null }, error: error as Error };
    }
  }
};
