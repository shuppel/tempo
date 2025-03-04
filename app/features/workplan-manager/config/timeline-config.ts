import { 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  Coffee, 
  FileText, 
  Brain,
  LucideIcon
} from "lucide-react"

export interface TimeboxTypeConfig {
  icon: LucideIcon
  color: string
  bg: string
  border: string
  title: string
}

// Configuration for different timebox types - colors, icons, etc.
export const timeboxTypeConfig: Record<string, TimeboxTypeConfig> = {
  work: {
    icon: CheckCircle2,
    color: "indigo",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    title: "Focus Block"
  },
  "short-break": {
    icon: Pause,
    color: "teal",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-900",
    title: "Short Break"
  },
  "long-break": {
    icon: Coffee,
    color: "violet",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-300 dark:border-violet-800",
    title: "Long Break"
  },
  "lunch": {
    icon: Coffee,
    color: "amber",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-900",
    title: "Lunch Break"
  },
  "debrief": {
    icon: FileText,
    color: "rose",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900",
    title: "WorkPlan Debrief"
  }
};

export const statusColorConfig = {
  todo: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-700 dark:text-gray-300"
  },
  "in-progress": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-700",
    text: "text-blue-700 dark:text-blue-300"
  },
  completed: {
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-300 dark:border-green-700",
    text: "text-green-700 dark:text-green-300"
  }
}; 