// THIS FILE IS DEPRECATED
// All functionality has been moved to lib/utils/supabase/client.ts
// Import from there instead:
// import { supabase, createClient, auth } from '@/lib/utils/supabase/client';

/*
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

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
  // Create a single supabase client for the entire app
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase client created successfully');
  }
} catch (error) {
  console.error('Error creating Supabase client:', error);
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

export const supabase = supabaseClient;

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
    try {
      const displayName = firstName && lastName ? `${firstName} ${lastName}` : '';
      
      // Log information to help debug (will only appear in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Attempting to sign up with Supabase:', { 
          supabaseUrl, 
          email,
          hasPassword: !!password,
          firstName,
          lastName
        });
      }
      
      // Check if Supabase URL and key are valid
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase credentials are missing');
      }
      
      let response;
      
      try {
        // First try with the Supabase client
        response = await supabase.auth.signUp({
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
      } catch (clientError) {
        console.log('Supabase client sign up failed, trying direct fetch:', clientError);
        
        // If the client method fails, try a direct fetch as fallback
        try {
          const directResponse = await directFetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'X-Client-Info': 'supabase-js/2.x'
            },
            body: JSON.stringify({
              email,
              password,
              options: {
                data: {
                  first_name: firstName || '',
                  last_name: lastName || '',
                  display_name: displayName
                },
                email_redirect_to: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
              }
            })
          });
          
          response = {
            data: directResponse,
            error: null
          };
        } catch (fetchError) {
          console.error('Direct fetch for sign up also failed:', fetchError);
          throw fetchError;
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error during sign up:', error);
      return { 
        data: { user: null, session: null }, 
        error: error instanceof Error 
          ? error 
          : new Error('Failed to connect to authentication service. Please check your network connection.')
      };
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      let response;
      
      try {
        // First try with the Supabase client
        response = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      } catch (clientError) {
        console.log('Supabase client sign in failed, trying direct fetch:', clientError);
        
        // If the client method fails, try a direct fetch as fallback
        try {
          const directResponse = await directFetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'X-Client-Info': 'supabase-js/2.x'
            },
            body: JSON.stringify({
              email,
              password
            })
          });
          
          response = {
            data: {
              user: directResponse.user,
              session: directResponse.session
            },
            error: null
          };
        } catch (fetchError) {
          console.error('Direct fetch for sign in also failed:', fetchError);
          throw fetchError;
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error during sign in:', error);
      return { 
        data: { user: null, session: null }, 
        error: error instanceof Error 
          ? error 
          : new Error('Failed to connect to authentication service. Please check your network connection.')
      };
    }
  },
  
  signOut: async () => {
    try {
      return await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      return { error: error instanceof Error ? error : new Error('Failed to sign out') };
    }
  },
  
  resetPassword: async (email: string) => {
    try {
      let response;
      
      try {
        // First try with the Supabase client
        response = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
        });
      } catch (clientError) {
        console.log('Supabase client password reset failed, trying direct fetch:', clientError);
        
        // If the client method fails, try a direct fetch as fallback
        try {
          await directFetch(`${supabaseUrl}/auth/v1/recover`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'X-Client-Info': 'supabase-js/2.x'
            },
            body: JSON.stringify({
              email,
              redirect_to: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`
            })
          });
          
          response = { data: {}, error: null };
        } catch (fetchError) {
          console.error('Direct fetch for password reset also failed:', fetchError);
          throw fetchError;
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error during password reset:', error);
      return { 
        data: {}, 
        error: error instanceof Error ? error : new Error('Failed to send password reset email') 
      };
    }
  },
  
  getCurrentUser: async () => {
    try {
      return await supabase.auth.getUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      return { 
        data: { user: null }, 
        error: error instanceof Error ? error : new Error('Failed to get current user') 
      };
    }
  },
  
  getSession: async () => {
    try {
      return await supabase.auth.getSession();
    } catch (error) {
      console.error('Error getting session:', error);
      return { 
        data: { session: null }, 
        error: error instanceof Error ? error : new Error('Failed to get session') 
      };
    }
  }
};
*/ 