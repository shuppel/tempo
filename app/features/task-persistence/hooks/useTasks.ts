import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskPersistenceService } from "../services/task-persistence.service";
import type { Task } from "@/lib/types";

export function useTasks() {
  const queryClient = useQueryClient();
  const queryKey = ["tasks"] as const;

  // Query for fetching tasks
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => TaskPersistenceService.getTasks(),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep unused data in cache for 30 minutes
  });

  // Mutation for saving tasks
  const { mutate: saveTasks } = useMutation({
    mutationFn: (newTasks: Task[]) =>
      TaskPersistenceService.saveTasks(newTasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation for updating a task
  const { mutate: updateTask } = useMutation({
    mutationFn: ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<Task>;
    }) => TaskPersistenceService.updateTask(taskId, updates),
    onSuccess: (updatedTask: Task) => {
      queryClient.setQueryData(queryKey, (oldTasks: Task[] = []) =>
        oldTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        ),
      );
    },
  });

  // Mutation for deleting a task
  const { mutate: deleteTask } = useMutation({
    mutationFn: (taskId: string) => TaskPersistenceService.deleteTask(taskId),
    onSuccess: (_: void, deletedTaskId: string) => {
      queryClient.setQueryData(queryKey, (oldTasks: Task[] = []) =>
        oldTasks.filter((task) => task.id !== deletedTaskId),
      );
    },
  });

  return {
    tasks,
    isLoading,
    error,
    saveTasks,
    updateTask,
    deleteTask,
  };
}
