"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coffee,
  Eye,
  BrainCircuit,
  ArrowRight,
  X,
  Sun,
  PersonStanding,
  Footprints
} from "lucide-react";
import { useUserPreferences } from "@/lib/userPreferences";
import { cn } from "@/lib/utils";

interface BreakSuggestion {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  icon: React.ReactNode;
  type: 'physical' | 'mental' | 'social' | 'nutritional';
  tags?: string[];
}

// Collection of break suggestions
const BREAK_SUGGESTIONS: BreakSuggestion[] = [
  {
    id: "stretch",
    title: "Quick Stretch",
    description: "Stand up and do some light stretching to improve circulation.",
    duration: 2,
    icon: <PersonStanding className="h-5 w-5" />,
    type: "physical",
    tags: ["quick", "energizing"]
  },
  {
    id: "eye-rest",
    title: "20-20-20 Eye Break",
    description: "Look at something 20 feet away for 20 seconds to reduce eye strain.",
    duration: 1,
    icon: <Eye className="h-5 w-5" />,
    type: "physical",
    tags: ["quick", "eye-strain"]
  },
  {
    id: "hydrate",
    title: "Hydrate Break",
    description: "Refill your water and take a moment to hydrate.",
    duration: 3,
    icon: <Coffee className="h-5 w-5" />,
    type: "nutritional",
    tags: ["quick", "health"]
  },
  {
    id: "walk",
    title: "Short Walk",
    description: "Take a brief walk to get your blood flowing.",
    duration: 5,
    icon: <Footprints className="h-5 w-5" />,
    type: "physical",
    tags: ["energizing", "medium"]
  },
  {
    id: "mindfulness",
    title: "Mindfulness Minute",
    description: "Take a minute to practice mindful breathing.",
    duration: 2,
    icon: <BrainCircuit className="h-5 w-5" />,
    type: "mental",
    tags: ["quick", "focus"]
  },
  {
    id: "outdoor",
    title: "Sunshine Break",
    description: "Step outside briefly for some natural light and fresh air.",
    duration: 5,
    icon: <Sun className="h-5 w-5" />,
    type: "physical",
    tags: ["energizing", "medium"]
  }
];

interface BreakSuggestionCardProps {
  suggestion: BreakSuggestion;
  onTake: (suggestion: BreakSuggestion) => void;
  onDismiss: () => void;
}

