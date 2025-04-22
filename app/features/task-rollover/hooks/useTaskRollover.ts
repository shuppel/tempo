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
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { TaskRolloverService } from "../services/task-rollover.service";
import { TimeBoxTask, Session } from "@/lib/types";
import { useRouter } from "next/navigation";

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
  checkForIncompleteTasks: () => Promise<void>;
}

// Create a localStorage key to track when we last checked
const LAST_CHECK_KEY = "task-rollover-last-check";
const SERVICE_ENABLED_KEY = "task-rollover-enabled";

export function useTaskRollover(): UseTaskRolloverReturn {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasIncompleteTasks, setHasIncompleteTasks] = useState(false);
  const [recentSession, setRecentSession] = useState<Session | null>(null);
  const [incompleteTasks, setIncompleteTasks] = useState<IncompleteTask[]>([]);
  const [brainDumpText, setBrainDumpText] = useState("");

  // Track if the service is enabled
  const [serviceEnabled] = useState(() => {
    // Read from localStorage with a default of true
    const savedSetting = localStorage.getItem(SERVICE_ENABLED_KEY);
    // Default to enabled if not set
    return savedSetting !== null ? savedSetting === "true" : true;
  });

  // Create a ref to know if we've already performed the check
  const hasCheckedToday = useRef(false);

  // Use useMemo to create the service only once
  const rolloverService = useMemo(() => new TaskRolloverService(), []);

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
  const checkForIncompleteTasks = useCallback(async () => {
    // Only proceed if the service is enabled
    if (!serviceEnabled) return;

    // Prevent concurrent checks
    if (isLoading) return;

    setIsLoading(true);
    try {
      const hasIncomplete = await rolloverService.hasIncompleteTasks();
      setHasIncompleteTasks(hasIncomplete);

      if (hasIncomplete) {
        const data = await rolloverService.getIncompleteTasks();
        if (data) {
          setRecentSession(data.session);
          setIncompleteTasks(
            data.tasks.map((task) => ({
              ...task,
              selected: true, // Select all by default
            })),
          );
        }
      }

      // Record that we've checked today
      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
      hasCheckedToday.current = true;
    } catch (error) {
      console.error("Error checking for incomplete tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [serviceEnabled, isLoading, rolloverService]);

  // Run the check only once when the component mounts
  useEffect(() => {
    if (shouldCheckToday() && !hasCheckedToday.current) {
      checkForIncompleteTasks();
    }
  }, [shouldCheckToday, checkForIncompleteTasks]);

  // Calculate selected task count efficiently
  const selectedCount = useMemo(() => {
    return incompleteTasks.filter((t) => t.selected).length;
  }, [incompleteTasks]);

  // Update brain dump text when incompleteTasks changes
  // Using useEffect to prevent recalculating during renders
  useEffect(() => {
    const selectedTasks = incompleteTasks
      .filter((t) => t.selected)
      .map(({ task, storyTitle }) => ({ task, storyTitle }));

    if (selectedTasks.length > 0) {
      const text = rolloverService.convertTasksToBrainDumpFormat(selectedTasks);
      setBrainDumpText(text);
    } else {
      setBrainDumpText("");
    }
  }, [incompleteTasks, rolloverService]);

  // Toggle selection of a task - this won't trigger unnecessary renders
  const toggleTaskSelection = useCallback(
    (taskIndex: number) => {
      if (taskIndex < 0 || taskIndex >= incompleteTasks.length) {
        return; // Prevent out-of-bounds access
      }

      setIncompleteTasks((prevTasks) =>
        prevTasks.map((task, index) =>
          index === taskIndex ? { ...task, selected: !task.selected } : task,
        ),
      );
    },
    [incompleteTasks.length],
  );

  // Select all tasks
  const selectAllTasks = useCallback(() => {
    setIncompleteTasks((tasks) =>
      tasks.map((task) => ({ ...task, selected: true })),
    );
  }, []);

  // Deselect all tasks
  const deselectAllTasks = useCallback(() => {
    setIncompleteTasks((tasks) =>
      tasks.map((task) => ({ ...task, selected: false })),
    );
  }, []);

  // Mark a task as completed in its original session
  const completeTask = useCallback(
    async (taskIndex: number) => {
      if (!recentSession) return;

      const task = incompleteTasks[taskIndex];
      if (!task) return;

      try {
        const success = await rolloverService.completeTask(
          recentSession.date,
          task.storyId,
          task.timeBoxIndex,
          task.taskIndex,
        );

        if (success) {
          // Remove the task from the list
          setIncompleteTasks((tasks) =>
            tasks.filter((_, index) => index !== taskIndex),
          );
        }
      } catch (error) {
        console.error("Error completing task:", error);
      }
    },
    [recentSession, incompleteTasks, rolloverService],
  );

  // Delete a task from the rollover (without completing it)
  const deleteTask = useCallback((taskIndex: number) => {
    setIncompleteTasks((tasks) =>
      tasks.filter((_, index) => index !== taskIndex),
    );
  }, []);

  // Finish rollover and return the selected tasks for brain dump
  const finishRollover = useCallback(() => {
    setIsOpen(false);
  }, []);

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
  };
}
