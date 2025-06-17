import * as React from "react";

import { cn } from "@/lib/utils"; // Utility function for merging class names dynamically.

/**
 * Input Component:
 * - Linear-inspired input with clean, minimal styling.
 * - Features subtle borders and transition effects.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-muted-foreground/25 transition-colors duration-150",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

// Exporting the component for reuse.
export { Input };
