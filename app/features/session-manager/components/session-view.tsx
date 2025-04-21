"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  ChevronLeft,
  MinusCircle,
  PlusCircle,
  ListChecks,
  Timer,
  Hourglass,
  BarChart2
} from "lucide-react"
import { useSession } from "../hooks/useSession"
import { SessionStorageService } from "../services/session-storage.service"
import { format } from "date-fns"
import { VerticalTimeline } from './vertical-timeline'
import { 
  AnimatePresence, 
  motion, 
  useSpring, 
  useTransform, 
  useMotionValue, 
  useScroll, 
  useMotionValueEvent,
  MotionValue 
} from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "@/components/ui/use-toast"
import { LiaFrogSolid } from "react-icons/lia"
import { Icon } from "@/components/ui/icon"

interface SessionViewProps {
  id?: string;
  date?: string;
  storageService?: SessionStorageService;
}

// Separate timer display component to prevent re-animations
const TimerDisplay = React.memo(({ 
  time, 
  showRed,
  hideHurryBadge = false
}: { 
  time: string, 
  showRed: boolean,
  hideHurryBadge?: boolean
}) => {
  // Split the time into digits and separator for individual styling
  const [minutes, seconds] = time.split(':');
  
  return (
    <div className="flex items-center justify-center">
      <span 
        className={cn(
          "font-display font-bold tracking-tight relative",
          showRed 
            ? "text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500" 
            : "text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-500 dark:from-indigo-400 dark:to-blue-300"
        )}
      >
        <span className={cn(
          "timer-digit text-5xl", 
          showRed && "timer-urgent"
        )} style={{ animationDelay: "0ms" }}>
          {minutes[0]}
        </span>
        <span className={cn(
          "timer-digit text-5xl", 
          showRed && "timer-urgent"
        )} style={{ animationDelay: "150ms" }}>
          {minutes[1]}
        </span>
        <span className="timer-colon text-4xl mx-1">:</span>
        <span className={cn(
          "timer-digit text-5xl", 
          showRed && "timer-urgent"
        )} style={{ animationDelay: "300ms" }}>
          {seconds[0]}
        </span>
        <span className={cn(
          "timer-digit text-5xl", 
          showRed && "timer-urgent"
        )} style={{ animationDelay: "450ms" }}>
          {seconds[1]}
        </span>
        {showRed && !hideHurryBadge && (
          <span className="absolute -top-2 -right-6 text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full animate-bounce">
            Hurry!
          </span>
        )}
      </span>
    </div>
  );
});

TimerDisplay.displayName = 'TimerDisplay';

