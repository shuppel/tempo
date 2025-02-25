"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { Task, TaskType } from "@/lib/types"

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTask: (task: Task) => void
}

export function TaskDialog({ open, onOpenChange, onAddTask }: TaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("25")
  const [type, setType] = useState<TaskType>("focus")
  const [difficulty, setDifficulty] = useState("25")
  const [isFrog, setIsFrog] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAddTask({
      id: crypto.randomUUID(),
      title,
      description,
      duration: Number.parseInt(duration),
      difficulty: Number.parseInt(difficulty),
      type: type as TaskType,
      isFrog,
      status: "todo",
      children: [],
      refined: false,
    })
    setTitle("")
    setDescription("")
    setDuration("25")
    setType("focus")
    setDifficulty("25")
    setIsFrog(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Create a new task for your Pomodoro session</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="45">45</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Task Type</Label>
                <Select 
                  value={type} 
                  onValueChange={(value: TaskType) => setType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="focus">Deep Focus</SelectItem>
                    <SelectItem value="learning">Active Learning</SelectItem>
                    <SelectItem value="review">Review/Recall</SelectItem>
                    <SelectItem value="break">Diffuse Break</SelectItem>
                    <SelectItem value="research">Research/Investigation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">Physical/Logistics (100)</SelectItem>
                    <SelectItem value="75">High Effort (75)</SelectItem>
                    <SelectItem value="50">Medium Effort (50)</SelectItem>
                    <SelectItem value="25">Low Effort (25)</SelectItem>
                    <SelectItem value="13">Learning (13)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isFrog">Priority Task</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="isFrog" checked={isFrog} onCheckedChange={(checked) => setIsFrog(!!checked)} />
                  <label htmlFor="isFrog" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Mark as "Eat the Frog" task
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Add Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

