import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  // Sign out the user
  await supabase.auth.signOut();
  
  // Redirect to the login page
  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'));
}

// Also handle GET requests for users who navigate to /auth/logout directly
export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  // Sign out the user
  await supabase.auth.signOut();
  
  // Redirect to the login page
  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'));
} 