const BreakSuggestionCard: React.FC<BreakSuggestionCardProps> = ({
  suggestion,
  onTake,
  onDismiss
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="relative bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/20 p-4 rounded-lg shadow-md border border-indigo-100 dark:border-indigo-800/50"
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/40 rounded-full">
          {suggestion.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            {suggestion.title}
            <Badge variant="outline" className="px-1.5 py-0 text-xs">
              {suggestion.duration}m
            </Badge>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {suggestion.description}
          </p>
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              onClick={() => onTake(suggestion)}
              className="gap-1.5"
            >
              Take a break
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface DynamicBreakSuggestionsProps {
  workDuration?: number; // Current work duration in minutes
  isInFlow?: boolean; // Whether the user is in a flow state
  taskType?: string; // Type of current task
  onTakeBreak?: (duration: number) => void; // Callback when user takes a break
}

export function DynamicBreakSuggestions({
  workDuration = 0,
  isInFlow = false,
  taskType = "focus",
  onTakeBreak
}: DynamicBreakSuggestionsProps) {
  const { preferences } = useUserPreferences();
  const [currentSuggestion, setCurrentSuggestion] = useState<BreakSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [lastSuggestionTime, setLastSuggestionTime] = useState(0);

  // Get suggestion frequency threshold based on user preference
  const getSuggestionThreshold = () => {
    // Use a percentage of the max work time as the suggestion threshold
    const maxWorkTime = preferences.durationRules.maxWorkWithoutBreak;
    
    switch (preferences.breakSuggestionFrequency) {
      case "low":
        return maxWorkTime * 0.8; // Suggest at 80% of max work time
      case "high":
        return maxWorkTime * 0.5; // Suggest at 50% of max work time
      case "medium":
      default:
        return maxWorkTime * 0.65; // Suggest at 65% of max work time
    }
  };

  // Calculate how many suggestions to skip when in flow
  const getFlowSkipCount = () => {
    switch (preferences.breakSuggestionFrequency) {
      case "low":
        return 3; // Skip more suggestions when in flow
      case "high":
        return 1; // Skip fewer suggestions when in flow
      case "medium":
      default:
        return 2; // Skip a moderate number of suggestions when in flow
    }
  };

  // Choose a suggestion based on current context
  const chooseSuggestion = (): BreakSuggestion | null => {
    // Don't suggest breaks if disabled
    if (!preferences.breakReminders) {
      return null;
    }
    
    // Check if enough time has passed since the last suggestion
    const now = Date.now();
    const minIntervalBetweenSuggestions = 5 * 60 * 1000; // 5 minutes in ms
    if (now - lastSuggestionTime < minIntervalBetweenSuggestions) {
      return null;
    }

    // Filter suggestions based on current context
    let filteredSuggestions = [...BREAK_SUGGESTIONS];
    
    // For shorter durations, suggest shorter breaks
    if (workDuration < 30) {
      filteredSuggestions = filteredSuggestions.filter(s => s.duration <= 3);
    }
    
    // For long screen time, prioritize eye and physical breaks
    if (workDuration > 60) {
      filteredSuggestions.sort((a, b) => {
        if (a.type === 'physical' && b.type !== 'physical') return -1;
        if (a.id === 'eye-rest' && b.id !== 'eye-rest') return -1;
        return 0;
      });
    }
    
    // For mental tasks, suggest more physical breaks
    if (taskType === 'focus' || taskType === 'learning') {
      filteredSuggestions.sort((a, b) => {
        if (a.type === 'physical' && b.type !== 'physical') return -1;
        return 0;
      });
    }
    
    // Pick a random suggestion from the filtered and sorted list
    return filteredSuggestions.length > 0
      ? filteredSuggestions[Math.floor(Math.random() * filteredSuggestions.length)]
      : null;
  };

  // Handle taking a break
  const handleTakeBreak = (suggestion: BreakSuggestion) => {
    setShowSuggestion(false);
    if (onTakeBreak) {
      onTakeBreak(suggestion.duration);
    }
  };

  // Handle dismissing the suggestion
  const handleDismiss = () => {
    setShowSuggestion(false);
    setLastSuggestionTime(Date.now());
  };
  
  // Check if we should show a break suggestion
  useEffect(() => {
    // Skip if already showing a suggestion
    if (showSuggestion) return;
    
    // Only check periodically to avoid too many re-renders
    const checkInterval = 60 * 1000; // 1 minute in ms
    
    const intervalId = setInterval(() => {
      // Get current threshold based on user preferences
      const threshold = getSuggestionThreshold();
      
      // Determine if we should show a suggestion
      if (workDuration >= threshold) {
        // In flow state, we might skip some suggestions
        if (isInFlow) {
          // Use a probabilistic approach to occasionally skip suggestions
          const skipCount = getFlowSkipCount();
          const randomValue = Math.random() * 10;
          if (randomValue < skipCount) {
            // Skip this suggestion
            return;
          }
        }
        
        // Choose and show a suggestion
        const suggestion = chooseSuggestion();
        if (suggestion) {
          setCurrentSuggestion(suggestion);
          setShowSuggestion(true);
          setLastSuggestionTime(Date.now());
        }
      }
    }, checkInterval);
    
    return () => clearInterval(intervalId);
  }, [workDuration, isInFlow, preferences.breakReminders, preferences.breakSuggestionFrequency]);
  
  // Also check immediately when the component mounts or when work duration changes significantly
  useEffect(() => {
    const threshold = getSuggestionThreshold();
    
    // Check if we're just crossing the threshold
    if (workDuration >= threshold && !showSuggestion) {
      // Small delay to not show immediately
      const timeoutId = setTimeout(() => {
        const suggestion = chooseSuggestion();
        if (suggestion) {
          setCurrentSuggestion(suggestion);
          setShowSuggestion(true);
          setLastSuggestionTime(Date.now());
        }
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [workDuration]);
  
  // Don't render anything if we're not showing a suggestion
  if (!showSuggestion || !currentSuggestion) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <AnimatePresence>
        {showSuggestion && currentSuggestion && (
          <BreakSuggestionCard
            suggestion={currentSuggestion}
            onTake={handleTakeBreak}
            onDismiss={handleDismiss}
          />
        )}
      </AnimatePresence>
    </div>
  );
} 