/**
* StoryCard Component
* 
* A visual representation of a processed story block with its constituent tasks.
* This component displays AI-analyzed task groups and allows users to adjust
* estimated durations for better planning.
* 
* @file /features/brain-dump/components/StoryCard.tsx
*/
import React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Clock, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { ProcessedStory, ProcessedTask } from "../types"
import { DifficultyBadge } from "./DifficultyBadge"
import { TaskDurationAdvisor } from './TaskDurationAdvisor'

/**
* StoryCardProps - Configuration properties for the StoryCard component
*/
interface StoryCardProps {
 /** 
  * The processed story object containing tasks and metadata
  * Created by AI analysis of raw task input
  */
 story: ProcessedStory
 
 /**
  * The current user-edited duration for this story
  * May differ from the original AI-estimated duration
  */
 editedDuration: number
 
 /**
  * Callback for when the user changes the duration
  * Updates parent state to track custom duration values
  * 
  * @param storyTitle - Title of the story being modified
  * @param newDuration - New duration value in minutes
  */
 onDurationChange: (storyTitle: string, newDuration: number) => void
}

/**
* StoryCard Component
* 
* Displays a single story (collection of related tasks) in a structured card format,
* showing metadata, tasks, and allowing duration editing.
* 
* Features:
* - Displays story information with title, type, and project
* - Lists all tasks with their details and metadata
* - Shows suggested breaks for tasks
* - Highlights high-priority "frog" tasks
* - Allows editing of estimated duration
* - Indicates difficulty levels through visual badges
* 
* @param props - Component properties
* @returns React component
*/
export const StoryCard = ({ story, editedDuration, onDurationChange }: StoryCardProps) => {
 /**
  * Renders suggested breaks for a task
  * 
  * Displays information about when and how long to take breaks during a task.
  * This helps users understand the AI's recommended work pacing.
  * 
  * @param task - The task containing suggested breaks
  * @returns React component or null if no breaks
  */
 const renderTaskBreaks = (task: ProcessedTask) => {
   // Skip rendering if there are no breaks to show
   if (!task.suggestedBreaks?.length) return null

   return (
     <div className="ml-6 mt-1 text-xs text-muted-foreground space-y-1">
       {task.suggestedBreaks.map((breakInfo, i) => (
         <div key={i} className="flex items-center gap-2">
           <Info className="h-3 w-3 flex-shrink-0" />
           <span className="text-xs">
             Break recommended at {breakInfo.after}m: {breakInfo.duration}m duration
             {breakInfo.reason && ` - ${breakInfo.reason}`}
           </span>
         </div>
       ))}
     </div>
   )
 }

 return (
   <Alert>
     <div className="flex items-start gap-2">
       {/* Story icon - visual representation of the story theme */}
       <span className="text-2xl">{story.icon}</span>
       
       <div className="flex-1">
         {/* Story header with title and badges */}
         <div className="flex items-center gap-2">
           <AlertTitle>{story.title}</AlertTitle>
           
           {/* Story type badge - indicates scheduling strategy */}
           <Badge variant={story.type === "flexible" ? "outline" : "default"}>
             {story.type}
           </Badge>
           
           {/* Project type badge - shows if the story belongs to a specific project */}
           {story.projectType && (
             <Badge variant="secondary" className="text-xs">
               {story.projectType}
             </Badge>
           )}
         </div>
         
         <AlertDescription>
           {/* Story summary - brief description of what this story block entails */}
           <p className="mt-1 text-muted-foreground">{story.summary}</p>
           
           {/* Task list - all tasks in this story */}
           <ul className="mt-2 space-y-2">
             {story.tasks.map((task, i) => (
               <li key={i} className="mb-1">
                 <div className="flex">
                   <div className="flex-1">
                     {/* Task header with title and metadata badges */}
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className="text-sm">•</span>
                       
                       {/* Task title - highlighted if it's a high priority task */}
                       <span className={`text-sm ${task.isFrog ? "font-medium text-primary" : ""}`}>
                         {task.title}
                       </span>
                       
                       {/* High priority indicator badge */}
                       {task.isFrog && (
                         <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-2 py-0 h-5">
                           <span className="mr-1">🐸</span>
                           HIGH PRIORITY
                         </Badge>
                       )}
                       
                       {/* Task category badge - indicates type of work */}
                       <Badge variant="outline" className="text-xs capitalize">
                         {task.taskCategory}
                       </Badge>
                       
                       {/* Project type badge - only shown if different from story project */}
                       {task.projectType && task.projectType !== story.projectType && (
                         <Badge variant="secondary" className="text-xs">
                           {task.projectType}
                         </Badge>
                       )}
                       
                       {/* Flexible timing or duration indicator */}
                       {task.isFlexible ? (
                         <Badge variant="outline" className="text-xs">time flexible</Badge>
                       ) : (
                         task.duration > 0 && (
                           <span className="text-xs text-muted-foreground">
                             ({task.duration} min estimate)
                           </span>
                         )
                       )}
                     </div>
                     
                     {/* Break recommendations if applicable */}
                     {renderTaskBreaks(task)}

                     {/* Add TaskDurationAdvisor */}
                     <TaskDurationAdvisor 
                       task={{
                         title: task.title,
                         duration: task.duration,
                         taskCategory: task.taskCategory,
                         priority: task.difficulty // Map difficulty to priority
                       }}
                       onChange={(updatedTask) => {
                         // Handle duration changes from the advisor
                         if (updatedTask.duration !== task.duration && updatedTask.duration) {
                           // Create updated task with new duration
                           const updatedTaskWithDuration = {
                             ...task,
                             duration: updatedTask.duration
                           };
                           
                           // Find task index in the story
                           const taskIndex = story.tasks.findIndex(t => t.title === task.title);
                           
                           // Create updated tasks array
                           const updatedTasks = [...story.tasks];
                           updatedTasks[taskIndex] = updatedTaskWithDuration;
                           
                           // Calculate new total duration
                           const newStoryDuration = updatedTasks.reduce(
                             (sum, t) => sum + t.duration, 0
                           );
                           
                           // Call the parent's onDurationChange with new calculated duration
                           onDurationChange(story.title, newStoryDuration);
                         }
                       }}
                     />
                   </div>
                   
                   {/* Difficulty indicator - visual representation of task complexity */}
                   {task.difficulty && (
                     <div className="flex-shrink-0 ml-2 self-start mt-1">
                       <DifficultyBadge 
                         difficulty={task.difficulty} 
                         duration={task.duration}
                       />
                     </div>
                   )}
                 </div>
               </li>
             ))}
           </ul>
           
           {/* Duration editor - allows adjustment of total estimated time 
               Only shown for stories that aren't milestones (which don't have durations) */}
           {story.type !== "milestone" && (
             <div className="mt-3 flex items-center gap-2">
               <Clock className="h-4 w-4 text-muted-foreground" />
               <div className="flex items-center gap-2">
                 {/* Duration input field */}
                 <Input
                   type="number"
                   value={editedDuration || ""}
                   onChange={(e) => {
                     const value = e.target.value;
                     const duration = parseInt(value, 10);
                     // Only update if the value is a positive number
                     if (!isNaN(duration) && duration > 0) {
                       onDurationChange(story.title, duration);
                     }
                   }}
                   className="w-20 h-7 text-sm"
                   min="1"
                 />
                 <span className="text-sm text-muted-foreground">min estimated duration</span>
               </div>
             </div>
           )}
         </AlertDescription>
       </div>
     </div>
   </Alert>
 )
}