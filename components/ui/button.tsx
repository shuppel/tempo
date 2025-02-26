import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

/**
 * Button Variants:
 * - Uses `cva` to define multiple styles for the `Button` component.
 * - Supports different styling options via the `variant` and `size` props.
 * - Includes accessibility features such as focus-visible ring.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90", // Standard button style.
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90", // Warning/Danger button.
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground", // Outlined button with hover effect.
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80", // Secondary button style.
        ghost: "hover:bg-accent hover:text-accent-foreground", // Minimalist button with hover effect.
        link: "text-primary underline-offset-4 hover:underline", // Link-style button.
      },
      size: {
        default: "h-9 px-4 py-2", // Standard size.
        sm: "h-8 rounded-md px-3 text-xs", // Small button.
        lg: "h-10 rounded-md px-8", // Large button.
        icon: "h-9 w-9", // Square icon button.
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * ButtonProps Interface:
 * - Extends default HTML button attributes.
 * - Supports `variant` and `size` props via `VariantProps`.
 * - Includes `asChild` to allow rendering as a different component.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean // If true, renders as a child component instead of a button.
}

/**
 * Button Component:
 * - A reusable button with various styles and sizes.
 * - Supports different element types via `asChild` (e.g., `a`, `div`).
 * - Uses `cva` for flexible styling.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button" // Uses `Slot` if `asChild` is true, otherwise defaults to `button`.
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))} // Merges class variants and custom classes.
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Exporting the Button component and its variants.
export { Button, buttonVariants }
