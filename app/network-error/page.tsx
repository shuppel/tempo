"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WifiOff, RefreshCw, ArrowLeft, Bug } from 'lucide-react';
import { performNetworkDiagnostics, getTroubleshootingSuggestions } from '@/lib/utils/supabase/networkUtils';

// Define a type for the diagnostics results
interface DiagnosticsResults {
  timestamp: string;
  hasInternet: boolean;
  hasSupabaseConfig: boolean;
  hasSupabaseConnectivity: boolean;
  supabaseUrlConfigured: boolean;
  supabaseKeyConfigured: boolean;
  userAgent: string;
  diagnosticId: string;
  [key: string]: unknown;
}

export default function NetworkErrorPage() {
  const router = useRouter();
  const [diagnosticsResults, setDiagnosticsResults] = useState<DiagnosticsResults | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  
  // Run diagnostics on page load
  useEffect(() => {
    runDiagnostics();
  }, []);
  
  // Function to run network diagnostics
  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const diagnostics = await performNetworkDiagnostics();
      setDiagnosticsResults(diagnostics);
      setSuggestions(getTroubleshootingSuggestions(diagnostics));
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setSuggestions([
        'Check your internet connection',
        'Try again in a few moments',
        'Ensure you\'re not blocking network requests',
        'Try using a different browser or device'
      ]);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };
  
  // Function to copy diagnostics to clipboard
  const copyDiagnosticsToClipboard = async () => {
    if (!diagnosticsResults) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticsResults, null, 2));
      setDiagnosticsCopied(true);
      setTimeout(() => setDiagnosticsCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy diagnostics:', error);
    }
  };
  
  return (
    <div className="container py-10 max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <WifiOff className="h-6 w-6 text-red-500" />
            Network Connectivity Issue
          </CardTitle>
          <CardDescription>
            We&apos;re having trouble connecting to our authentication service
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Connection Failed</AlertTitle>
            <AlertDescription>
              Your device can&apos;t connect to our authentication service. This might be due to network issues or service disruptions.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <h3 className="font-medium">Troubleshooting Suggestions:</h3>
            <ul className="list-disc pl-5 space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
          
          {diagnosticsResults && (
            <div className="text-xs text-gray-500 mt-4">
              <p>Diagnostic Info:</p>
              <div className="mt-1 bg-gray-100 p-2 rounded text-xs">
                <p>Internet Connection: {diagnosticsResults.hasInternet ? '✅ Connected' : '❌ Disconnected'}</p>
                <p>Supabase Connection: {diagnosticsResults.hasSupabaseConnectivity ? '✅ Reachable' : '❌ Unreachable'}</p>
                <p>Config Valid: {diagnosticsResults.hasSupabaseConfig ? '✅ Valid' : '❌ Invalid'}</p>
                <p>Time: {new Date(diagnosticsResults.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3">
          <Button 
            variant="default" 
            onClick={() => router.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          
          <Button 
            variant="outline" 
            onClick={runDiagnostics}
            disabled={isRunningDiagnostics}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
            {isRunningDiagnostics ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={copyDiagnosticsToClipboard}
            disabled={!diagnosticsResults}
            className="w-full sm:w-auto"
          >
            <Bug className="h-4 w-4 mr-2" />
            {diagnosticsCopied ? 'Copied!' : 'Copy Diagnostics'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 