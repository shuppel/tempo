"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Task } from "@/lib/types";

interface FrogListProps {
  tasks: Task[];
}

export function FrogList({ tasks }: FrogListProps) {
  const frogs = tasks.filter((task) => task.isFrog);
  const activeFrogs = frogs.slice(0, 3);
  const backlogFrogs = frogs.slice(3);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Active FROGs (Top 3)</h3>
        {activeFrogs.length > 0 ? (
          <div className="mt-2 space-y-2">
            {activeFrogs.map((task) => (
              <Alert key={task.id} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{task.title}</AlertTitle>
                <AlertDescription>
                  Difficulty: {task.difficulty} points
                </AlertDescription>
              </Alert>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active FROGs</p>
        )}
      </div>

      {backlogFrogs.length > 0 && (
        <div>
          <h3 className="font-semibold">FROG Backlog</h3>
          <div className="mt-2 space-y-2">
            {backlogFrogs.map((task) => (
              <Alert key={task.id}>
                <AlertTitle>{task.title}</AlertTitle>
                <AlertDescription>
                  Difficulty: {task.difficulty} points
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
