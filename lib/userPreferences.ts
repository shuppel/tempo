/**
 * UserPreferencesService
 * 
 * Manages user preferences for workplan creation and time management,
 * persisting them to localStorage and providing default values.
 */

'use client';

import { useEffect, useState } from 'react';
import { UserPreferences } from './types';

// Default duration rules based on sensible defaults
export const DEFAULT_DURATION_RULES = {
  maxWorkWithoutBreak: 120,     // 2 hours max work before requiring long break
  minBreakDuration: 5,          // 5 minutes minimum break
  shortBreakDuration: 5,        // 5 minute short breaks
  longBreakDuration: 15,        // 15 minute long breaks
  blockSize: 5,                 // Round to 5 minute increments
} as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  durationRules: DEFAULT_DURATION_RULES,
  breakReminders: true,
  breakSuggestionFrequency: 'medium',
};

// Local storage key
const PREFERENCES_STORAGE_KEY = 'toro-user-preferences';

/**
 * Service for managing user preferences
 */
export class UserPreferencesService {
  /**
   * Get the user's preferences, falling back to defaults if not set
   */
  static getPreferences(): UserPreferences {
    if (typeof window === 'undefined') {
      return DEFAULT_PREFERENCES;
    }

    try {
      const storedPrefs = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!storedPrefs) {
        return DEFAULT_PREFERENCES;
      }

      const parsedPrefs = JSON.parse(storedPrefs) as Partial<UserPreferences>;
      
      // Merge with defaults to ensure all properties exist
      return {
        durationRules: {
          ...DEFAULT_DURATION_RULES,
          ...parsedPrefs.durationRules,
        },
        breakReminders: parsedPrefs.breakReminders ?? DEFAULT_PREFERENCES.breakReminders,
        breakSuggestionFrequency: parsedPrefs.breakSuggestionFrequency ?? DEFAULT_PREFERENCES.breakSuggestionFrequency,
      };
    } catch (error) {
      console.error('Error retrieving preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Save the user's preferences
   */
  static savePreferences(preferences: UserPreferences): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  /**
   * Update just the duration rules
   */
  static updateDurationRules(durationRules: Partial<typeof DEFAULT_DURATION_RULES>): void {
    const currentPrefs = this.getPreferences();
    this.savePreferences({
      ...currentPrefs,
      durationRules: {
        ...currentPrefs.durationRules,
        ...durationRules,
      },
    });
  }

  /**
   * Reset preferences to defaults
   */
  static resetPreferences(): void {
    this.savePreferences(DEFAULT_PREFERENCES);
  }
}

/**
 * React hook for managing user preferences
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadedPrefs = UserPreferencesService.getPreferences();
    setPreferences(loadedPrefs);
    setIsLoaded(true);
  }, []);

  // Update preferences
  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    const updatedPrefs = {
      ...preferences,
      ...newPrefs,
      // Handle nested durationRules object
      durationRules: {
        ...preferences.durationRules,
        ...(newPrefs.durationRules || {}),
      },
    };
    
    setPreferences(updatedPrefs);
    UserPreferencesService.savePreferences(updatedPrefs);
    return updatedPrefs;
  };

  // Reset to defaults
  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    UserPreferencesService.resetPreferences();
    return DEFAULT_PREFERENCES;
  };

  return {
    preferences,
    isLoaded,
    updatePreferences,
    resetPreferences,
  };
} 