"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useMemo } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return useMemo(
    () => <NextThemesProvider {...props}>{children}</NextThemesProvider>,
    [props, children],
  );
}
