import { useState, useEffect, useCallback } from 'react';
import { TaskRolloverService } from '../services/task-rollover.service';
import { TimeBoxTask, Session } from '@/lib/types';
import { useRouter } from 'next/navigation';

export interface IncompleteTask {
  task: TimeBoxTask;
  storyTitle: string;
  storyId: string;
  timeBoxIndex: number;
  taskIndex: number;
  selected: boolean;
}

export interface UseTaskRolloverReturn {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  hasIncompleteTasks: boolean;
  isLoading: boolean;
  recentSession: Session | null;
  incompleteTasks: IncompleteTask[];
  selectedCount: number;
  brainDumpText: string;
  toggleTaskSelection: (taskIndex: number) => void;
  selectAllTasks: () => void;
  deselectAllTasks: () => void;
  completeTask: (taskIndex: number) => Promise<void>;
  deleteTask: (taskIndex: number) => void;
  finishRollover: () => void;
  closeAndDiscard: () => void;
  debriefPreviousSession: () => void;
}

export function useTaskRollover(): UseTaskRolloverReturn {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasIncompleteTasks, setHasIncompleteTasks] = useState(false);
  const [recentSession, setRecentSession] = useState<Session | null>(null);
  const [incompleteTasks, setIncompleteTasks] = useState<IncompleteTask[]>([]);
  const [brainDumpText, setBrainDumpText] = useState('');
  
  const rolloverService = new TaskRolloverService();

  // Check for incomplete tasks on mount
  useEffect(() => {
    async function checkIncompleteTasks() {
      setIsLoading(true);
      try {
        const hasIncomplete = await rolloverService.hasIncompleteTasks();
        setHasIncompleteTasks(hasIncomplete);
        
        if (hasIncomplete) {
          const data = await rolloverService.getIncompleteTasks();
          if (data) {
            setRecentSession(data.session);
            setIncompleteTasks(
              data.tasks.map(task => ({
                ...task,
                selected: true // Select all by default
              }))
            );
          }
        }
      } catch (error) {
        console.error('Error checking for incomplete tasks:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkIncompleteTasks();
  }, []);

  // Update brain dump text whenever task selection changes
  useEffect(() => {
    const selectedTasks = incompleteTasks
      .filter(t => t.selected)
      .map(({ task, storyTitle }) => ({ task, storyTitle }));
    
    const text = rolloverService.convertTasksToBrainDumpFormat(selectedTasks);
    setBrainDumpText(text);
  }, [incompleteTasks]);

  // Toggle selection of a task
  const toggleTaskSelection = useCallback((taskIndex: number) => {
    setIncompleteTasks(tasks => 
      tasks.map((task, index) => 
        index === taskIndex 
          ? { ...task, selected: !task.selected } 
          : task
      )
    );
  }, []);

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
  }, [recentSession, incompleteTasks]);

  // Delete a task from the rollover (without completing it)
  const deleteTask = useCallback((taskIndex: number) => {
    setIncompleteTasks(tasks => 
      tasks.filter((_, index) => index !== taskIndex)
    );
  }, []);

  // Finish rollover and return the selected tasks for brain dump
  const finishRollover = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close the rollover and discard all changes
  const closeAndDiscard = useCallback(() => {
    setIsOpen(false);
    setBrainDumpText('');
  }, []);

  // Navigate to the previous session for debriefing
  const debriefPreviousSession = useCallback(() => {
    if (recentSession) {
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
    selectedCount: incompleteTasks.filter(t => t.selected).length,
    brainDumpText,
    toggleTaskSelection,
    selectAllTasks,
    deselectAllTasks,
    completeTask,
    deleteTask,
    finishRollover,
    closeAndDiscard,
    debriefPreviousSession
  };
} 