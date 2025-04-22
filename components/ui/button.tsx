import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"; // Utility function for merging class names dynamically.

/**
 * Button Variants:
 * - Linear-inspired minimal design.
 * - Supports different styling options via the `variant` and `size` props.
 * - Includes refined transitions and focus styles.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-none", // Linear-inspired primary button
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80", // Subtle secondary button
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90", // Warning/Danger button
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground", // Outlined button with hover effect
        ghost: "hover:bg-secondary text-foreground hover:text-foreground", // Ghost button with minimal hover effect
        link: "text-primary underline-offset-4 hover:underline", // Link-style button
        neutral: "bg-secondary/30 text-foreground hover:bg-secondary/50", // Neutral button for less emphasis
      },
      size: {
        default: "h-9 px-3 py-2", // Standard size
        sm: "h-8 rounded-md px-2.5 text-xs", // Small button
        lg: "h-10 rounded-md px-4", // Large button
        icon: "h-9 w-9 p-0", // Square icon button
        pill: "h-8 rounded-full px-3 text-xs", // Linear-style pill button
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * ButtonProps Interface:
 * - Extends default HTML button attributes.
 * - Supports `variant` and `size` props via `VariantProps`.
 * - Includes `asChild` to allow rendering as a different component.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean; // If true, renders as a child component instead of a button.
}

/**
 * Button Component:
 * - A clean, minimal button inspired by Linear's design.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"; // Uses `Slot` if `asChild` is true, otherwise defaults to `button`.
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))} // Merges class variants and custom classes.
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// Exporting the Button component and its variants.
export { Button, buttonVariants };
