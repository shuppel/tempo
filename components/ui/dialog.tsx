"use client" // Ensures this component runs only on the client side in Next.js.

import * as React from "react"
import { memo } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils" // Utility function for merging class names dynamically.

/**
 * Dialog Component:
 * - Linear-inspired dialog component.
 */
const Dialog = DialogPrimitive.Root

/**
 * DialogTrigger Component:
 * - Element that opens the dialog.
 */
const DialogTrigger = DialogPrimitive.Trigger

/**
 * DialogPortal Component:
 * - Renders dialog outside of DOM hierarchy.
 */
const DialogPortal = DialogPrimitive.Portal

/**
 * DialogClose Component:
 * - Button that closes the dialog.
 */
const DialogClose = DialogPrimitive.Close

/**
 * DialogOverlay Component:
 * - Clean, minimal overlay with subtle animation.
 */
const DialogOverlay = memo(
  React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
  >(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm data-[state=open]:animate-linear-in data-[state=closed]:animate-linear-out",
        className
      )}
      {...props}
    />
  ))
)
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * DialogContent Component:
 * - Linear-inspired clean dialog content.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-3",
        "bg-background p-5 shadow-linear-dropdown border border-border/40 duration-150",
        "data-[state=open]:animate-linear-in data-[state=closed]:animate-linear-out",
        "sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-full p-1 opacity-70 ring-offset-background transition-opacity hover:bg-secondary/80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * DialogHeader Component:
 * - Linear-inspired header with minimal spacing.
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1 text-left mb-3",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * DialogFooter Component:
 * - Clean footer with right-aligned actions.
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-row items-center justify-end space-x-2 pt-3",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

/**
 * DialogTitle Component:
 * - Clean, minimal title with appropriate weight.
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-medium leading-none",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * DialogDescription Component:
 * - Subtle description text.
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Exporting all components for modular use.
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
