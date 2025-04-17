import { Replicache, WriteTransaction } from 'replicache';
import type { StoredSession } from './sessionStorage';
import type { TimeBoxStatus } from './types';

export type MutatorDefs = {
  saveSession: (tx: WriteTransaction, args: { date: string; session: StoredSession }) => Promise<void>;
  deleteSession: (tx: WriteTransaction, args: { date: string }) => Promise<void>;
  clearAllSessions: (tx: WriteTransaction) => Promise<void>;
  updateTimeBoxStatus: (tx: WriteTransaction, args: { date: string; storyId: string; timeBoxIndex: number; status: TimeBoxStatus }) => Promise<boolean>;
  updateTaskStatus: (tx: WriteTransaction, args: { date: string; storyId: string; timeBoxIndex: number; taskIndex: number; status: TimeBoxStatus }) => Promise<boolean>;
  saveTimerState: (tx: WriteTransaction, args: { date: string; activeTimeBox: { storyId: string; timeBoxIndex: number } | null; timeRemaining: number | null; isTimerRunning: boolean }) => Promise<boolean>;
};

export type Rep = Replicache<MutatorDefs>;

export function createReplicacheClient(userId: string): Rep {
  const rep = new Replicache({
    name: `torodoro-user-${userId}`,
    licenseKey: 'lfbf5740f9f2742b68807f921bb7ee4af',
    
    // Set up the sync configuration
    pushURL: '/api/replicache',
    pullURL: '/api/replicache',
    
    mutators: {
      async saveSession(tx: WriteTransaction, { date, session }: { date: string; session: StoredSession }) {
        // Convert to plain object to ensure JSON compatibility
        await tx.put(`session-${date}`, JSON.parse(JSON.stringify(session)));
      },
      
      async deleteSession(tx: WriteTransaction, { date }: { date: string }) {
        await tx.del(`session-${date}`);
      },
      
      async clearAllSessions(tx: WriteTransaction) {
        // Get all keys with session prefix
        const keys = await tx.scan({ prefix: 'session-' }).keys().toArray();
        for (const key of keys) {
          await tx.del(key);
        }
      },
      
      async updateTimeBoxStatus(
        tx: WriteTransaction, 
        { date, storyId, timeBoxIndex, status }: { 
          date: string; 
          storyId: string; 
          timeBoxIndex: number; 
          status: TimeBoxStatus 
        }
      ) {
        const key = `session-${date}`;
        const session = await tx.get(key) as StoredSession | undefined;
        if (!session) return false;
        
        let updated = false;
        const updatedStoryBlocks = session.storyBlocks.map(story => {
          if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
            updated = true;
            const updatedTimeBoxes = [...story.timeBoxes];
            
            // Update the timebox status
            updatedTimeBoxes[timeBoxIndex] = {
              ...updatedTimeBoxes[timeBoxIndex],
              status
            };
            
            // If marking as completed, mark all tasks as completed
            if (status === 'completed' && updatedTimeBoxes[timeBoxIndex].tasks) {
              updatedTimeBoxes[timeBoxIndex].tasks = updatedTimeBoxes[timeBoxIndex].tasks.map(task => ({
                ...task,
                status: 'completed'
              }));
            }
            
            // If marking as todo, mark all tasks as todo
            if (status === 'todo' && updatedTimeBoxes[timeBoxIndex].tasks) {
              updatedTimeBoxes[timeBoxIndex].tasks = updatedTimeBoxes[timeBoxIndex].tasks.map(task => ({
                ...task,
                status: 'todo'
              }));
            }
            
            // Recalculate story progress based on completed work timeboxes
            const workBoxes = updatedTimeBoxes.filter(box => box.type === 'work');
            const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed');
            const progress = workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0;
            
            return {
              ...story,
              timeBoxes: updatedTimeBoxes,
              progress
            };
          }
          return story;
        });

        if (updated) {
          // Recalculate session status based on all timeboxes
          const allWorkBoxes = updatedStoryBlocks.flatMap(story => 
            story.timeBoxes.filter(box => box.type === 'work')
          );
          
          const allCompleted = allWorkBoxes.every(box => box.status === 'completed');
          const anyInProgress = allWorkBoxes.some(box => box.status === 'in-progress');
          const anyCompleted = allWorkBoxes.some(box => box.status === 'completed');
          
          let sessionStatus = session.status || 'planned';
          if (allCompleted) {
            sessionStatus = 'completed';
          } else if (anyInProgress || anyCompleted) {
            sessionStatus = 'in-progress';
          }
          
          const updatedSession = {
            ...session,
            storyBlocks: updatedStoryBlocks,
            status: sessionStatus,
            lastUpdated: new Date().toISOString()
          };
          
          // Convert to plain object to ensure JSON compatibility
          await tx.put(key, JSON.parse(JSON.stringify(updatedSession)));
          return true;
        }
        
        return false;
      },
      
      async updateTaskStatus(tx: WriteTransaction, { date, storyId, timeBoxIndex, taskIndex, status }: { date: string; storyId: string; timeBoxIndex: number; taskIndex: number; status: TimeBoxStatus }) {
        const key = `session-${date}`;
        const session = await tx.get(key) as StoredSession | undefined;
        if (!session) return false;
        
        let updated = false;
        const updatedStoryBlocks = session.storyBlocks.map(story => {
          if (story.id === storyId && story.timeBoxes[timeBoxIndex]) {
            const timeBox = story.timeBoxes[timeBoxIndex];
            if (timeBox.tasks && timeBox.tasks[taskIndex]) {
              updated = true;
              const updatedTasks = [...timeBox.tasks];
              updatedTasks[taskIndex] = {
                ...updatedTasks[taskIndex],
                status
              };
              
              // Create a new array of timeBoxes with the updated one
              const updatedTimeBoxes = [...story.timeBoxes];
              updatedTimeBoxes[timeBoxIndex] = {
                ...timeBox,
                tasks: updatedTasks
              };
              
              // Check if all tasks in this timebox are completed
              const allTasksCompleted = updatedTasks.every(task => task.status === 'completed');
              if (allTasksCompleted) {
                updatedTimeBoxes[timeBoxIndex] = {
                  ...updatedTimeBoxes[timeBoxIndex],
                  status: 'completed'
                };
              } else if (updatedTasks.some(task => task.status === 'completed')) {
                updatedTimeBoxes[timeBoxIndex] = {
                  ...updatedTimeBoxes[timeBoxIndex],
                  status: 'in-progress'
                };
              }
              
              // Recalculate story progress based on completed work timeboxes
              const workBoxes = updatedTimeBoxes.filter(box => box.type === 'work');
              const completedWorkBoxes = workBoxes.filter(box => box.status === 'completed');
              const progress = workBoxes.length > 0 ? Math.round((completedWorkBoxes.length / workBoxes.length) * 100) : 0;
              
              return {
                ...story,
                timeBoxes: updatedTimeBoxes,
                progress
              };
            }
          }
          return story;
        });
        
        if (updated) {
          const updatedSession = {
            ...session,
            storyBlocks: updatedStoryBlocks,
            lastUpdated: new Date().toISOString()
          };
          
          // Convert to plain object to ensure JSON compatibility
          await tx.put(key, JSON.parse(JSON.stringify(updatedSession)));
          return true;
        }
        
        return false;
      },
      
      async saveTimerState(tx: WriteTransaction, { date, activeTimeBox, timeRemaining, isTimerRunning }: { date: string; activeTimeBox: { storyId: string; timeBoxIndex: number } | null; timeRemaining: number | null; isTimerRunning: boolean }) {
        const key = `session-${date}`;
        const session = await tx.get(key) as StoredSession | undefined;
        if (!session) return false;
        
        const updatedSession = {
          ...session,
          activeTimeBox,
          timeRemaining,
          isTimerRunning,
          lastUpdated: new Date().toISOString()
        };
        
        // Convert to plain object to ensure JSON compatibility
        await tx.put(key, JSON.parse(JSON.stringify(updatedSession)));
        return true;
      }
    }
  });
  
  return rep;
} 