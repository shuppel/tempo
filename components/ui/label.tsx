"use client" // Ensures this component runs only on the client side in Next.js.

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

/**
 * Label Variants:
 * - Defines base styles for the label using `cva`.
 * - Ensures readable typography and handles disabled states.
 */
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

/**
 * Label Component:
 * - A reusable label element with enhanced styling.
 * - Uses Radix UI's `LabelPrimitive.Root` for accessibility benefits.
 * - Supports `forwardRef` for better form integration.
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)} // Merges default and custom styles.
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

// Exporting the Label component for reuse.
export { Label }