// Floating Timer Content Component separated from animation container
const FloatingTimerContent = React.memo(({ 
  title, 
  formattedTime, 
  isTimerRunning, 
  timeRemaining, 
  onPause, 
  onResume, 
  onComplete,
  showRed,
  timeBoxType,
  onAdjustTime,
  onGoToTimeline
}: { 
  title: string;
  formattedTime: string;
  isTimerRunning: boolean;
  timeRemaining: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  showRed: boolean;
  timeBoxType?: string;
  onAdjustTime?: (minutes: number) => void;
  onGoToTimeline?: () => void;
}) => {
  // Add state for edit mode
  const [showEdit, setShowEdit] = useState(false);
  
  return (
    <div className="p-5 flex flex-col items-center">
      {/* Task title with drop shadow */}
      <div className="w-full mb-2 text-center relative">
        <span 
          onClick={onGoToTimeline} 
          className={cn(
            "text-sm font-semibold text-center drop-shadow-sm line-clamp-1 cursor-pointer relative",
            onGoToTimeline && "hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-2"
          )}
        >
          {title}
          {onGoToTimeline && (
            <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </span>
        
        {/* Go to timeline button */}
        {onGoToTimeline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoToTimeline}
            className="absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 rounded-full opacity-70 hover:opacity-100 transition-opacity hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      {/* Timer badge - positioned at the top */}
      {timeBoxType && (
        <Badge variant="outline" className={cn(
          "mb-2.5 font-normal text-xs px-2.5 py-0.5 shadow-sm",
          timeBoxType === 'work' 
            ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-400"
            : timeBoxType === 'short-break' || timeBoxType === 'long-break'
              ? "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-400"
              : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
        )}>
          {timeBoxType === 'work' ? 'Focus' : timeBoxType === 'short-break' ? 'Short Break' : timeBoxType === 'long-break' ? 'Long Break' : 'Break'}
        </Badge>
      )}
      
      {/* Enhanced timer display with larger font */}
      <div className="relative -mx-2 my-2 px-2 py-1.5 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-transparent dark:from-orange-900/10 dark:to-transparent rounded-xl"></div>
        <div className="relative">
          <TimerDisplay 
            time={formattedTime} 
            showRed={showRed}
            hideHurryBadge={true} 
          />
          
          {/* Add edit button if adjustment function is provided */}
          {onAdjustTime && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
                    onClick={() => setShowEdit(prev => !prev)}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Edit Timer</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* Time Adjustment Controls */}
      {showEdit && onAdjustTime && (
        <div className="flex items-center justify-center gap-2 mt-1 mb-2 bg-indigo-50/50 dark:bg-gray-800/30 rounded-lg p-1.5">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 rounded-full text-indigo-700 dark:text-indigo-400"
            onClick={() => {
              onAdjustTime(-1);
              setShowEdit(false);
            }}
          >
            <MinusCircle className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium">Adjust Time</span>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 rounded-full text-indigo-700 dark:text-indigo-400"
            onClick={() => {
              onAdjustTime(1);
              setShowEdit(false);
            }}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex gap-5 mt-3 relative z-10">
        {/* Add Go To Timeline button */}
        {onGoToTimeline && (
          <div className="relative group">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onGoToTimeline}
                    className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800/50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 transition-all duration-200 hover:scale-105"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Go to timeline</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        
        <div className="relative group">
          {isTimerRunning ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={onPause}
                    className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-all duration-200 hover:scale-105"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Pause</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={onResume}
                    className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-all duration-200 hover:scale-105"
                    disabled={timeRemaining === 0}
                  >
                    <Play className="h-4 w-4 ml-0.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Resume</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <div className="relative group">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onComplete}
                  className="h-10 w-10 rounded-full bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:border-green-800/50 dark:text-green-400 dark:hover:bg-green-950/50 transition-all duration-200 hover:scale-105"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Complete</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
});

FloatingTimerContent.displayName = 'FloatingTimerContent';

// Animation container that doesn't re-render with timer ticks
const FloatingTimerContainer = React.memo(({ 
  children, 
  isVisible, 
  springOpacity, 
  springY, 
  springScale
}: { 
  children: React.ReactNode,
  isVisible: boolean,
  springOpacity: MotionValue<number>,
  springY: MotionValue<number>,
  springScale: MotionValue<number>
}) => {
  // Use a stable animation key that never changes
  const animationKey = React.useRef('floating-timer-container');
  
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div 
          key={animationKey.current}
          className="fixed bottom-6 right-6 z-[100] shadow-xl timer-card-container floating transform-gpu bg-white dark:bg-gray-900 group"
          style={{
            opacity: springOpacity,
            y: springY,
            scale: springScale,
            borderColor: "var(--timer-border-color)",
            background: "var(--timer-background)",
            width: "auto",
            minWidth: "240px",
            boxShadow: "0 0 25px rgba(0, 0, 0, 0.15), 0 0 15px rgba(99, 102, 241, 0.2)"
          }}
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ 
            type: 'spring', 
            damping: 25, 
            stiffness: 300,
            mass: 1.0
          }}
          whileHover={{
            boxShadow: "0 0 30px rgba(99, 102, 241, 0.4), 0 10px 25px rgba(0, 0, 0, 0.2)",
            scale: 1.02,
            transition: { duration: 0.2 }
          }}
        >
          {/* Pulsing indicator to draw attention to the go-to feature */}
          <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-indigo-500 dark:bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:animate-ping"></div>
          
          {/* Sparkle decoration elements */}
          <div className="sparkle-decoration">
            <div className="sparkle-dot"></div>
            <div className="sparkle-dot"></div>
            <div className="sparkle-dot"></div>
            <div className="sparkle-dot"></div>
            <div className="sparkle-dot"></div>
          </div>
          <div className="shine-line"></div>
          
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

FloatingTimerContainer.displayName = 'FloatingTimerContainer';

// Dynamic content that updates without affecting the animation container
const FloatingTimerWrapper = React.memo(({ 
  title, 
  formattedTime: initialFormattedTime, 
  isTimerRunning, 
  timeRemaining, 
  onPause, 
  onResume, 
  onComplete,
  showRed,
  timeBoxType,
  onAdjustTime,
  onGoToTimeline
}: { 
  title: string;
  formattedTime: string;
  isTimerRunning: boolean;
  timeRemaining: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  showRed: boolean;
  timeBoxType?: string;
  onAdjustTime?: (minutes: number) => void;
  onGoToTimeline?: () => void;
}) => {
  // Use local state for the formatted time that updates independently
  const [localFormattedTime, setLocalFormattedTime] = useState(initialFormattedTime);
  
  // Format the time directly from timeRemaining to ensure it's always up to date
  useEffect(() => {
    const formatTime = () => {
      if (timeRemaining === null) return '00:00';
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Initial update
    setLocalFormattedTime(formatTime());
    
    // Only set up interval if timer is running
    if (isTimerRunning && timeRemaining !== null) {
      const interval = setInterval(() => {
        setLocalFormattedTime(formatTime());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [timeRemaining, isTimerRunning]);
  
  // When the parent formattedTime changes, update our local copy
  useEffect(() => {
    setLocalFormattedTime(initialFormattedTime);
  }, [initialFormattedTime]);
  
  return (
    <FloatingTimerContent
      title={title}
      formattedTime={localFormattedTime}
      isTimerRunning={isTimerRunning}
      timeRemaining={timeRemaining}
      onPause={onPause}
      onResume={onResume}
      onComplete={onComplete}
      showRed={showRed}
      timeBoxType={timeBoxType}
      onAdjustTime={onAdjustTime}
      onGoToTimeline={onGoToTimeline}
    />
  );
});

FloatingTimerWrapper.displayName = 'FloatingTimerWrapper';

export const SessionView = ({ id, date, storageService }: SessionViewProps) => {
  // Use date as id if provided (for backward compatibility)
  const sessionId = id || date;
  
  // Ref for timer section to detect when it's out of viewport
  const timerCardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Track intersection ratio for smooth animation
  const intersectionRatio = useRef(1);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(0);
  
  // Get scroll information
  const { scrollY } = useScroll();
  const scrollProgress = useMotionValue(0);
  
  // Animation values for the floating timer
  const floatingTimerY = useTransform(scrollProgress, [0, 1], [100, 0]);
  const floatingTimerOpacity = useTransform(scrollProgress, [0, 0.4], [0, 1]);
  const floatingTimerScale = useTransform(scrollProgress, [0, 1], [0.9, 1]);
  
  // Use spring for smoother animation
  const springY = useSpring(floatingTimerY, { damping: 25, stiffness: 300 });
  const springOpacity = useSpring(floatingTimerOpacity, { damping: 30, stiffness: 400 });
  const springScale = useSpring(floatingTimerScale, { damping: 20, stiffness: 300 });
  
  // Store the floating timer's visibility state in a ref to prevent re-renders
  const isFloatingTimerShown = useRef(false);
  
  // Track whether the floating timer has been initialized to prevent animation on first render
  const isFloatingTimerInitialized = useRef(false);
  
  const {
    session,
    loading,
    error,
    activeTimeBox,
    timeRemaining,
    isTimerRunning,
    completedPercentage,
    isSessionComplete,
    handleTaskClick,
    startTimeBox,
    pauseTimer,
    resumeTimer,
    resetTimer,
    completeTimeBox,
    undoCompleteTimeBox,
    isCurrentTimeBox,
    updateTimeRemaining
  } = useSession({ id: sessionId, storageService });

  // State for active time update
  const [currentFormattedTime, setCurrentFormattedTime] = useState('00:00');
  
  // Stable visibility state for floating timer
  const [stableFloatingVisible, setStableFloatingVisible] = useState(false);
  
  // Function to scroll to the active timeBox in the timeline
  const scrollToActiveTimeBox = useCallback(() => {
    if (!activeTimeBox) return;
    
    const timeBoxId = `${activeTimeBox.storyId}-box-${activeTimeBox.timeBoxIndex}`;
    
    // Find the timeline item
    const timelineItem = document.querySelector(`[data-id="${timeBoxId}"]`);
    
    if (timelineItem) {
      // Add a visual highlight effect to the element temporarily
      timelineItem.classList.add('timeline-highlight-pulse');
      
      // Scroll to the timeline first if needed
      if (timelineRef.current) {
        timelineRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      // Then after a short delay, scroll to the specific item
      setTimeout(() => {
        timelineItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove the highlight effect after animation
        setTimeout(() => {
          timelineItem.classList.remove('timeline-highlight-pulse');
        }, 2000);
      }, 500);
      
      // Hide the floating timer
      setStableFloatingVisible(false);
    }
  }, [activeTimeBox]);
  
  // Ensure time display is updated regularly
  useEffect(() => {
    // Format the time for display
    const updateFormattedTime = () => {
      if (timeRemaining === null) {
        setCurrentFormattedTime('00:00');
        return;
      }
      
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      setCurrentFormattedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    // Initial update
    updateFormattedTime();
    
    // Only update if timer is running
    if (isTimerRunning && timeRemaining !== null) {
      const interval = setInterval(updateFormattedTime, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemaining, isTimerRunning]);

  // Calculate the active timebox type and details
  const getActiveTimeBoxDetails = useCallback(() => {
    if (!session || !activeTimeBox) return null;
    
    const storyIndex = session.storyBlocks.findIndex(story => story.id === activeTimeBox.storyId);
    if (storyIndex === -1) return null;
    
    const timeBox = session.storyBlocks[storyIndex].timeBoxes[activeTimeBox.timeBoxIndex];
    const storyTitle = session.storyBlocks[storyIndex].title;
    
    return {
      title: storyTitle,
      timeBox,
      totalDuration: timeBox.duration * 60,
      type: timeBox.type,
      progress: timeRemaining !== null ? 100 - Math.round((timeRemaining / (timeBox.duration * 60)) * 100) : 0
    };
  }, [session, activeTimeBox, timeRemaining]);
  
  const activeTimeBoxDetails = useMemo(() => 
    getActiveTimeBoxDetails()
  , [getActiveTimeBoxDetails]);

  // Update viewport measurements
  useEffect(() => {
    if (!activeTimeBox) return;
    
    const updateMeasurements = () => {
      setViewportHeight(window.innerHeight);
    };
    
    // Initial measurement
    updateMeasurements();
    
    // Throttle resize events
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateMeasurements, 100);
    };
    
    // Update on resize with throttling
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [activeTimeBox]);
  
  // Update scroll progress based on timer position
  useMotionValueEvent(scrollY, "change", () => {
    if (!timerCardRef.current || !viewportHeight) return;
    
    // Get the latest timer card position
    const rect = timerCardRef.current.getBoundingClientRect();
    
    // Calculate how far the timer is off the screen (normalized 0-1)
    // 0 = fully visible at the top, 1 = fully scrolled out of view
    const timerTopPercent = Math.max(0, Math.min(1, -rect.top / (rect.height * 0.8)));
    
    // Calculate the visibility based on viewport position
    // Lower values = more of the timer is visible in the viewport
    // Higher values = less of the timer is visible
    scrollProgress.set(timerTopPercent);
    
    // Use a threshold with hysteresis to prevent flickering
    // We want the floating timer to appear when the main timer is mostly off screen
    // And disappear when the main timer is mostly on screen
    // The difference in thresholds creates a "sticky" effect
    const shouldBeVisible = rect.bottom > viewportHeight * 0.3 && rect.top < viewportHeight * 0.6;
    
    // Only update state if visibility actually changed by a significant amount
    // This prevents small scroll movements from toggling visibility
    if (shouldBeVisible !== isTimerVisible && Math.abs(rect.top - viewportHeight * 0.5) > 50) {
      setIsTimerVisible(shouldBeVisible);
    }
    
    // Also update the ref for non-reactive use
    isFloatingTimerShown.current = !shouldBeVisible && activeTimeBox !== null && timeRemaining !== null;
  });

  // Set up intersection observer as a backup and for initial detection
  useEffect(() => {
    if (!activeTimeBox || !timerCardRef.current) return;
    
    // First, mark as initialized to allow floating timer to show
    isFloatingTimerInitialized.current = true;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Save intersection ratio for backup
        intersectionRatio.current = entry.intersectionRatio;
        
        // If scrollProgress is not being properly set by the scroll event,
        // use intersection ratio as a fallback
        if (entry.intersectionRatio < 0.5 && scrollProgress.get() === 0) {
          scrollProgress.set(1 - entry.intersectionRatio);
        }
      },
      { 
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: "-10% 0px" 
      }
    );
    
    observer.observe(timerCardRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [activeTimeBox, scrollProgress]);

  // Get badge styles based on session status
  const getSessionStatusBadge = () => {
    if (!session) return null;
    
    if (isSessionComplete) {
      return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/60">
        <Icon icon={CheckCircle2} color="default" size="sm" />
        Completed
      </Badge>;
    }
    
    if (activeTimeBox) {
      return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/60">
        <Icon icon={Clock} color="default" size="sm" />
        In Progress
      </Badge>;
    }
    
    return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/60">
      <Icon icon={Calendar} color="default" size="sm" />
      Planned
    </Badge>;
  };

  // Calculate work and break durations
  const workDuration = session ? session.storyBlocks.reduce(
    (total, story) => total + story.timeBoxes.filter(box => box.type === 'work').reduce(
      (sum, box) => sum + box.duration, 0
    ), 0
  ) : 0;

  const breakDuration = session ? session.storyBlocks.reduce(
    (total, story) => total + story.timeBoxes.filter(box => box.type !== 'work').reduce(
      (sum, box) => sum + box.duration, 0
    ), 0
  ) : 0;

  // Handle complete action for floating timer
  const handleFloatingComplete = useCallback(() => {
    if (activeTimeBox) {
      completeTimeBox(activeTimeBox.storyId, activeTimeBox.timeBoxIndex);
    }
  }, [activeTimeBox, completeTimeBox]);

  // Initialize the floating timer visibility when a timebox is active
  useEffect(() => {
    if (activeTimeBox !== null && timeRemaining !== null) {
      isFloatingTimerInitialized.current = true;
      if (!isTimerVisible) {
        setStableFloatingVisible(true);
      }
    }
  }, [activeTimeBox, timeRemaining, isTimerVisible]);
  
  // Debounce the visibility changes to prevent flickering
  useEffect(() => {
    const shouldShow = !isTimerVisible && activeTimeBox !== null && timeRemaining !== null && isFloatingTimerInitialized.current;
    const debounceTime = 200; // ms
    
    const timer = setTimeout(() => {
      setStableFloatingVisible(shouldShow);
    }, debounceTime);
    
    return () => clearTimeout(timer);
  }, [isTimerVisible, activeTimeBox, timeRemaining]);

  // Debug log
  useEffect(() => {
    console.log('Timer state:', { 
      activeTimeBox, 
      timeRemaining, 
      isTimerRunning,
      stableFloatingVisible,
      isTimerVisible
    });
  }, [activeTimeBox, timeRemaining, isTimerRunning, stableFloatingVisible, isTimerVisible]);

  // Time adjustment drawer state
  const [showTimeAdjust, setShowTimeAdjust] = useState(false);
  
  // Function to adjust timer
  const adjustTimer = useCallback((minutes: number) => {
    if (timeRemaining !== null && activeTimeBox) {
      // Ensure we don't go below zero
      const newTime = Math.max(0, timeRemaining + (minutes * 60));
      // Use the updateTimeRemaining function from the useSession hook
      updateTimeRemaining(newTime);
    }
  }, [timeRemaining, activeTimeBox, updateTimeRemaining]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-lg text-muted-foreground">Loading session...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <div className="flex items-center">
          <XCircle className="h-5 w-5 text-red-600" />
          <h3 className="ml-2 text-lg font-medium">Error loading session</h3>
        </div>
        <p className="mt-2 text-sm">{error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
        <div className="flex items-center">
          <Icon icon={Calendar} color="default" size="sm" />
          <h3 className="ml-2 text-lg font-medium">No session found</h3>
        </div>
        <p className="mt-2 text-sm">There is no session scheduled for this date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Floating Timer - Separated into stable container and content */}
      <FloatingTimerContainer 
        isVisible={stableFloatingVisible}
        springOpacity={springOpacity}
        springY={springY}
        springScale={springScale}
      >
        <FloatingTimerWrapper
          title={activeTimeBoxDetails?.title || 'Current Timebox'}
          formattedTime={currentFormattedTime}
          isTimerRunning={isTimerRunning}
          timeRemaining={timeRemaining}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onComplete={handleFloatingComplete}
          showRed={timeRemaining !== null && timeRemaining < 60}
          timeBoxType={activeTimeBoxDetails?.timeBox.type}
          onAdjustTime={adjustTimer}
          onGoToTimeline={scrollToActiveTimeBox}
        />
      </FloatingTimerContainer>
      
      {/* Session Header with Card Design */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-2 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl font-bold">
              Session for {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-300">
                <Icon icon={Clock} color="muted" size="sm" />
                <span>Total: {Math.floor(session.totalDuration / 60)}h {session.totalDuration % 60}m</span>
              </Badge>
              
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 bg-secondary/20 border-secondary/30">
                <Icon icon={CheckCircle2} color="default" size="sm" />
                <span>Work: {Math.floor(workDuration / 60)}h {workDuration % 60}m</span>
              </Badge>
              
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 bg-secondary/20 border-secondary/30">
                <Icon icon={Pause} color="default" size="sm" />
                <span>Breaks: {Math.floor(breakDuration / 60)}h {breakDuration % 60}m</span>
              </Badge>
              
              {getSessionStatusBadge()}
            </div>
          </CardHeader>
          <CardContent>
            {/* Replace the simple progress bar with detailed metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-1 mt-1">
              {/* Card 1: Completed Frogs (Stories) */}
              <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 rounded-lg p-3 flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 mb-1">
                  <LiaFrogSolid className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">Frogs Completed</span>
                <span className="text-lg font-bold">
                  {session.storyBlocks.filter(story => 
                    story.timeBoxes.every(box => box.type === 'work' ? box.status === 'completed' : true)
                  ).length}
                  <span className="text-sm font-medium text-violet-500/70 dark:text-violet-400/70"> / {session.storyBlocks.length}</span>
                </span>
              </div>
              
              {/* Card 2: Completed Tasks */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 mb-1">
                  <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Tasks Completed</span>
                <span className="text-lg font-bold">
                  {session.storyBlocks.reduce(
                    (sum, story) => sum + story.timeBoxes.reduce(
                      (boxSum, box) => boxSum + (box.tasks?.filter(t => t.status === 'completed').length || 0), 0
                    ), 0
                  )}
                  <span className="text-sm font-medium text-emerald-500/70 dark:text-emerald-400/70"> / {
                    session.storyBlocks.reduce(
                      (sum, story) => sum + story.timeBoxes.reduce(
                        (boxSum, box) => boxSum + (box.tasks?.length || 0), 0
                      ), 0
                    )
                  }</span>
                </span>
              </div>
              
              {/* Card 3: Time Worked */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-1">
                  <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Time Worked</span>
                <span className="text-lg font-bold">
                  {/* Calculate time worked based on completed timeboxes */}
                  {(() => {
                    const completedMinutes = session.storyBlocks.reduce(
                      (total, story) => total + story.timeBoxes.filter(box => box.status === 'completed').reduce(
                        (sum, box) => sum + box.duration, 0
                      ), 0
                    );
                    const hours = Math.floor(completedMinutes / 60);
                    const minutes = completedMinutes % 60;
                    return `${hours}h ${minutes}m`;
                  })()}
                </span>
              </div>
              
              {/* Card 4: Time Remaining */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 mb-1">
                  <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Time Remaining</span>
                <span className="text-lg font-bold">
                  {(() => {
                    const totalMinutes = session.totalDuration;
                    const completedMinutes = session.storyBlocks.reduce(
                      (total, story) => total + story.timeBoxes.filter(box => box.status === 'completed').reduce(
                        (sum, box) => sum + box.duration, 0
                      ), 0
                    );
                    const remainingMinutes = totalMinutes - completedMinutes;
                    const hours = Math.floor(remainingMinutes / 60);
                    const minutes = remainingMinutes % 60;
                    return `${hours}h ${minutes}m`;
                  })()}
                </span>
              </div>
              
              {/* Card 5: Completion Rate */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg p-3 flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 mb-1">
                  <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Progress Rate</span>
                <span className="text-lg font-bold">
                  {completedPercentage}%
                  <span className="text-sm font-medium text-indigo-500/70 dark:text-indigo-400/70"> completed</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Timer Card - Responsive position */}
        {activeTimeBox !== null && (
          <Card 
            ref={timerCardRef}
            className="timer-card-container transform-gpu"
            style={{
              borderColor: "var(--timer-border-color)",
              background: "var(--timer-background)"
            }}
          >
            {/* Sparkle decoration elements */}
            <div className="sparkle-decoration">
              <div className="sparkle-dot"></div>
              <div className="sparkle-dot"></div>
              <div className="sparkle-dot"></div>
              <div className="sparkle-dot"></div>
              <div className="sparkle-dot"></div>
            </div>
            <div className="shine-line"></div>
            
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-center">Active Timer</CardTitle>
              <div className="mt-2 relative">
                <TimerDisplay 
                  time={currentFormattedTime} 
                  showRed={timeRemaining !== null && timeRemaining < 60} 
                />
                {/* Add edit button for timer adjustment */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowTimeAdjust(!showTimeAdjust)}
                        className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity pr-4"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Edit Timer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription className="mt-3 flex flex-col items-center gap-2">
                <span className="font-medium text-sm">{activeTimeBoxDetails?.title || 'Loading...'}</span>
                <Badge variant="outline" className={cn(
                  "font-normal",
                  activeTimeBoxDetails?.timeBox.type === 'work' 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-400"
                    : activeTimeBoxDetails?.timeBox.type === 'short-break' || activeTimeBoxDetails?.timeBox.type === 'long-break'
                      ? "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-400"
                      : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                )}>
                  {activeTimeBoxDetails?.timeBox.type === 'work' ? 'Focus' : activeTimeBoxDetails?.timeBox.type === 'short-break' ? 'Short Break' : activeTimeBoxDetails?.timeBox.type === 'long-break' ? 'Long Break' : 'Break'}
                </Badge>
              </CardDescription>
            </CardHeader>
            
            {/* Time Adjustment Drawer */}
            <AnimatePresence>
              {showTimeAdjust && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-3"
                >
                  <div className="border border-transparent rounded-lg p-3 bg-transparent">
                    <h4 className="text-xs font-medium text-center mb-2 text-muted-foreground">Add/Remove Time</h4>
                    <div className="flex justify-center items-center gap-2 mx-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-1.5 text-xs bg-white dark:bg-gray-900 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        onClick={() => adjustTimer(-5)}
                      >
                        <ChevronLeft className="h-3 w-3 mr-0.5" />
                        <ChevronLeft className="h-3 w-3 -ml-1.5" />
                        <span className="ml-0.5 text-[10px] font-bold">-5m</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-1.5 text-xs bg-white dark:bg-gray-900 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        onClick={() => adjustTimer(-1)}
                      >
                        <ChevronLeft className="h-3 w-3 mr-0.5" />
                        <span className="ml-0.5 text-[10px] font-bold">-1m</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-1.5 text-xs bg-white dark:bg-gray-900 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950/30 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        onClick={() => adjustTimer(1)}
                      >
                        <span className="mr-0.5 text-[10px] font-bold">+1m</span>
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-1.5 text-xs bg-white dark:bg-gray-900 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950/30 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                        onClick={() => adjustTimer(5)}
                      >
                        <span className="mr-0.5 text-[10px] font-bold">+5m</span>
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                        <ChevronRight className="h-3 w-3 -ml-1.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <CardContent className="pb-2">
              <Progress 
                value={100 - (activeTimeBoxDetails?.progress || 0)} 
                className="h-2 mb-1 bg-gray-100 dark:bg-gray-800" 
                indicatorClassName="timebox-progress-gradient"
              />
            </CardContent>
            <CardFooter className="pt-0 pb-4 flex justify-center">
              <div className="flex justify-center gap-6 w-full max-w-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={resetTimer}
                        disabled={!activeTimeBox}
                        className="h-10 w-10 rounded-full"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Reset timer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {isTimerRunning ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={pauseTimer}
                          className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Pause timer</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={resumeTimer}
                          className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                          disabled={!activeTimeBox || timeRemaining === 0}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Resume timer</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => activeTimeBox && completeTimeBox(activeTimeBox.storyId, activeTimeBox.timeBoxIndex)}
                        className="h-10 w-10 rounded-full bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/50"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Complete this timebox</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Add vertical timeline view - this shows a React-Chrono inspired visual progress timeline */}
      <div className="mt-8" ref={timelineRef}>
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Session Progress</CardTitle>
            <CardDescription>
              Track your progress through the session with this interactive timeline
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <VerticalTimeline 
              storyBlocks={session.storyBlocks}
              activeTimeBoxId={activeTimeBox ? `${activeTimeBox.storyId}-box-${activeTimeBox.timeBoxIndex}` : undefined}
              activeStoryId={activeTimeBox?.storyId}
              startTime={session.lastUpdated || new Date().toISOString()}
              completedPercentage={completedPercentage}
              onTaskClick={handleTaskClick}
              onTimeBoxClick={(storyId, timeBoxIndex) => {
                const story = session.storyBlocks.find(s => s.id === storyId);
                if (!story) return;
                
                const timeBox = story.timeBoxes[timeBoxIndex];
                if (!timeBox) return;
                
                if (isCurrentTimeBox(timeBox)) {
                  // If already current, show details instead
                  console.log("Show details for current timebox:", timeBox);
                }
              }}
              onStartTimeBox={startTimeBox}
              onCompleteTimeBox={(storyId, timeBoxIndex) => {
                completeTimeBox(storyId, timeBoxIndex);
              }}
              onUndoCompleteTimeBox={(storyId, timeBoxIndex) => {
                undoCompleteTimeBox(storyId, timeBoxIndex);
              }}
              onStartSessionDebrief={(duration) => {
                // Create a synthetic timebox for the debrief
                const debriefId = "session-debrief";
                
                // Set up a special timer for the debrief
                // In a real implementation, we could add this to the storyBlocks,
                // but for simplicity we'll just run the timer
                startTimeBox(debriefId, 0, duration);
                
                toast({
                  title: "Debrief Started",
                  description: `Take the next ${duration} minutes to reflect on your session.`,
                })
              }}
              isCompactView={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 