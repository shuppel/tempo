import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

/**
 * Alert Variants:
 * - Defines styling variations using `cva`.
 * - Supports `default` and `destructive` variants.
 * - Uses Tailwind classes for styling.
 */
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground", // Default appearance.
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive", // Error/danger style.
      },
    },
    defaultVariants: {
      variant: "default", // Default variant if none is specified.
    },
  }
)

/**
 * Alert Component:
 * - Provides a styled alert container with optional icons.
 * - Supports different variants (`default`, `destructive`).
 * - Uses `forwardRef` to support external refs.
 */
const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert" // Accessibility role for screen readers.
    className={cn(alertVariants({ variant }), className)} // Merges variant and custom classes.
    {...props}
  />
))
Alert.displayName = "Alert"

/**
 * AlertTitle Component:
 * - Serves as the title of the alert.
 * - Uses `h5` for semantic meaning.
 */
const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)} // Consistent text styling.
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

/**
 * AlertDescription Component:
 * - Provides additional descriptive text within an alert.
 * - Supports nested `<p>` elements for readability.
 */
const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)} // Ensures consistent paragraph spacing.
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

// Exporting all components for modular use.
export { Alert, AlertTitle, AlertDescription }
