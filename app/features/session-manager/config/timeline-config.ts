import { 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  Coffee, 
  FileText, 
  Brain,
  LucideIcon,
  Calendar
} from "lucide-react"

export interface TimeboxTypeConfig {
  icon: LucideIcon
  color: string
  bg: string
  border: string
  title: string
}

// Configuration for different timebox types - colors, icons, etc.
export const timeboxTypeConfig = {
  work: {
    icon: CheckCircle2,
    color: "text-foreground",
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    title: "Focus Session"
  },
  "short-break": {
    icon: Pause,
    color: "text-foreground",
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    title: "Short Break"
  },
  "long-break": {
    icon: Brain,
    color: "text-foreground",
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    title: "Long Break"
  },
  lunch: {
    icon: Coffee,
    color: "text-foreground",
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    title: "Lunch Break"
  },
  debrief: {
    icon: FileText,
    color: "text-foreground",
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    title: "Debrief"
  },
} as const;

export const statusColorConfig = {
  completed: {
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    text: "text-foreground",
  },
  active: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
  },
  pending: {
    bg: "bg-secondary/20",
    border: "border-secondary/30",
    text: "text-foreground",
  }
} as const; 