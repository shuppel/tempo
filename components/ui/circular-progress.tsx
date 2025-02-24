import * as React from "react"
import { cn } from "@/lib/utils"

interface CircularProgressProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function CircularProgress({
  progress,
  size = 40,
  strokeWidth = 4,
  className
}: CircularProgressProps) {
  const [displayProgress, setDisplayProgress] = React.useState(0)
  
  React.useEffect(() => {
    // Smoothly animate the progress value
    const duration = 500 // Animation duration in ms
    const steps = 60 // Number of steps in the animation
    const stepDuration = duration / steps
    const increment = (progress - displayProgress) / steps

    let currentStep = 0
    const timer = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(timer)
        setDisplayProgress(progress)
      } else {
        setDisplayProgress(prev => prev + increment)
        currentStep++
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [progress])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (displayProgress / 100) * circumference

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          className="text-muted"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-primary transition-all duration-300 ease-in-out"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-xs font-medium">
        {Math.round(displayProgress)}%
      </span>
    </div>
  )
} 