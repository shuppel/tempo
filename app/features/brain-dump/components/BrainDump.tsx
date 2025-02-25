// /features/brain-dump/components/BrainDump.tsx
"use client"

import React from "react"
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
import { CircularProgress } from "@/components/ui/circular-progress"
import { Info, Loader2, Lock, Unlock, XCircle, Bug } from "lucide-react"
import { StoryCard } from "./StoryCard"
import { useBrainDump } from "../hooks/useBrainDump"
import { ProcessedStories } from "./ProcessedStories"
import type { ProcessedStory } from "@/lib/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface BrainDumpProps {
  onTasksProcessed?: (stories: ProcessedStory[]) => void
}

export const BrainDump = ({ onTasksProcessed }: BrainDumpProps) => {
  const {
    tasks,
    setTasks,
    processedStories,
    editedDurations,
    isInputLocked,
    isProcessing,
    isCreatingSession,
    processingStep,
    processingProgress,
    error,
    processTasks,
    handleCreateSession,
    handleDurationChange,
    handleRetry
  } = useBrainDump(onTasksProcessed)
  
  const placeholderText = `Create landing page mockup for client FROG
Review Q1 metrics report - 30 mins
Update team documentation - flexible
Complete project proposal by EOD
Daily standup and team sync`

  return (
    <Card className="border-2">
      <CardHeader className="space-y-3">
        <CardTitle className="text-3xl">Brain Dump</CardTitle>
        <CardDescription className="text-body text-muted-foreground">
          Enter your tasks, one per line. Just brain dump everything you need to do...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Textarea
          placeholder={placeholderText}
          value={tasks}
          onChange={(e) => !isInputLocked && setTasks(e.target.value)}
          disabled={isInputLocked}
          className="font-mono min-h-[200px] text-base leading-relaxed"
        />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="format-tips" className="border-none">
            <AccordionTrigger className="flex justify-end gap-2 py-2 hover:no-underline">
              <Info className="h-5 w-5 text-muted-foreground" />
              <span className="font-accent tracking-wide text-base">Input Format Tips</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-2">
              <div className="space-y-4 text-right">
                <div className="space-y-2 text-body">
                  <p>• Start with action verbs: "Create", "Review", "Update", etc.</p>
                  <p>• Add time estimates (optional): "2 hours of work on Project X"</p>
                  <p>• Mark priorities: Add <span className="font-medium text-primary">FROG</span> to indicate high-priority tasks</p>
                  <p>• Add deadlines (optional): "Complete by Friday" or "Due: 3pm"</p>
                  <p>• Group related tasks: Use similar prefixes for related items</p>
                  <p>• Be specific: "Review Q1 metrics report" vs "Review report"</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <div className="flex items-start gap-2">
              {error.code === 'PARSING_ERROR' ? (
                <Bug className="h-4 w-4 mt-1" />
              ) : (
                <XCircle className="h-4 w-4 mt-1" />
              )}
              <div className="space-y-2 flex-1">
                <AlertTitle className="font-heading">
                  {error.code === 'PARSING_ERROR' ? 'AI Processing Error' : 
                   error.code === 'SESSION_ERROR' ? 'Session Planning Error' : 
                   'Error Processing Tasks'}
                </AlertTitle>
                <AlertDescription className="font-body text-body">
                  <p className="whitespace-pre-line">{error.message}</p>
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

        <div className="flex justify-end gap-2">
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
          <Button 
            onClick={() => processTasks(false)}
            disabled={!tasks.trim() || isProcessing || isInputLocked}
            className="w-32"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : isInputLocked ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Locked
              </>
            ) : (
              'Process Tasks'
            )}
          </Button>
        </div>

        {processedStories.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-heading">Processed Stories</h3>
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" size="sm">
                  Try Again
                </Button>
                <Button 
                  onClick={handleCreateSession} 
                  size="sm"
                  disabled={isCreatingSession}
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processingStep || "Creating..."}
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