"use client"

import React from "react"
import { useState, useEffect } from "react"
import { use } from "react"
import { WorkPlanStorageService } from "@/app/features/workplan-manager"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion } from "framer-motion"
import { ArrowRight, X } from "lucide-react"
import { TodoWorkPlan, TodoWorkPlanStatus } from "@/lib/types"
import { useRouter } from "next/navigation"
import { format, parse } from "date-fns"
import { cn } from "@/lib/utils"
import { getWorkPlanTimeEstimates } from "@/lib/durationUtils"
import { WorkPlanView } from "@/app/features/workplan-manager"

interface MitigatedTask {
  title: string;
  storyTitle: string;
  duration: number;
  taskCategory?: string;
  mitigated: boolean;
  rolledOver: boolean;
}

interface MitigatedTasksViewProps {
  workplan: TodoWorkPlan
}

function MitigatedTasksView({ workplan }: MitigatedTasksViewProps) {
  // Only show for archived workplans with incompleteTasks data
  if (workplan.status !== 'archived' || !workplan.incompleteTasks) {
    return null;
  }

  const mitigatedTasks = workplan.incompleteTasks.tasks.filter((task: MitigatedTask) => task.mitigated && !task.rolledOver);
  
  if (mitigatedTasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4 border border-muted p-4 rounded-lg">
      <h2 className="text-xl font-semibold">Mitigated Tasks</h2>
      <p className="text-muted-foreground text-sm">
        These tasks were intentionally set aside and won't appear in future rollover screens.
      </p>
      <ul className="space-y-2 mt-4">
        {mitigatedTasks.map((task: MitigatedTask, index: number) => (
          <li key={index} className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-medium">{task.title}</span>
                <div className="text-sm text-muted-foreground">
                  <span>From: {task.storyTitle}</span>
                  {task.duration > 0 && (
                    <span className="ml-2">Duration: {task.duration} min</span>
                  )}
                  {task.taskCategory && (
                    <span className="ml-2">Type: {task.taskCategory}</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
} 