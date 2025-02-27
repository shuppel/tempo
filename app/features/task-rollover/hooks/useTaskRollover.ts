/**
 * useTaskRollover Hook
 * 
 * This hook manages the task rollover functionality, allowing users to carry over incomplete tasks
 * from previous sessions to a new session.
 * 
 * FIXED ISSUES:
 * - Maximum update depth exceeded: Fixed by:
 *   1. Using useRef to track initialization and prevent redundant checks
 *   2. Using localStorage to track last check date instead of component state
 *   3. Using useMemo for computing derived values
 *   4. Carefully controlling re-renders and side effects
 * 
 * - Infinite render loops: Fixed by:
 *   1. Creating a controlled lifecycle for the component with explicit phases
 *   2. Using refs to track one-time operations
 *   3. Limiting API calls and state updates to only happen when necessary
 *   4. Adding safety checks to all methods
 * 
 * DATA MODEL:
 * - IncompleteTask: A task from a previous session that may be carried over
 * - Uses Session and TimeBoxTask models from the main app
 * - Preserves all task metadata needed for proper handling
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TaskRolloverService } from '../services/task-rollover.service';
import { TimeBoxTask, Session } from '@/lib/types';
import { useRouter } from 'next/navigation';

export interface IncompleteTask {
  /** The original task data */
  task: TimeBoxTask;
  /** The title of the story/category this task belongs to */
  storyTitle: string;
  /** The unique ID of the story this task belongs to */
  storyId: string;
  /** The index of the timeBox in the story */
  timeBoxIndex: number;
  /** The index of the task in the timeBox */
  taskIndex: number;
  /** Whether this task is selected for rollover */
  selected: boolean;
}

export interface UseTaskRolloverReturn {
  /** Whether the task selection dialog is open */
  isOpen: boolean;
  /** Set the open state of the task selection dialog */
  setIsOpen: (open: boolean) => void;
  /** Whether there are any incomplete tasks from previous sessions */
  hasIncompleteTasks: boolean;
  /** Whether the service is currently loading data */
  isLoading: boolean;
  /** The most recent active session with incomplete tasks */
  recentSession: Session | null;
  /** List of incomplete tasks that can be rolled over */
  incompleteTasks: IncompleteTask[];
  /** Number of tasks currently selected for rollover */
  selectedCount: number;
  /** Text representation of selected tasks ready for brain dump */
  brainDumpText: string;
  /** Toggle selection status of a specific task */
  toggleTaskSelection: (taskIndex: number) => void;
  /** Select all available tasks */
  selectAllTasks: () => void;
  /** Deselect all tasks */
  deselectAllTasks: () => void;
  /** Mark a task as completed in its original session */
  completeTask: (taskIndex: number) => Promise<void>;
  /** Remove a task from the list without completing it */
  deleteTask: (taskIndex: number) => void;
  /** Finish the rollover process and close the dialog */
  finishRollover: () => void;
  /** Close the dialog and discard all changes */
  closeAndDiscard: () => void;
  /** Navigate to the previous session for debriefing */
  debriefPreviousSession: () => void;
  /** Manually check for incomplete tasks from previous sessions */
  checkForIncompleteTasks: (forceCheck?: boolean, preventAutoPopulate?: boolean) => Promise<void>;
  /** Reset the state of task rollover */
  resetTaskRolloverState: () => void;
  /** Force update of brain dump text based on selected tasks */
  updateBrainDumpText: () => void;
}

// Create a localStorage key to track when we last checked
const LAST_CHECK_KEY = 'task-rollover-last-check';
const SERVICE_ENABLED_KEY = 'task-rollover-enabled';
// Track sessions we've already processed to prevent showing the dialog again
const COMPLETED_TRANSFERS_KEY = 'task-rollover-completed-transfers';

