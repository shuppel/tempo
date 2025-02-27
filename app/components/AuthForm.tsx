"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import { auth, getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Loader2, WifiOff, RefreshCw, Bug } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Define validation schemas
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(1, 'This field is required');

// Maximum number of retry attempts
const MAX_RETRIES = 3;

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string; 
    password?: string;
    firstName?: string;
    lastName?: string;
  }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('signin');
  const retryCount = useRef(0);
  const [testingConnection, setTestingConnection] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/sessions';
  const errorParam = searchParams.get('error');

  // Check for error parameters in URL
  useEffect(() => {
    if (errorParam === 'auth_error') {
      setError('Authentication failed. Please sign in again.');
    }
  }, [errorParam]);

  // Reset errors when changing tabs
  useEffect(() => {
    setError(null);
    setIsNetworkError(false);
    setValidationErrors({});
    setMessage(null);
    retryCount.current = 0;
  }, [activeTab]);

  // Validate form input
  const validateForm = (isSignUp: boolean = false): boolean => {
    const errors: {
      email?: string; 
      password?: string;
      firstName?: string;
      lastName?: string;
    } = {};
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        errors.email = err.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        errors.password = err.errors[0].message;
      }
    }
    
    // Only validate name fields for sign up
    if (isSignUp) {
      try {
        nameSchema.parse(firstName);
      } catch (err) {
        if (err instanceof z.ZodError) {
          errors.firstName = err.errors[0].message;
        }
      }
      
      try {
        nameSchema.parse(lastName);
      } catch (err) {
        if (err instanceof z.ZodError) {
          errors.lastName = err.errors[0].message;
        }
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setIsLoading(true);
    setError(null);
    setIsNetworkError(false);
    
    try {
      const { error } = await auth.signIn(email, password);
      
      if (error) {
        throw error;
      }
      
      // Redirect after successful login
      if (searchParams?.get('callbackUrl')) {
        router.push(searchParams.get('callbackUrl') as string);
      } else {
        router.push('/');
      }
    } catch (error: any) {
      // Handle error with user-friendly message
      handleAuthError(error);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsLoading(true);
    setError(null);
    setIsNetworkError(false);
    
    try {
      // Basic checks
      if (retryCount.current >= MAX_RETRIES) {
        setIsNetworkError(true);
        throw new Error(`Multiple sign-up attempts failed. Please try again later or contact support.`);
      }
      
      // Check environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase environment variables:', { 
          hasUrl: !!supabaseUrl, 
          hasKey: !!supabaseKey 
        });
        setIsNetworkError(true);
        throw new Error('Application configuration issue. Please contact support.');
      }
      
      // Skip network diagnostics - they're causing more problems than they solve
      // Try to use the auth helper first which has fallback mechanisms
      let signUpResult;
      
      try {
        signUpResult = await auth.signUp(
          email, 
          password, 
          firstName, 
          lastName
        );
      } catch (authError: any) {
        console.error('Auth helper sign-up failed, trying direct client:', authError);
        
        // If auth helper fails, try using getSupabaseClient directly
        const client = getSupabaseClient();
        const displayName = firstName && lastName ? `${firstName} ${lastName}` : '';
        
        signUpResult = await client.auth.signUp({
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
      }
      
      if (signUpResult.error) {
        // Check for specific error types
        if (signUpResult.error.message.includes('fetch') || 
            signUpResult.error.message.includes('network') || 
            signUpResult.error.message.includes('connect')) {
          setIsNetworkError(true);
          retryCount.current += 1;
          
          throw new Error(`Network error (attempt ${retryCount.current}/${MAX_RETRIES}): Unable to connect to authentication service.`);
        }
        
        // Handle email already exists specifically
        if (signUpResult.error.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        
        throw signUpResult.error;
      }
      
      // Success! Reset retry counter
      retryCount.current = 0;
      setMessage('Check your email for the confirmation link');
    } catch (error: any) {
      // Handle error with user-friendly message
      handleAuthError(error);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationErrors({ email: err.errors[0].message });
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    setIsNetworkError(false);
    
    try {
      // Try to use the auth helper first which has fallback mechanisms
      let resetResult;
      
      try {
        resetResult = await auth.resetPassword(email);
      } catch (authError: any) {
        console.error('Auth helper reset password failed, trying direct client:', authError);
        
        // If auth helper fails, try using getSupabaseClient directly
        const client = getSupabaseClient();
        resetResult = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
        });
      }
      
      if (resetResult.error) {
        if (resetResult.error.message.includes('fetch') || resetResult.error.message.includes('network')) {
          setIsNetworkError(true);
          throw new Error('Unable to connect to authentication service. Please check your network connection.');
        }
        throw resetResult.error;
      }
      
      setMessage('Check your email for the password reset link');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset password email');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle error that shows user-friendly messages
  const handleAuthError = (error: any) => {
    setIsLoading(false);
    setIsNetworkError(false);
    
    if (!error) {
      setError('An unknown error occurred');
      return;
    }
    
    console.error('Auth error:', error);
    
    if (error.message?.includes('network')) {
      setIsNetworkError(true);
      setError('Unable to connect to the authentication service. Please check your internet connection and try again.');
    } else if (error.message?.includes('fetch')) {
      setIsNetworkError(true);
      setError('Connection issue: Cannot reach the authentication service.');
    } else if (error.message?.includes('User already registered')) {
      setError('This email is already registered. Please sign in instead.');
    } else if (error.message?.includes('Invalid login credentials')) {
      setError('Incorrect email or password.');
    } else {
      setError(error.message || 'An error occurred during authentication');
    }
  };
  
  // The retry button implementation
  const handleRetry = async () => {
    setError(null);
    setIsNetworkError(false);
    setIsLoading(true);
    
    try {
      // Just retry the operation based on current tab
      if (activeTab === 'signin') {
        await handleSignIn({ preventDefault: () => {} } as React.FormEvent);
      } else {
        await handleSignUp({ preventDefault: () => {} } as React.FormEvent);
      }
    } catch (err: any) {
      console.error('Error during retry:', err);
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to directly test Supabase connectivity without going through abstractions
  const testSupabaseConnection = async () => {
    setIsLoading(true);
    setTestingConnection(true);
    setError(null);
    
    try {
      console.log('Testing direct Supabase connectivity...');
      
      // Display environment variables (without revealing sensitive parts)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      console.log('Supabase URL configured:', !!supabaseUrl);
      console.log('Supabase Key configured:', !!supabaseKey);
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
      }
      
      // Test a direct fetch to Supabase to see if it's reachable
      const result = await fetch(`${supabaseUrl}/auth/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Direct Supabase fetch result:', result.status, result.ok);
      
      // Now try using the getSupabaseClient function
      const client = getSupabaseClient();
      
      // Try a simple operation
      const sessionResult = await client.auth.getSession();
      console.log('Session check result:', sessionResult.error ? 'Error' : 'Success');
      
      if (sessionResult.error) {
        throw sessionResult.error;
      }
      
      // If we get here, connectivity is working
      setMessage('Supabase connectivity test successful. You can try signing up now.');
    } catch (error) {
      console.error('Supabase connectivity test failed:', error);
      setError(`Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsNetworkError(true);
    } finally {
      setIsLoading(false);
      setTestingConnection(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <Tabs defaultValue="signin" value={activeTab} onValueChange={setActiveTab}>
        <CardHeader>
          <CardTitle className="text-2xl text-center">Toro Task Pomodoro</CardTitle>
          <CardDescription className="text-center">
            Manage your tasks and time effectively
          </CardDescription>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
        </CardHeader>
        
        <CardContent>
          {isNetworkError ? (
            <Alert variant="destructive" className="mb-4">
              <WifiOff className="h-4 w-4 mr-2" />
              <AlertDescription className="flex flex-col">
                <span>{error}</span>
                <div className="mt-2 text-sm">
                  <p className="mb-2">Possible solutions:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Check your internet connection</li>
                    <li>Ensure you're not using a VPN that blocks the authentication service</li>
                    <li>Try disabling browser extensions that might block network requests</li>
                    <li>Try again in a few moments</li>
                    {retryCount.current >= MAX_RETRIES && (
                      <li>You've reached the maximum number of retries. Try again later or use a different device/browser.</li>
                    )}
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-3 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={handleRetry}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry ({retryCount.current}/{MAX_RETRIES})
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          
          {message && (
            <Alert className="mb-4 bg-green-100 text-green-800 border-green-500">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className={validationErrors.email ? "border-red-500" : ""}
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-500">{validationErrors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      if (!email) {
                        setValidationErrors({ email: 'Please enter your email first' });
                        return;
                      }
                      handleResetPassword(e);
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={validationErrors.password ? "border-red-500" : ""}
                />
                {validationErrors.password && (
                  <p className="text-sm text-red-500">{validationErrors.password}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading || retryCount.current >= MAX_RETRIES}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    required
                    className={validationErrors.firstName ? "border-red-500" : ""}
                  />
                  {validationErrors.firstName && (
                    <p className="text-sm text-red-500">{validationErrors.firstName}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    required
                    className={validationErrors.lastName ? "border-red-500" : ""}
                  />
                  {validationErrors.lastName && (
                    <p className="text-sm text-red-500">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className={validationErrors.email ? "border-red-500" : ""}
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-500">{validationErrors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={validationErrors.password ? "border-red-500" : ""}
                />
                {validationErrors.password && (
                  <p className="text-sm text-red-500">{validationErrors.password}</p>
                )}
                <p className="text-xs text-gray-500">
                  Password must be at least 6 characters
                </p>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading || retryCount.current >= MAX_RETRIES}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing up...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>
          </TabsContent>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-gray-600">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </div>
          
          {/* Add connectivity test button for troubleshooting */}
          {isNetworkError && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={testSupabaseConnection}
              disabled={isLoading || testingConnection}
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                'Test Supabase Connection'
              )}
            </Button>
          )}
        </CardFooter>
      </Tabs>
    </Card>
  );
};

export default AuthForm; 