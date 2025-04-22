import * as React from "react";
import { cn } from "@/lib/utils"; // Utility function for merging class names dynamically.

interface CircularProgressProps {
  progress: number; // Current progress value (0-100).
  size?: number; // Diameter of the circular progress indicator.
  strokeWidth?: number; // Thickness of the stroke.
  className?: string; // Additional custom styling classes.
}

/**
 * CircularProgress Component:
 * - Displays an animated circular progress indicator.
 * - Uses an SVG with two circles (one for the track and one for progress).
 * - Smoothly animates progress updates using `useEffect`.
 */
export function CircularProgress({
  progress,
  size = 40,
  strokeWidth = 4,
  className,
}: CircularProgressProps) {
  const [displayProgress, setDisplayProgress] = React.useState(0);
  const animationRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    // Guard: Only animate if displayProgress !== progress
    if (displayProgress === progress) return;
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    const duration = 500; // Animation duration in milliseconds.
    const steps = 60; // Number of animation steps for smoothness.
    const stepDuration = duration / steps; // Time per step.
    const increment = (progress - displayProgress) / steps; // Value increment per step.

    let currentStep = 0;
    animationRef.current = setInterval(() => {
      if (currentStep >= steps) {
        if (animationRef.current) clearInterval(animationRef.current);
        setDisplayProgress(progress); // Ensure the final value is exact.
      } else {
        setDisplayProgress((prev) => prev + increment);
        currentStep++;
      }
    }, stepDuration);

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [progress, displayProgress]);

  // Calculate circle dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayProgress / 100) * circumference;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      {/* SVG container for the circular progress bar */}
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background Circle (Track) */}
        <circle
          className="text-muted"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Circle */}
        <circle
          className="text-primary transition-all duration-300 ease-in-out"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference} // Total length of the circle path.
          strokeDashoffset={offset} // Controls how much of the stroke is visible.
          strokeLinecap="round" // Rounds the edges of the progress indicator.
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Centered Progress Percentage */}
      <span className="absolute text-xs font-medium">
        {Math.round(displayProgress)}%
      </span>
    </div>
  );
}