export function useTaskRollover(): UseTaskRolloverReturn {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasIncompleteTasks, setHasIncompleteTasks] = useState(false);
  const [recentSession, setRecentSession] = useState<Session | null>(null);
  const [incompleteTasks, setIncompleteTasks] = useState<IncompleteTask[]>([]);
  const [brainDumpText, setBrainDumpText] = useState('');
  
  // Track if the service is enabled
  const [serviceEnabled, setServiceEnabled] = useState(() => {
    // Read from localStorage with a default of true
    const savedSetting = localStorage.getItem(SERVICE_ENABLED_KEY);
    // Default to enabled if not set
    return savedSetting !== null ? savedSetting === 'true' : true;
  });
  
  // Create a ref to know if we've already performed the check
  const hasCheckedToday = useRef(false);
  
  // Use useMemo to create the service only once
  const rolloverService = useMemo(() => new TaskRolloverService(), []);

  // Get an array of completed transfer session IDs
  const getCompletedTransfers = useCallback((): string[] => {
    try {
      const savedTransfers = localStorage.getItem(COMPLETED_TRANSFERS_KEY);
      if (savedTransfers) {
        return JSON.parse(savedTransfers);
      }
    } catch (error) {
      console.error('[useTaskRollover] Error reading completed transfers:', error);
    }
    return [];
  }, []);

  // Mark a session as having its transfers completed
  const markTransferCompleted = useCallback((sessionDate: string) => {
    try {
      if (!sessionDate) return;
      
      const completedTransfers = getCompletedTransfers();
      // Add the session date if it's not already in the list
      if (!completedTransfers.includes(sessionDate)) {
        completedTransfers.push(sessionDate);
        localStorage.setItem(COMPLETED_TRANSFERS_KEY, JSON.stringify(completedTransfers));
        console.log(`[useTaskRollover] Marked session ${sessionDate} as having completed transfers`);
      }
    } catch (error) {
      console.error('[useTaskRollover] Error marking transfer as completed:', error);
    }
  }, [getCompletedTransfers]);

  // Check if a session's transfers have been completed
  const hasCompletedTransfers = useCallback((sessionDate: string): boolean => {
    if (!sessionDate) return false;
    const completedTransfers = getCompletedTransfers();
    return completedTransfers.includes(sessionDate);
  }, [getCompletedTransfers]);

  // Function to determine if we should check today
  const shouldCheckToday = useCallback(() => {
    if (!serviceEnabled) return false;
    if (hasCheckedToday.current) return false;
    
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    if (!lastCheck) return true;
    
    // Parse the last check date
    const lastCheckDate = new Date(lastCheck);
    const today = new Date();
    
    // Check if the last check was on a different day
    return (
      lastCheckDate.getDate() !== today.getDate() ||
      lastCheckDate.getMonth() !== today.getMonth() ||
      lastCheckDate.getFullYear() !== today.getFullYear()
    );
  }, [serviceEnabled]);

  // Externalize the task checking functionality so it can be triggered manually
  const checkForIncompleteTasks = useCallback(async (forceCheck = false, preventAutoPopulate = false) => {
    console.log("[useTaskRollover] Starting check for incomplete tasks...", {
      serviceEnabled,
      isLoading,
      forceCheck,
      hasCheckedToday: hasCheckedToday.current,
      preventAutoPopulate
    });
    
    // Only proceed if the service is enabled
    if (!serviceEnabled) {
      console.log("[useTaskRollover] Service is disabled, skipping check");
      return;
    }
    
    // Prevent concurrent checks
    if (isLoading) {
      console.log("[useTaskRollover] Already loading data, skipping concurrent check");
      return;
    }
    
    // Check if we've already completed a transfer today - unless forceCheck is true
    if (!forceCheck) {
      const todayFlag = localStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`);
      if (todayFlag) {
        console.log('[useTaskRollover] Already completed a transfer today, skipping check');
        return;
      }
    }
    
    setIsLoading(true);
    try {
      console.log("[useTaskRollover] Checking if any session has incomplete tasks");
      const hasIncomplete = await rolloverService.hasIncompleteTasks();
      console.log(`[useTaskRollover] Found incomplete tasks: ${hasIncomplete}`);
      
      if (preventAutoPopulate) {
        // Just update the state to indicate there are tasks, but don't show dialog
        setHasIncompleteTasks(hasIncomplete);
        console.log(`[useTaskRollover] Set hasIncompleteTasks to ${hasIncomplete} but suppressing auto-display`);
      } else {
        // Normal flow - set state and potentially show dialog
        setHasIncompleteTasks(hasIncomplete);
      
        if (hasIncomplete) {
          console.log("[useTaskRollover] Getting details of incomplete tasks");
          const data = await rolloverService.getIncompleteTasks();
          if (data) {
            // Check if we've already handled transfers for this session - unless forceCheck is true
            if (!forceCheck && hasCompletedTransfers(data.session.date)) {
              console.log(`[useTaskRollover] Skipping session ${data.session.date} as transfers were already completed`);
              setHasIncompleteTasks(false);
              return;
            }
            
            console.log(`[useTaskRollover] Setting recent session with date ${data.session.date} and ${data.tasks.length} tasks`);
            setRecentSession(data.session);
            setIncompleteTasks(
              data.tasks.map(task => ({
                ...task,
                selected: true // Select all by default
              }))
            );
          } else {
            console.log("[useTaskRollover] No task data returned despite hasIncomplete being true");
          }
        } else {
          console.log("[useTaskRollover] No incomplete tasks found in any session");
        }
      }
      
      // Record that we've checked today
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
      hasCheckedToday.current = true;
      console.log("[useTaskRollover] Marked as checked today", new Date().toISOString());
    } catch (error) {
      console.error('[useTaskRollover] Error checking for incomplete tasks:', error);
    } finally {
      setIsLoading(false);
      console.log("[useTaskRollover] Completed check for incomplete tasks");
    }
  }, [serviceEnabled, isLoading, rolloverService, hasCompletedTransfers]);

  // Improve the initial effect to provide better logging
  // Run the check only once when the component mounts
  useEffect(() => {
    // Add a flag to indicate if we should automatically show dialogs or not
    const preventAutoPopulate = true; // Default to preventing auto-population
    
    const shouldCheck = shouldCheckToday() && !hasCheckedToday.current;
    console.log(`[useTaskRollover] Initial effect - Should check today: ${shouldCheck}`, {
      shouldCheckResult: shouldCheckToday(),
      hasCheckedTodayRef: hasCheckedToday.current,
      lastCheck: localStorage.getItem(LAST_CHECK_KEY),
      preventAutoPopulate
    });
    
    if (shouldCheck) {
      console.log("[useTaskRollover] Starting initial check for incomplete tasks");
      if (preventAutoPopulate) {
        // Only check for tasks but don't show dialog automatically
        checkForIncompleteTasks(false, true).then(() => {
          console.log("[useTaskRollover] Found incomplete tasks but preventing auto-display");
        });
      } else {
        // Old behavior - auto-show dialog (we no longer want this)
        checkForIncompleteTasks(false, false);
      }
    } else {
      console.log("[useTaskRollover] Skipping initial check because:", { 
        serviceEnabled,
        hasCheckedToday: hasCheckedToday.current,
        lastCheck: localStorage.getItem(LAST_CHECK_KEY)
      });
    }
    
    // Add a cleanup function that resets the check flag when the component unmounts
    return () => {
      console.log("[useTaskRollover] Component unmounting, resetting hasCheckedToday flag");
      hasCheckedToday.current = false;
    };
  }, [shouldCheckToday, checkForIncompleteTasks]);

  // Calculate selected task count efficiently
  const selectedCount = useMemo(() => {
    return incompleteTasks.filter(t => t.selected).length;
  }, [incompleteTasks]);

  // Update brain dump text when incompleteTasks changes
  // Using useEffect to prevent recalculating during renders
  useEffect(() => {
    updateBrainDumpText();
  }, [incompleteTasks]);

  // Function to update brain dump text from selected tasks
  const updateBrainDumpText = useCallback(() => {
    const selectedTasks = incompleteTasks
      .filter(t => t.selected)
      .map(({ task, storyTitle }) => ({ task, storyTitle }));
    
    console.log(`[useTaskRollover] Updating brain dump text with ${selectedTasks.length} selected tasks`);
    
    if (selectedTasks.length > 0) {
      try {
        const text = rolloverService.convertTasksToBrainDumpFormat(selectedTasks);
        console.log(`[useTaskRollover] Generated brain dump text: ${text.length} chars for ${selectedTasks.length} tasks`);
        setBrainDumpText(text);
      } catch (error) {
        console.error('[useTaskRollover] Error generating brain dump text:', error);
        setBrainDumpText(''); // Reset on error
      }
    } else {
      console.log('[useTaskRollover] No selected tasks, clearing brain dump text');
      setBrainDumpText('');
    }
  }, [incompleteTasks, rolloverService]);

  // Toggle selection of a task - this won't trigger unnecessary renders
  const toggleTaskSelection = useCallback((taskIndex: number) => {
    if (taskIndex < 0 || taskIndex >= incompleteTasks.length) {
      return; // Prevent out-of-bounds access
    }
    
    setIncompleteTasks(prevTasks => 
      prevTasks.map((task, index) => 
        index === taskIndex 
          ? { ...task, selected: !task.selected } 
          : task
      )
    );
  }, [incompleteTasks.length]);

  // Select all tasks
  const selectAllTasks = useCallback(() => {
    setIncompleteTasks(tasks => 
      tasks.map(task => ({ ...task, selected: true }))
    );
  }, []);

  // Deselect all tasks
  const deselectAllTasks = useCallback(() => {
    setIncompleteTasks(tasks => 
      tasks.map(task => ({ ...task, selected: false }))
    );
  }, []);

  // Mark a task as completed in its original session
  const completeTask = useCallback(async (taskIndex: number) => {
    if (!recentSession) return;
    
    const task = incompleteTasks[taskIndex];
    if (!task) return;
    
    try {
      const success = await rolloverService.completeTask(
        recentSession.date,
        task.storyId,
        task.timeBoxIndex,
        task.taskIndex
      );
      
      if (success) {
        // Remove the task from the list
        setIncompleteTasks(tasks => 
          tasks.filter((_, index) => index !== taskIndex)
        );
      }
    } catch (error) {
      console.error('Error completing task:', error);
    }
  }, [recentSession, incompleteTasks, rolloverService]);

  // Delete a task from the rollover (without completing it)
  const deleteTask = useCallback((taskIndex: number) => {
    setIncompleteTasks(tasks => 
      tasks.filter((_, index) => index !== taskIndex)
    );
  }, []);

  // Finish rollover and return the selected tasks for brain dump
  const finishRollover = useCallback(() => {
    if (recentSession) {
      // Mark this session as having completed transfers
      markTransferCompleted(recentSession.date);
      
      // Mitigate unselected tasks if there are any
      const unselectedTasks = incompleteTasks
        .filter(task => !task.selected)
        .map(task => ({
          selected: false,
          storyId: task.storyId,
          timeBoxIndex: task.timeBoxIndex,
          taskIndex: task.taskIndex
        }));
      
      if (unselectedTasks.length > 0) {
        rolloverService.mitigateUnselectedTasks(recentSession.date, unselectedTasks)
          .then(success => {
            console.log(`[useTaskRollover] Mitigated ${unselectedTasks.length} unselected tasks: ${success ? 'success' : 'failed'}`);
          })
          .catch(error => {
            console.error('[useTaskRollover] Error mitigating unselected tasks:', error);
          });
      }
    }
    
    // Ensure brain dump text is up-to-date with the current selected tasks
    console.log('[useTaskRollover] Finalizing brain dump text before closing dialog');
    updateBrainDumpText();
    
    // Reset the state of task rollover
    hasCheckedToday.current = true; // Prevent re-checking
    setHasIncompleteTasks(false); // Critical: ensure no more dialogs show up
    
    // Close the dialog
    setIsOpen(false);
    
    // Store transfer completion in localStorage to ensure persistence across page loads
    if (recentSession) {
      try {
        // Add an extra entry with today's date to prevent checks on page refresh
        localStorage.setItem(`${COMPLETED_TRANSFERS_KEY}-today`, new Date().toISOString());
      } catch (error) {
        console.error('[useTaskRollover] Error storing transfer completion:', error);
      }
    }
  }, [recentSession, incompleteTasks, rolloverService, markTransferCompleted, updateBrainDumpText]);

  // Close the rollover and discard all changes
  const closeAndDiscard = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Navigate to the previous session for debriefing
  const debriefPreviousSession = useCallback(() => {
    if (recentSession) {
      // Mark as checked for today to prevent rechecking
      hasCheckedToday.current = true;
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
      router.push(`/session/${recentSession.date}`);
    }
  }, [recentSession, router]);

  // Toggle the service enabled state
  const toggleServiceEnabled = useCallback(() => {
    setServiceEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem(SERVICE_ENABLED_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Update the resetTaskRolloverState function to provide more logs
  // Reset all state - useful for debugging or manual reset
  const resetTaskRolloverState = useCallback(() => {
    console.log("[useTaskRollover] Starting reset of task rollover state");
    console.log("[useTaskRollover] Current state:", {
      lastCheck: localStorage.getItem(LAST_CHECK_KEY),
      todayFlag: localStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`),
      hasCheckedToday: hasCheckedToday.current,
      hasIncompleteTasks,
      serviceEnabled,
      completedTransfers: getCompletedTransfers()
    });
    
    // Clear localStorage entries
    localStorage.removeItem(LAST_CHECK_KEY);
    // Also clear the today flag to prevent showing the dialog again
    localStorage.removeItem(`${COMPLETED_TRANSFERS_KEY}-today`);
    // Don't clear the service enabled setting or completed transfers list
    
    // Reset all in-memory state
    hasCheckedToday.current = false;
    setHasIncompleteTasks(false);
    setRecentSession(null);
    setIncompleteTasks([]);
    setIsOpen(false);
    
    console.log('[useTaskRollover] Task rollover state has been fully reset');
    console.log("[useTaskRollover] New state:", {
      lastCheck: localStorage.getItem(LAST_CHECK_KEY),
      todayFlag: localStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`),
      hasCheckedToday: hasCheckedToday.current,
      hasIncompleteTasks: false,
      serviceEnabled,
      completedTransfers: getCompletedTransfers()
    });
    
    return true;
  }, [serviceEnabled, hasIncompleteTasks, getCompletedTransfers]);

  return {
    isOpen,
    setIsOpen,
    hasIncompleteTasks,
    isLoading,
    recentSession,
    incompleteTasks,
    selectedCount,
    brainDumpText,
    toggleTaskSelection,
    selectAllTasks,
    deselectAllTasks,
    completeTask,
    deleteTask,
    finishRollover,
    closeAndDiscard,
    debriefPreviousSession,
    checkForIncompleteTasks,
    resetTaskRolloverState,
    updateBrainDumpText
  };
} 