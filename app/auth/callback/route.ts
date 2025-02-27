import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/server';
// We've commented out server-supabase.ts as it was redundant
// import { getServerSupabaseClient } from '@/lib/server-supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    try {
      const supabase = createClient();
      
      // Exchange code for session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback error:', error);
        // Redirect to login with error
        return NextResponse.redirect(
          new URL(`/auth/login?error=callback_error&message=${encodeURIComponent(error.message)}`, request.url)
        );
      }
      
      // Successful authentication
      return NextResponse.redirect(new URL('/sessions', request.url));
    } catch (error) {
      console.error('Auth callback exception:', error);
      
      // Check for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return NextResponse.redirect(new URL('/network-error', request.url));
      }
      
      // General error redirect
      return NextResponse.redirect(
        new URL('/auth/login?error=callback_error', request.url)
      );
    }
  }

  // No code found, redirect to home
  return NextResponse.redirect(new URL('/', request.url));
} 