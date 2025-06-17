import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils"; // Utility function for merging class names dynamically.

/**
 * Badge Variants:
 * - Uses `cva` to define multiple styles for the `Badge` component.
 * - Supports different styling options via the `variant` prop.
 * - Includes accessibility features such as focus ring support.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80", // Primary style with hover effect.
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80", // Secondary badge style.
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80", // Warning/danger badge.
        outline: "text-foreground", // Simple outline variant.
      },
    },
    defaultVariants: {
      variant: "default", // Default styling.
    },
  },
);

/**
 * BadgeProps Interface:
 * - Extends default HTML span attributes.
 * - Adds support for `variant` prop using `VariantProps`.
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge Component:
 * - A small, stylized label with different variants.
 * - Uses `cva` for flexible styling.
 * - Can be customized with additional classes via `className`.
 * - Uses span instead of div to prevent DOM nesting issues.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
