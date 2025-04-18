// /features/brain-dump/components/BrainDump.tsx
"use client" // Ensures the component runs on the client side in Next.js.

import React, { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Lock, ChevronRight, HelpCircle } from "lucide-react"
import { useBrainDump } from "../hooks/useBrainDump"
import { ProcessedStories } from "./ProcessedStories"
import type { ProcessedStory } from "@/lib/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import debounce from "lodash.debounce"

interface BrainDumpProps {
  onTasksProcessed?: (stories: ProcessedStory[]) => void
}

/**
 * BrainDump Component:
 * - Provides an input area for users to enter tasks.
 * - Uses AI to analyze and optimize tasks into work blocks.
 * - Displays real-time feedback, errors, and suggestions.
 * - Allows users to create structured work sessions.
 */
export const BrainDump = ({ onTasksProcessed }: BrainDumpProps) => {
  const [showTips, setShowTips] = useState(false)
  const {
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    isProcessing,
    isCreatingSession,
    processingStep,
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry
  } = useBrainDump(onTasksProcessed)

  const handleTaskChange = debounce((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isInputLocked) {
      setTasks(e.target.value)
    }
  }, 300)

  const handleProcessTasks = useCallback(() => {
    processTasks(false)
  }, [processTasks])

  const analyzeButtonContent = useMemo(() => {
    if (isProcessing) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing
        </>
      )
    } else if (isInputLocked) {
      return (
        <>
          <Lock className="mr-2 h-4 w-4" />
          Locked
        </>
      )
    } else {
      return 'Analyze'
    }
  }, [isProcessing, isInputLocked])

  const MemoizedHelpCircle = useMemo(() => (
    <HelpCircle className="h-4 w-4" />
  ), [])

  return (
    <Card className="border bg-card">
      <CardContent className="p-4 space-y-4">
        <div className="relative">
          <Textarea
            placeholder={`task .init\nUpdate client dashboard design 🐸\nSend weekly progress report - 20m\nResearch API integration - 1h\nSchedule team meeting - by Thursday\nUpdate project docs\nFinalize product specs - EOD`.replace(/"/g, '&quot;')}
            value={tasks}
            onChange={handleTaskChange}
            disabled={isInputLocked}
            className="min-h-[150px] font-mono text-base"
          />
          <div className="absolute top-2 right-2">
            <TooltipProvider>
              <Tooltip open={showTips} onOpenChange={setShowTips}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {MemoizedHelpCircle}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs text-sm">
                  <div className="space-y-2">
                    <p>Effective task entry tips:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Use clear, actionable verbs</li>
                      <li>Estimate time: &quot;30m design review&quot;</li>
                      <li>Prioritize with 🐸 FROG for critical tasks</li>
                      <li>Add context: deadlines, project names</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      <Link 
                        href="/docs/task-optimization" 
                        className="underline"
                      >
                        Learn more about task optimization
                      </Link>
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <span>Analyze to optimize</span>
          </div>
          <Button 
            onClick={handleProcessTasks}
            disabled={!tasks.trim() || isProcessing || isInputLocked}
            className="w-32"
          >
            {analyzeButtonContent}
          </Button>
        </div>

        {processedStories.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Work Blocks</h3>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" size="sm">
                  Reset
                </Button>
                <Button 
                  onClick={handleCreateSession} 
                  size="sm"
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processingStep || "Creating"}
                    </>
                  ) : (
                    'Create Session'
                  )}
                </Button>
              </div>
            </div>
            <ProcessedStories 
              stories={processedStories}
              editedDurations={editedDurations}
              onDurationChange={handleDurationChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
