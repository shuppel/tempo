import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { createReplicacheClient, Rep } from './replicache-client';
import { v4 as uuidv4 } from 'uuid';
import { setReplicacheClient } from './sessionStorage';

// Create a context for Replicache
const ReplicacheContext = createContext<Rep | null>(null);

// Get user ID from localStorage or create a new one
const getUserId = (): string => {
  const USER_ID_KEY = 'torodoro-user-id';
  let userId = typeof window !== 'undefined' ? localStorage.getItem(USER_ID_KEY) : null;
  
  if (!userId) {
    userId = uuidv4();
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_ID_KEY, userId);
    }
  }
  
  return userId;
};

interface ReplicacheProviderProps {
  children: ReactNode;
}

export function ReplicacheProvider({ children }: ReplicacheProviderProps) {
  const [rep, setRep] = useState<Rep | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || typeof window === 'undefined') {
      return;
    }
    
    initialized.current = true;
    const userId = getUserId();
    const replicache = createReplicacheClient(userId);
    
    // Set Replicache client in sessionStorage for use
    setReplicacheClient(replicache);
    setRep(replicache);
    
    // Setup sync interval
    const syncInterval = setInterval(() => {
      replicache.pull();
    }, 5000);
    
    return () => {
      clearInterval(syncInterval);
      replicache.close();
    };
  }, []);

  return (
    <ReplicacheContext.Provider value={rep}>
      {children}
    </ReplicacheContext.Provider>
  );
}

// Hook to use Replicache throughout the app
export function useReplicache() {
  const rep = useContext(ReplicacheContext);
  if (!rep) {
    throw new Error('useReplicache must be used within a ReplicacheProvider');
  }
  return rep;
} 