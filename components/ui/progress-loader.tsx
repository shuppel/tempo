import * as React from "react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ProgressLoaderProps {
  progress: number
  description?: string
  className?: string
}

export function ProgressLoader({
  progress,
  description,
  className,
}: ProgressLoaderProps) {
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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{description}</span>
        <span className="font-medium">{Math.round(displayProgress)}%</span>
      </div>
      <Progress 
        value={displayProgress} 
        className={cn(
          "transition-all duration-300",
          displayProgress >= 100 && "bg-green-100"
        )}
        indicatorClassName={cn(
          "transition-all duration-300",
          displayProgress >= 100 && "bg-green-600"
        )}
      />
      <div 
        className={cn(
          "h-1 w-full rounded-full overflow-hidden relative",
          "bg-gradient-to-r from-blue-500/20 to-purple-500/20"
        )}
      >
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500",
            "animate-shimmer"
          )}
          style={{
            width: `${displayProgress}%`,
            transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        />
      </div>
    </div>
  )
} 