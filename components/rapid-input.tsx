/**
 * RapidInput Component
 * 
 * This component provides a streamlined, quick-entry interface for users to input multiple tasks at once.
 * It works by allowing users to enter tasks in a free-form text format (one task per line) and then 
 * processes each task through AI refinement to create structured task objects.
 * 
 * Key features:
 * - Multi-line text input for rapid task entry
 * - AI-powered task refinement (converts plain text to structured data)
 * - Loading state management during processing
 * - Error handling for failed refinements
 * 
 * Data flow:
 * 1. User enters raw task descriptions (one per line)
 * 2. On submit, each line is processed through the AI refineTask function
 * 3. Raw text is converted to structured task objects with metadata
 * 4. Completed task objects are passed to the parent component
 */

"use client"

import type React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { refineTask } from "@/lib/ai"
import type { Task, DifficultyLevel } from "@/lib/types"

interface RapidInputProps {
  onTasksGenerated: (tasks: Task[]) => void
}

export function RapidInput({ onTasksGenerated }: RapidInputProps) {
  // State for the raw text input, loading state, and any processing errors
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handles form submission by processing each line of text into a structured task
   * 
   * The processing flow:
   * 1. Split input by newlines to get individual task strings
   * 2. Filter out empty lines
   * 3. Process each task string through AI refinement
   * 4. Convert refined data into proper Task objects
   * 5. Return the structured tasks to the parent component
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)

    try {
      // Split input by newlines and filter out empty lines
      const taskInputs = input
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trim())

      if (taskInputs.length === 0) {
        throw new Error("Please enter at least one task")
      }

      // Process each task through AI refinement to create structured task objects
      const refinedTasks = await Promise.all(
        taskInputs.map(async (taskInput): Promise<Task> => {
          // Use AI to analyze and enhance the raw task input
          const refined = await refineTask(taskInput)
          
          if (!refined.title) {
            throw new Error(`Failed to refine task: ${taskInput}`)
          }

          // Create a complete task object with both refined data and defaults for missing values
          return {
            id: crypto.randomUUID(),
            title: refined.title,
            description: refined.description || "", // Provide empty string as fallback
            duration: refined.duration || 25, // Use refined duration or default
            difficulty: refined.difficulty || "medium", // Use medium as default difficulty
            isFrog: refined.isFrog || false,
            taskCategory: refined.taskCategory || "focus",
            projectType: refined.projectType,
            status: "todo",
            children: [],
            refined: true,
          }
        }),
      )

      // Send the fully processed tasks to the parent component
      onTasksGenerated(refinedTasks)
      setInput("")
    } catch (error) {
      console.error("Error processing tasks:", error)
      setError(error instanceof Error ? error.message : "Failed to process tasks")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter your tasks, one per line. Just brain dump everything you need to do..."
        className="min-h-[200px]"
      />
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}
      <Button type="submit" disabled={isProcessing || !input.trim()}>
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Process Tasks
      </Button>
    </form>
  )
}

