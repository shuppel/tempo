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
  Circle, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useSession } from "../hooks/useSession"
import { SessionStorageService } from "../services/session-storage.service"
import type { Session, TimeBox, TimeBoxTask, StoryBlock } from "@/lib/types"
import { format } from "date-fns"
import { TimeboxView } from './timebox-view'
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

interface SessionViewProps {
  id?: string;
  date?: string;
  storageService?: SessionStorageService;
}

// Separate timer display component to prevent re-animations
const TimerDisplay = React.memo(({ 
  time, 
  showRed 
}: { 
  time: string, 
  showRed: boolean 
}) => (
  <span 
    className={cn(
      "text-xl font-mono font-semibold",
      showRed && "text-red-600 animate-pulse"
    )}
  >
    {time}
  </span>
));

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
  showRed 
}: { 
  title: string;
  formattedTime: string;
  isTimerRunning: boolean;
  timeRemaining: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  showRed: boolean;
}) => (
  <div className="p-3 flex items-center gap-3">
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">
        {title}
      </span>
      <TimerDisplay 
        time={formattedTime} 
        showRed={showRed} 
      />
    </div>
    <div className="flex gap-1">
      {isTimerRunning ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onPause}
                className="h-8 w-8 rounded-full"
              >
                <Pause className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
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
                className="h-8 w-8 rounded-full"
                disabled={timeRemaining === 0}
              >
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Resume</p>
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
              onClick={onComplete}
              className="h-8 w-8 rounded-full text-green-600"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Complete</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
));

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
          className="fixed bottom-4 right-4 z-50 shadow-lg rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 transform-gpu"
          style={{
            opacity: springOpacity,
            y: springY,
            scale: springScale,
          }}
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ 
            type: 'spring', 
            damping: 30, 
            stiffness: 350,
            mass: 1.2
          }}
        >
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
  showRed 
}: { 
  title: string;
  formattedTime: string;
  isTimerRunning: boolean;
  timeRemaining: number | null;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  showRed: boolean;
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
  
  // Track intersection ratio for smooth animation
  const intersectionRatio = useRef(1);
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [timerRect, setTimerRect] = useState({ top: 0, height: 0 });
  
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
    isSessionComplete,
    completedPercentage,
    handleTaskClick,
    startTimeBox,
    pauseTimer,
    resumeTimer,
    resetTimer,
    completeTimeBox,
    isCurrentTimeBox
  } = useSession({ id: sessionId, storageService });

  // State for active time update
  const [currentFormattedTime, setCurrentFormattedTime] = useState('00:00');
  
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
      
      if (timerCardRef.current) {
        const rect = timerCardRef.current.getBoundingClientRect();
        setTimerRect({ top: rect.top, height: rect.height });
      }
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
  useMotionValueEvent(scrollY, "change", (latest) => {
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
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Completed
      </Badge>;
    }
    
    if (activeTimeBox) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="mr-1 h-3 w-3 animate-pulse" />
        In Progress
      </Badge>;
    }
    
    return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
      <Calendar className="mr-1 h-3 w-3" />
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

  // Stable visibility state for floating timer
  const [stableFloatingVisible, setStableFloatingVisible] = useState(false);
  
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
          <Calendar className="h-5 w-5 text-yellow-600" />
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
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Total: {Math.floor(session.totalDuration / 60)}h {session.totalDuration % 60}m</span>
              </Badge>
              
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 bg-indigo-50 border-indigo-200">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>Work: {Math.floor(workDuration / 60)}h {workDuration % 60}m</span>
              </Badge>
              
              <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 bg-teal-50 border-teal-200">
                <Pause className="h-4 w-4 text-teal-600" />
                <span>Breaks: {Math.floor(breakDuration / 60)}h {breakDuration % 60}m</span>
              </Badge>
              
              {getSessionStatusBadge()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2 mt-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-semibold">{completedPercentage}%</span>
            </div>
            <Progress 
              value={completedPercentage} 
              className="h-2.5" 
            />
          </CardContent>
        </Card>

        {/* Active Timer Card - Responsive position */}
        {activeTimeBox !== null && (
          <Card 
            ref={timerCardRef}
            className="border-2 border-yellow-100 bg-white"
          >
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-center">Active Timer</CardTitle>
              <div className="mt-2">
                <TimerDisplay 
                  time={currentFormattedTime} 
                  showRed={timeRemaining !== null && timeRemaining < 60} 
                />
          </div>
              <CardDescription className="mt-1">
                {activeTimeBoxDetails?.title || 'Loading...'} - {activeTimeBoxDetails?.timeBox.type === 'work' ? 'Focus Session' : 'Break'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <Progress 
                value={activeTimeBoxDetails?.progress || 0} 
                className="h-2 mb-1" 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0:00</span>
                <span>{Math.floor((activeTimeBoxDetails?.totalDuration || 0) / 60)}:{((activeTimeBoxDetails?.totalDuration || 0) % 60).toString().padStart(2, '0')}</span>
              </div>
            </CardContent>
            <CardFooter className="pt-0 pb-4 flex justify-center">
              <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
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
                    <TooltipContent>
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
                          className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
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
                          className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          disabled={!activeTimeBox || timeRemaining === 0}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
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
                        className="h-10 w-10 rounded-full bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Complete this timebox</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Session Content */}
      <TimeboxView 
        storyBlocks={session.storyBlocks}
        isCurrentTimeBox={isCurrentTimeBox}
        onTaskClick={handleTaskClick}
        onStartTimeBox={startTimeBox}
        onCompleteTimeBox={completeTimeBox}
        hideOverview={true} // Hide the redundant overview
      />

      {/* Session Footer */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isSessionComplete ? 'Session completed' : `Session in progress: ${completedPercentage}% complete`}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {isSessionComplete ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-green-50 border-green-200 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>All tasks completed</p>
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
                      className="h-9 w-9 rounded-full bg-blue-50 border-blue-200 text-blue-700"
                      onClick={() => {
                        const nextTimeBox = session.storyBlocks.flatMap(story => 
                          story.timeBoxes
                            .map((timeBox, index) => ({ timeBox, storyId: story.id, index }))
                            .filter(item => item.timeBox.type === 'work' && item.timeBox.status === 'todo')
                        )[0];
                        
                        if (nextTimeBox) {
                          startTimeBox(nextTimeBox.storyId, nextTimeBox.index, nextTimeBox.timeBox.duration);
                        }
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start next task</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 