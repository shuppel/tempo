"use client" // Ensures this component runs only on the client side in a Next.js environment.

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils" // Utility function for merging class names.

const Accordion = AccordionPrimitive.Root // Root accordion component from Radix UI.

/**
 * AccordionItem Component:
 * - Wraps each item in the accordion.
 * - Extends Radix UI’s `AccordionPrimitive.Item` with additional styles.
 * - Uses `forwardRef` to maintain ref forwarding for external usage.
 */
const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)} // Adds a bottom border to each item.
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

/**
 * AccordionTrigger Component:
 * - Serves as the clickable trigger to expand/collapse accordion items.
 * - Uses `AccordionPrimitive.Trigger` from Radix UI.
 * - Includes an animated `ChevronDown` icon that rotates on open/close.
 */
const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex"> {/* Ensures proper layout for trigger and icon. */}
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /> {/* Rotates when expanded */}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

/**
 * AccordionContent Component:
 * - Wraps the collapsible content inside an accordion item.
 * - Uses Radix UI’s `AccordionPrimitive.Content`.
 * - Animates open/close transitions via Tailwind utilities.
 */
const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div> {/* Adds padding to the content. */}
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }  
