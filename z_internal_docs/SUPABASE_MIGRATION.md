# Migrating Toro Task Pomodoro to Supabase

This guide explains how to migrate the Toro Task Pomodoro application from local storage to Supabase backend.

## Overview

The migration involves:
1. Setting up a Supabase project
2. Creating the database schema
3. Configuring authentication
4. Updating the application to use Supabase instead of local storage
5. Migrating existing data (optional)

## Prerequisites

- Node.js and npm installed
- A Supabase account (free tier is sufficient to start)
- Git installed

## Step 1: Set Up Supabase Project

1. Sign up for a Supabase account at [https://supabase.com](https://supabase.com) if you don't have one
2. Create a new project from the Supabase dashboard
3. Note your project URL and anon key (you'll need these for configuration)

## Step 2: Configure Environment Variables

1. Create a `.env.local` file in the root of your project:
   ```
   cp .env.example .env.local
   ```

2. Fill in your Supabase project details:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

## Step 3: Create Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `lib/supabase-schema.sql`
3. Paste it into the SQL editor and run the query
4. Verify that all tables have been created in the Table Editor view

## Step 4: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 5: Update Your Application

The migration includes the following new files:
- `lib/supabase.ts` - Supabase client configuration
- `lib/database.types.ts` - TypeScript types for database tables
- `lib/supabaseStorage.ts` - Replacement for local storage operations

To use Supabase in your application:

1. Update imports to use `supabaseStorage` instead of `sessionStorage`:
   ```typescript
   // Before
   import { sessionStorage } from '../lib/sessionStorage';
   
   // After
   import { supabaseStorage } from '../lib/supabaseStorage';
   ```

2. Add authentication to your app (example login component):

```tsx
// components/Login.tsx
import { useState } from 'react';
import { auth } from '../lib/supabase';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await auth.signIn(email, password);
      if (error) throw error;
      // Redirect to dashboard or home page after successful login
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Sign In'}
      </button>
    </form>
  );
};
```

3. Add an authentication wrapper to protect routes:

```tsx
// components/AuthGuard.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '../lib/supabase';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await auth.getSession();
      
      if (!data.session) {
        router.push('/login');
      } else {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};
```

## Step 6: Migrate Existing Data (Optional)

If you want to migrate existing data from local storage to Supabase:

1. Create a data migration utility:

```tsx
// pages/migrate.tsx
import { useEffect, useState } from 'react';
import { sessionStorage } from '../lib/sessionStorage';
import { supabaseStorage } from '../lib/supabaseStorage';
import { auth } from '../lib/supabase';

export default function Migrate() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    checkAuth();
  }, []);

  const startMigration = async () => {
    if (!isLoggedIn) {
      setError('You must be logged in to migrate data');
      return;
    }

    setIsMigrating(true);
    setError(null);
    
    try {
      // Get all sessions from local storage
      const localSessions = sessionStorage.getAllSessions();
      const sessionDates = Object.keys(localSessions);
      
      for (let i = 0; i < sessionDates.length; i++) {
        const date = sessionDates[i];
        const session = localSessions[date];
        
        // Save to Supabase
        await supabaseStorage.saveSession(date, session);
        
        // Update progress
        setProgress(Math.round(((i + 1) / sessionDates.length) * 100));
      }
      
      setComplete(true);
    } catch (err: any) {
      setError(err.message || 'Failed to migrate data');
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div>
        <h1>Data Migration</h1>
        <p>Please log in to migrate your data.</p>
        <button onClick={() => window.location.href = '/login'}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Data Migration Tool</h1>
      <p>This will migrate your local sessions to your Supabase account.</p>
      
      {!isMigrating && !complete && (
        <button onClick={startMigration} disabled={isMigrating}>
          Start Migration
        </button>
      )}
      
      {isMigrating && (
        <div>
          <p>Migration in progress...</p>
          <progress value={progress} max="100" />
          <p>{progress}% complete</p>
        </div>
      )}
      
      {complete && (
        <div>
          <p>Migration complete! Your data has been transferred to Supabase.</p>
          <button onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </button>
        </div>
      )}
      
      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
```

## Step 7: Deploy Your Application

After testing locally, you can deploy your application with Supabase integration using platforms like Vercel, Netlify, or any other hosting service that supports Next.js applications.

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Helpers for Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase Community Discord](https://discord.supabase.com) 