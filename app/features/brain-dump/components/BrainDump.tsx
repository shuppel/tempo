/**
* BrainDump Component
* 
* A core UI component that serves as the entry point for task management.
* This component allows users to input their tasks in natural language format,
* processes them with AI, and enables creation of structured work sessions.
* 
* The component implements a complete task input workflow:
* 1. Task entry through a textarea
* 2. AI-powered analysis and organization
* 3. Review of analyzed results
* 4. Creation of structured work plans
* 
* It also handles task rollover from previous days and special states
* like errors, processing, and input locking.
* 
* @file /features/brain-dump/components/BrainDump.tsx
*/
"use client" // Ensures the component runs on the client side in Next.js.

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { 
 Card,
 CardHeader,
 CardTitle,
 CardDescription,
 CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Info, Loader2, Lock, Unlock, XCircle, Bug, AlertCircle } from "lucide-react"
import { useBrainDump } from "../hooks/useBrainDump"
import { useWorkPlan } from "@/app/features/workplan-manager/hooks/useWorkPlan"
import { ProcessedStories } from "./ProcessedStories"
import type { ProcessedStory } from "@/lib/types"
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from "@/components/ui/accordion"
import { TaskRollover } from "@/app/features/task-rollover"
import { TimePreferencesDialog } from "./TimePreferencesDialog"
import { DynamicBreakSuggestions } from "./DynamicBreakSuggestions"
import { TaskDurationAdvisor } from "./TaskDurationAdvisor"
import { useToast } from "@/components/ui/use-toast"

/**
* BrainDumpProps - Configuration properties for the BrainDump component
*/
interface BrainDumpProps {
 /**
  * Callback triggered when tasks are successfully processed.
  * Used for notifying parent components and updating application state.
  * 
  * @param stories - Array of processed story objects created from raw tasks
  */
 onTasksProcessed?: (stories: ProcessedStory[]) => void
}

/**
* Example text that guides users on how to format tasks for optimal AI processing.
* Demonstrates different ways to specify priorities, durations, deadlines, etc.
*/
const placeholderText = `Update client dashboard design - high priority FROG
Send weekly progress report to team - 20 mins
Research API integration options - 1 hour technical
Schedule quarterly planning meeting - by Thursday
Update project documentation - flexible timing
Finalize product feature specifications - due tomorrow`

