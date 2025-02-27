import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  
  try {
    const supabase = createMiddlewareClient<Database>({ req: request, res });
    
    // Refresh session if expired
    await supabase.auth.getSession();
    
    // Get current session and check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Define protected routes that require authentication
    const isProtectedRoute = 
      request.nextUrl.pathname.startsWith('/sessions') ||
      request.nextUrl.pathname.startsWith('/session') ||
      request.nextUrl.pathname.startsWith('/migrate');
                          
    // Redirect to login if accessing protected route without authentication
    if (!session && isProtectedRoute) {
      const redirectUrl = new URL('/auth/login', request.url);
      // Add original URL as return_to query param for redirect after login
      redirectUrl.searchParams.set('return_to', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Redirect already logged in users away from auth pages
    const isAuthRoute = 
      request.nextUrl.pathname.startsWith('/auth/login') || 
      request.nextUrl.pathname.startsWith('/auth/signup');
      
    if (session && isAuthRoute) {
      return NextResponse.redirect(new URL('/sessions', request.url));
    }
  } catch (error) {
    // Log the error but don't fail (handle gracefully)
    console.error('Middleware authentication error:', error);
    
    // If there's an error in protected routes, redirect to a generic error page
    // but still allow access to public routes
    const isProtectedRoute = 
      request.nextUrl.pathname.startsWith('/sessions') ||
      request.nextUrl.pathname.startsWith('/session') ||
      request.nextUrl.pathname.startsWith('/migrate');
      
    if (isProtectedRoute) {
      // If network connectivity causes the error, handle differently
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const errorUrl = new URL('/network-error', request.url);
        return NextResponse.redirect(errorUrl);
      }
      
      // Otherwise, redirect to login with an error message
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('error', 'auth_error');
      redirectUrl.searchParams.set('return_to', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - public (public resources)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|public).*)',
  ],
}; 