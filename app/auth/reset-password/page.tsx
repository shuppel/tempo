"use client";

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';
import { performNetworkDiagnostics } from '@/lib/utils/supabase/networkUtils';

// Define validation schema
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check that we have a hash fragment
    if (typeof window !== 'undefined') {
      // This code only runs in the browser
      if (!window.location.hash) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    }
  }, []);

  const validatePasswords = (): boolean => {
    setValidationError(null);

    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationError(err.errors[0].message);
        return false;
      }
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswords()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setIsNetworkError(false);
    
    try {
      // Check network connectivity first
      const diagnostics = await performNetworkDiagnostics();
      
      if (!diagnostics.hasInternet) {
        setIsNetworkError(true);
        throw new Error('No internet connection detected. Please check your connection and try again.');
      }
      
      if (!diagnostics.hasSupabaseConnectivity) {
        setIsNetworkError(true);
        throw new Error('Unable to reach authentication service. Your network may be blocking the connection.');
      }
      
      // Try to get the client
      const supabase = getSupabaseClient();
      
      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        // Check for connectivity issues
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to connect')) {
          setIsNetworkError(true);
          throw new Error('Unable to connect to authentication service. Please check your network connection.');
        }
        throw error;
      }
      
      setMessage('Password updated successfully! Redirecting to login...');
      
      // Redirect to login page after successful password reset
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err: any) {
      if (!isNetworkError) {
        setError(err.message || 'Failed to update password. Please try again.');
      } else {
        setError(err.message || 'Network error: Failed to connect to authentication service.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    // Run diagnostics before retry
    try {
      setIsLoading(true);
      const diagnostics = await performNetworkDiagnostics();
      console.log('Pre-retry diagnostics:', diagnostics);
      setIsLoading(false);
      
      if (diagnostics.hasInternet && diagnostics.hasSupabaseConnectivity) {
        setIsNetworkError(false);
        setError(null);
        handleResetPassword(new Event('submit') as any);
      } else {
        setError('Still experiencing connection issues. Please check your network connection and try again later.');
      }
    } catch (err) {
      setIsLoading(false);
      console.error('Error during retry diagnostics:', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Reset Your Password</h1>
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
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
                  </ul>
                </div>
                <div className="flex justify-end mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs" 
                    onClick={handleRetry}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Try Again
                      </>
                    )}
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
          
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className={validationError ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500">
                Password must be at least 6 characters
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={validationError ? "border-red-500" : ""}
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="justify-center">
          <Button variant="link" onClick={() => router.push('/auth/login')}>
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 