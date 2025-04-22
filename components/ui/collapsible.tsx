"use client"; // Ensures the component runs only on the client side in Next.js.

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/**
 * Collapsible Component:
 * - Root container for a collapsible section.
 * - Manages open/closed state using Radix UI's primitive.
 */
const Collapsible = CollapsiblePrimitive.Root;

/**
 * CollapsibleTrigger Component:
 * - Acts as a button or interactive element to toggle the collapsible content.
 * - Typically wraps a button or other clickable element.
 */
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

/**
 * CollapsibleContent Component:
 * - Contains the content that is shown or hidden when toggled.
 * - Animates visibility changes with Radix UI's built-in logic.
 */
const CollapsibleContent = CollapsiblePrimitive.Content;

// Exporting components for modular use.
export { Collapsible, CollapsibleTrigger, CollapsibleContent };
