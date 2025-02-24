"use client"

import type React from "react"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { refineTask } from "@/lib/ai"
import type { Task } from "@/lib/types"

interface RapidInputProps {
  onTasksGenerated: (tasks: Task[]) => void
}

export function RapidInput({ onTasksGenerated }: RapidInputProps) {
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)

    try {
      const taskInputs = input
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trim())

      if (taskInputs.length === 0) {
        throw new Error("Please enter at least one task")
      }

      const refinedTasks = await Promise.all(
        taskInputs.map(async (taskInput): Promise<Task> => {
          const refined = await refineTask(taskInput)
          
          if (!refined.title) {
            throw new Error(`Failed to refine task: ${taskInput}`)
          }

          return {
            id: crypto.randomUUID(),
            title: refined.title,
            description: refined.description || "", // Provide empty string as fallback
            duration: refined.duration || 25, // Use refined duration or default
            difficulty: refined.difficulty || 25, // Use refined difficulty or default
            isFrog: refined.isFrog || false,
            type: refined.type || "focus",
            status: "todo",
            children: [],
            refined: true,
          }
        }),
      )

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

