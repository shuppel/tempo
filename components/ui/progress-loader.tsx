import * as React from "react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

interface ProgressLoaderProps {
  progress: number // The current progress percentage (0-100).
  description?: string // Optional description displayed above the progress bar.
  className?: string // Custom class names for additional styling.
}

/**
 * ProgressLoader Component:
 * - Displays an animated progress bar with a percentage indicator.
 * - Supports smooth progress updates with animation.
 * - Uses a gradient shimmer effect when loading.
 */
export function ProgressLoader({
  progress,
  description,
  className,
}: ProgressLoaderProps) {
  const [displayProgress, setDisplayProgress] = React.useState(0)

  React.useEffect(() => {
    // Smoothly animate the progress value from `displayProgress` to `progress`
    const duration = 500 // Total animation duration in milliseconds.
    const steps = 60 // Number of incremental updates for smooth transition.
    const stepDuration = duration / steps // Time per update step.
    const increment = (progress - displayProgress) / steps // Value increment per step.

    let currentStep = 0
    const timer = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(timer)
        setDisplayProgress(progress) // Ensure the final value is exactly `progress`.
      } else {
        setDisplayProgress(prev => prev + increment)
        currentStep++
      }
    }, stepDuration)

    return () => clearInterval(timer) // Cleanup interval when `progress` changes.
  }, [progress])

  return (
    <div className={cn("space-y-2", className)}>
      {/* Display progress description and percentage */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{description}</span>
        <span className="font-medium">{Math.round(displayProgress)}%</span>
      </div>

      {/* Progress bar using external Progress component */}
      <Progress 
        value={displayProgress} 
        className={cn(
          "transition-all duration-300",
          displayProgress >= 100 && "bg-green-100" // Change background color at 100%
        )}
        indicatorClassName={cn(
          "transition-all duration-300",
          displayProgress >= 100 && "bg-green-600" // Change indicator color at 100%
        )}
      />

      {/* Gradient shimmer effect */}
      <div 
        className={cn(
          "h-1 w-full rounded-full overflow-hidden relative",
          "bg-gradient-to-r from-blue-500/20 to-purple-500/20" // Faint background gradient
        )}
      >
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500",
            "animate-shimmer" // Animates shimmer effect while loading
          )}
          style={{
            width: `${displayProgress}%`, // Expands with progress
            transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)" // Smooth transition
          }}
        />
      </div>
    </div>
  )
}
