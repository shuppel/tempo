"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { sessionStorage } from '@/lib/sessionStorage';
import { supabaseStorage } from '@/lib/utils/supabase/supabaseStorage';
import { supabase } from '@/lib/supabase';
import { Session } from '@/lib/types';

export const DataMigration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);
  const [migratedCount, setMigratedCount] = useState(0);

  const migrateData = async () => {
    setIsLoading(true);
    setResults(null);
    
    try {
      // First check if the user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResults({
          success: false,
          message: 'You must be logged in to migrate data',
          details: 'Please sign in to continue with data migration.'
        });
        return;
      }
      
      // Get all sessions from local storage
      const localSessions = sessionStorage.getAllSessions();
      
      if (Object.keys(localSessions).length === 0) {
        setResults({
          success: false,
          message: 'No sessions found in local storage',
          details: 'There is no local data to migrate.'
        });
        return;
      }
      
      // Count migrated sessions
      let migrated = 0;
      
      // Migrate each session to Supabase
      for (const [date, session] of Object.entries(localSessions)) {
        // Convert the local session to a proper Session object
        const sessionToMigrate: Session = {
          date: date,
          storyBlocks: session.storyBlocks || [],
          status: session.status || 'planned',
          totalDuration: session.totalDuration || 0,
          lastUpdated: session.lastUpdated || new Date().toISOString()
        };
        
        // Save to Supabase
        await supabaseStorage.saveSession(date, sessionToMigrate);
        migrated++;
      }
      
      setMigratedCount(migrated);
      setResults({
        success: true,
        message: `Successfully migrated ${migrated} sessions`,
        details: 'Your data has been moved to your Supabase account. You can now access it from any device.'
      });
      
    } catch (error: any) {
      console.error('Error migrating data:', error);
      setResults({
        success: false,
        message: 'Error migrating data',
        details: error.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Data Migration</CardTitle>
        <CardDescription>
          Migrate your existing local sessions to your Supabase account
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="mb-4 text-gray-600">
          This tool will copy all your locally stored sessions to your Supabase account.
          Your local data will remain untouched after migration.
        </p>
        
        {results && (
          <Alert className={`mb-4 ${results.success ? 'bg-green-50' : 'bg-red-50'}`}>
            {results.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle>{results.message}</AlertTitle>
            <AlertDescription>{results.details}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={migrateData} 
          disabled={isLoading || (results?.success && migratedCount > 0)}
          className="w-full"
        >
          {isLoading ? 'Migrating...' : (results?.success ? 'Migration Complete' : 'Migrate Local Data')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DataMigration; 