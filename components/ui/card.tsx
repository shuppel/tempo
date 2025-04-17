import * as React from "react"

import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

/**
 * Card Component:
 * - Linear-inspired card with minimal styling.
 * - Provides subtle border, clean background, and soft shadow.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border/40 bg-card text-card-foreground shadow-linear-card",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

/**
 * CardHeader Component:
 * - Clean header section with consistent spacing.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * CardTitle Component:
 * - Minimal, clean title with appropriate weight.
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-medium leading-none", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

/**
 * CardDescription Component:
 * - Subtle, muted description text.
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * CardContent Component:
 * - Content area with appropriate padding.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

/**
 * CardFooter Component:
 * - Footer with consistent spacing and alignment.
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Exporting all components for modular use.
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
