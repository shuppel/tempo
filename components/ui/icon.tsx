import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "muted" | "accent" | "default";
}

export function Icon({
  icon: IconComponent,
  size = "md",
  color = "default",
  className,
  ...props
}: IconProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    muted: "text-muted-foreground",
    accent: "text-accent",
    default: "text-foreground",
  };

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      <IconComponent className={cn(sizeClasses[size], colorClasses[color])} />
    </div>
  );
}