/**
* BrainDump Component
* 
* The central input mechanism for task management in the application.
* Allows users to input natural language task descriptions which are
* analyzed by AI to create structured, optimized work blocks.
* 
* Features:
* - Free-form text input for tasks
* - AI-powered task analysis and organization
* - Visual feedback for processing status and errors
* - Handles task rollover from previous work plans
* - Prevents input when pending tasks need resolution
* - Provides guidance on optimal task formatting
* - Creates structured work sessions from processed tasks
* 
* @param props - Component properties
* @returns React component
*/
export const BrainDump = ({ onTasksProcessed }: BrainDumpProps) => {
 const { toast } = useToast();
 
 // Get today's date in YYYY-MM-DD format for workplan identification
 const today = new Date().toISOString().split('T')[0]
 
 // Query the workplan system to check for incomplete tasks
 const { hasIncompleteTasks } = useWorkPlan({ id: today })
 
 /**
  * Use the specialized brain dump hook to manage task processing state.
  * This hook handles the complex logic of task analysis, AI integration,
  * and session creation.
  */
 const {
   // Core state
   tasks,                 // Raw task input text
   setTasks,              // Function to update task text
   processedStories,      // Analyzed and organized story blocks
   editedDurations,       // User adjustments to durations
   isInputLocked,         // Whether input is locked during processing
   
   // Processing status
   isProcessing,          // Whether AI is currently analyzing tasks
   isCreatingWorkPlan,     // Whether a work plan is being created
   processingStep,        // Current step in the process
   processingProgress,    // Progress percentage
   error,                 // Error information if processing failed
   
   // Actions
   processTasks,          // Trigger task analysis
   handleCreateWorkPlan,   // Create a work plan
   handleDurationChange,  // Update story durations
   handleRetry            // Reset state and retry
 } = useBrainDump(onTasksProcessed)
 
 /**
  * Local state to track pending tasks from previous sessions.
  * This is used to block new task input until previous tasks are addressed.
  */
 const [hasPendingTasks, setHasPendingTasks] = useState(false)

 /**
  * Initialize and sync pending task state when component mounts.
  * We check localStorage and listen for changes to keep our UI in sync.
  */
 useEffect(() => {
   // Check local storage for pending tasks flag
   const pendingTasks = localStorage.getItem('pending-tasks-to-rollover')
   setHasPendingTasks(!!pendingTasks)
   
   /**
    * Handler for storage events to keep pending tasks state in sync
    * across multiple tabs or windows.
    */
   const handleStorageChange = () => {
     const updatedPendingTasks = localStorage.getItem('pending-tasks-to-rollover')
     setHasPendingTasks(!!updatedPendingTasks)
   }
   
   // Listen for localStorage changes from other components
   window.addEventListener('storage', handleStorageChange)
   
   /**
    * Handler for custom events from the TaskRollover component.
    * Allows coordinated state updates when tasks are resolved.
    */
   const handleTasksResolved = () => {
     console.log("[BrainDump] Received event that tasks were resolved")
     setHasPendingTasks(false)
   }
   
   // Listen for custom events
   window.addEventListener('tasksResolved', handleTasksResolved)
   
   // Clean up event listeners on unmount
   return () => {
     window.removeEventListener('storage', handleStorageChange)
     window.removeEventListener('tasksResolved', handleTasksResolved)
   }
 }, [])

 /**
  * Computed flag to determine if the input should be blocked.
  * We prevent new task input if there are pending tasks to roll over.
  */
 const isInputBlocked = hasPendingTasks

 /**
  * Handler for tasks rolled over from previous sessions.
  * This is called by the TaskRollover component when a user chooses
  * to bring forward incomplete tasks from a previous work plan.
  * 
  * @param tasksText - Text representation of tasks to roll over
  */
 const handleRolledOverTasks = (tasksText: string) => {
   // Mark that pending tasks have been handled
   setHasPendingTasks(false)
   
   // Validate input to prevent processing empty task lists
   if (!tasksText || !tasksText.trim()) {
     console.log("[BrainDump] Ignoring empty rolled over tasks")
     return
   }
   
   // Log action for debugging and analytics
   console.log("[BrainDump] Handling rolled over tasks:", {
     textLength: tasksText.length,
     taskCount: tasksText.split('\n').length,
     currentTasksEmpty: !tasks || !tasks.trim(),
     userInitiated: true // Flag indicating this was user-initiated via the dialog
   })
   
   // Update the tasks state with rolled over tasks
   try {
     // Use setTimeout to ensure clean state transition
     setTimeout(() => {
       console.log("[BrainDump] Setting rolled over tasks")
       setTasks(tasksText)
       console.log(`[BrainDump] Set tasks with length: ${tasksText.length}`)
     }, 50) // Small delay to ensure state is ready
   } catch (error) {
     console.error("[BrainDump] Error handling rolled over tasks:", error)
   }
 }

 // Calculate current work duration in minutes
 const calculateCurrentWorkDuration = (): number => {
   // If we have processed stories, calculate total work time
   if (processedStories.length > 0) {
     return processedStories.reduce((sum, story) => {
       const duration = editedDurations[story.title] || story.estimatedDuration || 0;
       return sum + (typeof duration === 'number' ? duration : 0);
     }, 0);
   }
   return 0;
 };

 // Get the current focus type based on processed stories
 const getActiveFocusType = (): string => {
   // Return the most common task type from processed stories
   if (processedStories.length > 0) {
     const taskTypes = processedStories.flatMap(story => 
       story.tasks.map(task => task.taskCategory)
     );
     
     const counts: Record<string, number> = {};
     let maxType = "focus";
     let maxCount = 0;
     
     taskTypes.forEach(type => {
       counts[type] = (counts[type] || 0) + 1;
       if (counts[type] > maxCount) {
         maxCount = counts[type];
         maxType = type;
       }
     });
     
     return maxType;
   }
   return "focus";
 };

 // Handle taking a break
 const handleTakeBreak = (duration: number) => {
   // You could implement break timer functionality here
   // For now, just show a toast message
   toast({
     title: `Taking a ${duration} minute break`,
     description: "Step away from your screen and refresh.",
   });
 };

 return (
   <>
     {/* Task Rollover Component */}
     <TaskRollover onCompletedTasksAdded={handleRolledOverTasks} />

     {/* Main task input container with blocking overlay when needed */}
     <div className="relative">
       {isInputBlocked && (
         <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/40 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center">
           <div className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-lg shadow-lg max-w-md text-center space-y-4 border border-gray-200 dark:border-gray-700">
             <AlertCircle className="h-10 w-10 text-amber-500 dark:text-amber-400 mx-auto" />
             <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
               {hasPendingTasks ? "Complete Previous Tasks First" : "Complete Current Tasks"}
             </h3>
             <p className="text-gray-600 dark:text-gray-300">
               {hasPendingTasks 
                 ? "Please resolve your pending tasks from the previous session before creating new ones."
                 : "Please complete your current tasks before adding new ones. This helps maintain focus and prevents task overload."}
             </p>
           </div>
         </div>
       )}

       {/* Main card container for task input and processing */}
       <Card className="border-2">
         <CardHeader className="space-y-3">
           <div className="flex items-center justify-between">
             <CardTitle className="text-3xl">Task Input</CardTitle>
             <div className="flex items-center gap-3">
               <TimePreferencesDialog />
               <DynamicBreakSuggestions 
                 workDuration={calculateCurrentWorkDuration()}
                 isInFlow={isInputLocked && !error}
                 taskType={getActiveFocusType()}
                 onTakeBreak={handleTakeBreak}
               />
             </div>
           </div>
           <CardDescription className="text-body text-muted-foreground">
             Enter your tasks below, one per line. Our AI analyzes patterns and context to create optimized focus sessions tailored to your workflow.
           </CardDescription>
         </CardHeader>

         <CardContent className="space-y-6">
           {/* 
            * Main task input textarea.
            * This is where users enter their raw task descriptions.
            */}
           <Textarea
             placeholder={placeholderText}
             value={tasks}
             onChange={(e) => !isInputLocked && setTasks(e.target.value)}
             disabled={isInputLocked || isInputBlocked}
             className={`font-mono min-h-[200px] text-base leading-relaxed ${isInputBlocked ? 'opacity-60' : ''}`}
           />

           {/* 
            * Collapsible tips section that helps users format tasks effectively.
            * This improves AI analysis quality and resulting work plans.
            */}
           <Accordion type="single" collapsible className="w-full">
             <AccordionItem value="format-tips" className="border-none">
               <AccordionTrigger className="flex justify-end gap-2 py-2 hover:no-underline">
                 <Info className="h-5 w-5 text-muted-foreground" />
                 <span className="font-accent tracking-wide text-base">Input Optimization Tips</span>
               </AccordionTrigger>
               <AccordionContent className="pt-4 pb-2">
                 <div className="space-y-4 text-right">
                   <div className="space-y-2 text-body">
                     <p>• Use specific action verbs: "Analyze," "Develop," "Finalize," etc.</p>
                     <p>• Mark high-priority tasks with <span className="font-medium text-primary">FROG</span> for immediate attention 🐸</p>
                     <p>• Include duration estimates: "45 min research" or "2-hour development session"</p>
                     <p>• Specify deadlines for time-sensitive items: "Due Friday" or "EOD deadline"</p>
                     <p>• Group related tasks with similar phrasing for better categorization</p>
                     <p>• Add context details to improve task analysis and organization</p>
                   </div>
                 </div>
               </AccordionContent>
             </AccordionItem>
           </Accordion>

           {/* 
            * Error display section.
            * Shows detailed information when task processing fails,
            * with specific guidance based on error type.
            */}
           {error && (
             <Alert variant="destructive" className="animate-in fade-in-50">
               <div className="flex items-start gap-2">
                 {/* Icon based on error type for visual categorization */}
                 {error.code === 'PARSING_ERROR' ? (
                   <Bug className="h-4 w-4 mt-1" /> // Parsing-related errors
                 ) : (
                   <XCircle className="h-4 w-4 mt-1" /> // Generic errors
                 )}
                 <div className="space-y-2 flex-1">
                   {/* Error title varies based on error type */}
                   <AlertTitle className="font-heading">
                     {error.code === 'PARSING_ERROR' ? 'AI Processing Error' : 
                      error.code === 'SESSION_ERROR' ? 'Session Planning Error' : 
                      'Error Processing Tasks'}
                   </AlertTitle>
                   <AlertDescription className="font-body text-body">
                     {/* Main error message */}
                     <p className="whitespace-pre-line">{error.message}</p>

                     {/* 
                      * Special guidance for work block duration errors.
                      * Offers specific suggestions to fix the issue.
                      */}
                     {error.code === 'SESSION_ERROR' && error.message.includes('Work blocks are too long') && (
                       <div className="mt-2 p-2 bg-muted/50 rounded-md">
                         <p className="font-medium text-sm">Suggestions:</p>
                         <ul className="mt-1 space-y-1 text-sm">
                           <li>• Try reducing the duration of tasks in the affected story</li>
                           <li>• Consider splitting long tasks into smaller ones</li>
                           <li>• Distribute tasks more evenly across stories</li>
                         </ul>
                       </div>
                     )}

                     {/* 
                      * Technical details section for debugging.
                      * Shows JSON or string representation of error details.
                      */}
                     {error.details && (
                       <div className="mt-2">
                         <div className="text-sm font-medium mb-1">Technical Details:</div>
                         <pre className="text-xs bg-destructive/10 p-2 rounded-md overflow-auto max-h-32">
                           {typeof error.details === 'string' 
                             ? error.details 
                             : JSON.stringify(error.details, null, 2)
                           }
                         </pre>
                       </div>
                     )}

                     {/* Retry button to restart the process */}
                     <Button 
                       variant="outline" 
                       size="sm" 
                       className="mt-4"
                       onClick={handleRetry}
                     >
                       Try Again
                     </Button>
                   </AlertDescription>
                 </div>
               </div>
             </Alert>
           )}

           {/* 
            * Control buttons section.
            * Primary actions for task processing and state management.
            */}
           <div className="flex justify-end gap-2">
             {/* 
              * Reset button - only shown when there are processed stories.
              * Allows users to start over if they're not satisfied with results.
              */}
             {processedStories.length > 0 && (
               <Button 
                 onClick={handleRetry}
                 variant="outline"
                 size="sm"
                 className="flex items-center gap-2"
               >
                 <Unlock className="h-4 w-4" />
                 Clear & Unlock
               </Button>
             )}
             
             {/* 
              * Main action button - changes state based on current processing stage.
              * Shows different labels and icons depending on the current state.
              */}
             <Button 
               onClick={() => processTasks(false)}
               disabled={!tasks.trim() || isProcessing || isInputLocked}
               className="w-32"
             >
               {isProcessing ? (
                 // Processing indicator with spinner during AI analysis
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Analyzing...
                 </>
               ) : isInputLocked ? (
                 // Locked state indicator after processing
                 <>
                   <Lock className="mr-2 h-4 w-4" />
                   Locked
                 </>
               ) : (
                 // Default idle state
                 'Analyze Tasks'
               )}
             </Button>
           </div>

           {/* 
            * Results section - shown only after processing is complete.
            * Displays the AI-generated stories and allows creation of work plans.
            */}
           {processedStories.length > 0 && (
             <div className="space-y-4 pt-4 border-t">
               <div className="flex items-center justify-between">
                 <h3 className="font-heading">Optimized Work Blocks</h3>
                 <div className="flex gap-2">
                   {/* Reset button to start over */}
                   <Button onClick={handleRetry} variant="outline" size="sm">
                     Start Over
                   </Button>
                   
                   {/* 
                    * Create session button - triggers work plan creation.
                    * Shows progress indicator during creation process.
                    */}
                   <Button 
                     onClick={handleCreateWorkPlan} 
                     size="sm"
                     disabled={isCreatingWorkPlan}
                   >
                     {isCreatingWorkPlan ? (
                       // Creating work plan indicator with spinner
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         {processingStep || "Generating..."}
                       </>
                     ) : (
                       // Default idle state
                       'Create Work Session'
                     )}
                   </Button>
                 </div>
               </div>
               
               {/* 
                * Processed stories display component.
                * Shows the AI analysis results and allows duration editing.
                */}
               <ProcessedStories 
                 stories={processedStories}
                 editedDurations={editedDurations}
                 isCreatingWorkPlan={isCreatingWorkPlan}
                 onDurationChange={handleDurationChange}
                 onRetry={handleRetry}
                 onCreateWorkPlan={handleCreateWorkPlan}
               />
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   </>
 )
}