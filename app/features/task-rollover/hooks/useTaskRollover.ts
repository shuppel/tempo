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
import { TimeBoxTask, TodoWorkPlan } from '@/lib/types';
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
  workplan: TodoWorkPlan | null;
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
  debriefPreviousWorkPlan: () => void;
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

// Helper function for safely accessing localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
};

export function useTaskRollover(): UseTaskRolloverReturn {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasIncompleteTasks, setHasIncompleteTasks] = useState(false);
  const [workplan, setWorkplan] = useState<TodoWorkPlan | null>(null);
  const [incompleteTasks, setIncompleteTasks] = useState<IncompleteTask[]>([]);
  const [brainDumpText, setBrainDumpText] = useState('');
  
  // Track if the service is enabled
  const [serviceEnabled, setServiceEnabled] = useState(() => {
    // Read from localStorage with a default of true
    const savedSetting = safeLocalStorage.getItem(SERVICE_ENABLED_KEY);
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
      const savedTransfers = safeLocalStorage.getItem(COMPLETED_TRANSFERS_KEY);
      if (savedTransfers) {
        return JSON.parse(savedTransfers);
      }
    } catch (error) {
      console.error('[useTaskRollover] Error reading completed transfers:', error);
    }
    return [];
  }, []);

  // Mark a specific session as having completed its transfers
  // If no date is provided, use the current recentSession
  const markTransferCompleted = useCallback(async (workplanId?: string) => {
    const id = workplanId || workplan?.id;
    
    if (!id) {
      console.warn('[useTaskRollover] Cannot mark transfers completed without a workplan ID');
      return;
    }
    
    console.log(`[useTaskRollover] Marking session ${id} as having completed transfers`);
    
    try {
      // Add to the list of completed transfers in localStorage
      const completedTransfers = getCompletedTransfers();
      if (!completedTransfers.includes(id)) {
        completedTransfers.push(id);
        safeLocalStorage.setItem(COMPLETED_TRANSFERS_KEY, JSON.stringify(completedTransfers));
      }
      
      // Also set today's date as the last check date
      safeLocalStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    } catch (error) {
      console.error('[useTaskRollover] Error marking transfers completed:', error);
    }
  }, [workplan, getCompletedTransfers]);

  // Check if a session's transfers have been completed
  const hasCompletedTransfers = useCallback((workplanId: string): boolean => {
    if (!workplanId) return false;
    const completedTransfers = getCompletedTransfers();
    return completedTransfers.includes(workplanId);
  }, [getCompletedTransfers]);

  // Function to determine if we should check today
  const shouldCheckToday = useCallback(() => {
    if (!serviceEnabled) return false;
    if (hasCheckedToday.current) return false;
    
    const lastCheck = safeLocalStorage.getItem(LAST_CHECK_KEY);
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
      const todayFlag = safeLocalStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`);
      if (todayFlag) {
        console.log('[useTaskRollover] Already completed a transfer today, skipping check');
        return;
      }
    }
    
    setIsLoading(true);
    try {
      console.log("[useTaskRollover] Checking if any session has incomplete tasks");
      
      // Start by checking if there are incomplete tasks in any session
      const hasIncomplete = await rolloverService.hasIncompleteTasks();
      
      // If no incomplete tasks are found, we can stop here
      if (!hasIncomplete) {
        console.log("[useTaskRollover] No incomplete tasks found in any session");
        setHasIncompleteTasks(false);
        setIsLoading(false);
        return;
      }
      
      // Get the specific tasks that are incomplete
      const result = await rolloverService.getIncompleteTasks();
      
      // If no specific incomplete task data, something went wrong
      if (!result) {
        console.log("[useTaskRollover] No incomplete task data found");
        setHasIncompleteTasks(false);
        setIsLoading(false);
        return;
      }
      
      // Debug log all tasks for troubleshooting
      console.log("[useTaskRollover] Incomplete tasks detail:", 
        result.tasks.map(t => ({
          title: t.task.title,
          status: t.task.status
        }))
      );
      
      // Check if all tasks are already mitigated - if so, no need to show rollover
      const allTasksMitigated = result.tasks.every(
        task => task.task.status === 'mitigated'
      );
      
      if (allTasksMitigated) {
        console.log("[useTaskRollover] All incomplete tasks are already mitigated, no need for rollover");
        setHasIncompleteTasks(false);
        setIsLoading(false);
        return;
      }
      
      console.log(`[useTaskRollover] Found ${result.tasks.length} incomplete tasks in session ${result.workplan.id}`);
      
      // Set session data
      setHasIncompleteTasks(true);
      setWorkplan(result.workplan);
      
      // Map tasks with selected property for UI
      const formattedTasks = result.tasks.map(task => ({
        ...task,
        selected: true // Select all tasks by default
      }));
      
      setIncompleteTasks(formattedTasks);
      
      // Create brain dump text from all tasks
      if (!preventAutoPopulate) {
        const taskText = rolloverService.convertTasksToBrainDumpFormat(
          formattedTasks.map(t => ({
            task: t.task,
            storyTitle: t.storyTitle
          }))
        );
        setBrainDumpText(taskText);
      } else {
        console.log("[useTaskRollover] Preventing auto-population of brain dump");
      }
      
      console.log("[useTaskRollover] Check complete, found incomplete tasks");
      
      if (!hasCompletedTransfers(result.workplan.id)) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error("[useTaskRollover] Error checking for incomplete tasks:", error);
      setHasIncompleteTasks(false);
    } finally {
      setIsLoading(false);
      hasCheckedToday.current = true;
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
      lastCheck: safeLocalStorage.getItem(LAST_CHECK_KEY),
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
        lastCheck: safeLocalStorage.getItem(LAST_CHECK_KEY)
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
        const taskText = rolloverService.convertTasksToBrainDumpFormat(selectedTasks);
        console.log(`[useTaskRollover] Generated brain dump text: ${taskText.length} chars for ${selectedTasks.length} tasks`);
        setBrainDumpText(taskText);
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
    if (!workplan) return;
    
    const task = incompleteTasks[taskIndex];
    if (!task) return;
    
    try {
      const success = await rolloverService.completeTask(
        workplan.id,
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
  }, [workplan, incompleteTasks, rolloverService]);

  // Delete a task from the rollover (without completing it)
  const deleteTask = useCallback((taskIndex: number) => {
    setIncompleteTasks(tasks => 
      tasks.filter((_, index) => index !== taskIndex)
    );
  }, []);

  // Finish the rollover, close the dialog, and transfer tasks to brain dump
  const finishRollover = useCallback(async () => {
    console.log('[useTaskRollover] Finishing rollover');
    
    // Mark transfer as completed for today to prevent rechecking
    await markTransferCompleted(workplan?.id);
    
    // If there's a previous session and there are selected tasks to be rolled over,
    // we need to update the status of tasks in the previous session
    if (workplan && incompleteTasks.length > 0) {
      try {
        // Mark all unselected tasks as "mitigated" so they're not counted for rollover again
        const taskInfos = incompleteTasks.map((task, index) => ({
          selected: task.selected,
          storyId: task.storyId,
          timeBoxIndex: task.timeBoxIndex,
          taskIndex: task.taskIndex,
        }));
        
        console.log('[useTaskRollover] Mitigating unselected tasks in previous session');
        await rolloverService.mitigateUnselectedTasks(workplan.id, taskInfos);
        
        // For selected tasks, update them to indicate they were rolled over
        // We'll do this by getting the session again after mitigation and updating it
        try {
          const updatedWorkplan = await rolloverService.getMostRecentWorkPlanWithIncompleteTasks();
          if (updatedWorkplan && updatedWorkplan.id === workplan.id) {
            // Find selected tasks in our incompleteTasks list
            const selectedTasks = incompleteTasks
              .filter(task => task.selected)
              .map(task => ({
                title: task.task.title,
                storyId: task.storyId,
                timeBoxIndex: task.timeBoxIndex,
                taskIndex: task.taskIndex,
              }));
              
            console.log(`[useTaskRollover] Marking ${selectedTasks.length} tasks as rolledOver in previous session`);
            
            // Update these tasks in the original session to mark as rolled over
            await Promise.all(selectedTasks.map(async taskInfo => {
              await rolloverService.markTaskRolledOver(
                updatedWorkplan.id,
                taskInfo.storyId,
                taskInfo.timeBoxIndex,
                taskInfo.taskIndex
              );
            }));
          }
        } catch (error) {
          console.error('[useTaskRollover] Error updating tasks as rolled over:', error);
        }
        
        // Archive the previous session now that we're done with it
        console.log('[useTaskRollover] Archiving previous session:', workplan.id);
        const archived = await rolloverService.archiveWorkPlan(workplan.id);
        if (archived) {
          console.log('[useTaskRollover] Previous session archived successfully');
        } else {
          console.error('[useTaskRollover] Failed to archive previous session');
        }
      } catch (error) {
        console.error('[useTaskRollover] Error during task rollover completion:', error);
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
    if (workplan) {
      try {
        // Add an extra entry with today's date to prevent checks on page refresh
        safeLocalStorage.setItem(`${COMPLETED_TRANSFERS_KEY}-today`, new Date().toISOString());
      } catch (error) {
        console.error('[useTaskRollover] Error storing transfer completion:', error);
      }
    }
  }, [workplan, incompleteTasks, rolloverService, markTransferCompleted, updateBrainDumpText]);

  // Close the rollover and discard all changes
  const closeAndDiscard = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Navigate to the previous session for debriefing
  const debriefPreviousWorkPlan = useCallback(() => {
    if (workplan) {
      // Mark as checked for today to prevent rechecking
      hasCheckedToday.current = true;
      safeLocalStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
      router.push(`/workplan/${workplan.id}`);
    }
  }, [workplan, router]);

  // Toggle the service enabled state
  const toggleServiceEnabled = useCallback(() => {
    setServiceEnabled(prev => {
      const newValue = !prev;
      safeLocalStorage.setItem(SERVICE_ENABLED_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Update the resetTaskRolloverState function to provide more logs
  // Reset all state - useful for debugging or manual reset
  const resetTaskRolloverState = useCallback(() => {
    console.log("[useTaskRollover] Starting reset of task rollover state");
    console.log("[useTaskRollover] Current state:", {
      lastCheck: safeLocalStorage.getItem(LAST_CHECK_KEY),
      todayFlag: safeLocalStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`),
      hasCheckedToday: hasCheckedToday.current,
      hasIncompleteTasks,
      serviceEnabled,
      completedTransfers: getCompletedTransfers(),
      workplanId: workplan?.id
    });
    
    // Clear localStorage entries
    safeLocalStorage.removeItem(LAST_CHECK_KEY);
    // Also clear the today flag to prevent showing the dialog again
    safeLocalStorage.removeItem(`${COMPLETED_TRANSFERS_KEY}-today`);
    // Don't clear the service enabled setting
    
    // Clear session-specific completed transfers to force reevaluation
    if (workplan?.id) {
      const transfers = getCompletedTransfers();
      const updatedTransfers = transfers.filter(date => date !== workplan.id);
      safeLocalStorage.setItem(COMPLETED_TRANSFERS_KEY, JSON.stringify(updatedTransfers));
      console.log(`[useTaskRollover] Removed session ${workplan.id} from completed transfers list`);
    }
    
    // Reset all in-memory state
    hasCheckedToday.current = false;
    setHasIncompleteTasks(false);
    setWorkplan(null);
    setIncompleteTasks([]);
    setIsOpen(false);
    
    console.log('[useTaskRollover] Task rollover state has been fully reset');
    console.log("[useTaskRollover] New state:", {
      lastCheck: safeLocalStorage.getItem(LAST_CHECK_KEY),
      todayFlag: safeLocalStorage.getItem(`${COMPLETED_TRANSFERS_KEY}-today`),
      hasCheckedToday: hasCheckedToday.current,
      hasIncompleteTasks: false,
      serviceEnabled,
      completedTransfers: getCompletedTransfers()
    });
    
    return true;
  }, [serviceEnabled, hasIncompleteTasks, getCompletedTransfers, workplan]);

  useEffect(() => {
    const checkForIncompleteWorkPlan = async () => {
      try {
        const recentWorkPlan = await rolloverService.getMostRecentWorkPlanWithIncompleteTasks();
        if (recentWorkPlan) {
          router.push(`/workplan/${recentWorkPlan.id}`);
        }
      } catch (error) {
        console.error("Error checking for incomplete tasks:", error);
      }
    };
    
    if (shouldCheckToday()) {
      checkForIncompleteWorkPlan();
    }
  }, [rolloverService, router, shouldCheckToday]);

  return {
    isOpen,
    setIsOpen,
    hasIncompleteTasks,
    isLoading,
    workplan,
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
    debriefPreviousWorkPlan,
    checkForIncompleteTasks,
    resetTaskRolloverState,
    updateBrainDumpText
  };
} 