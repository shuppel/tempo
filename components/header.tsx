"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format, parseISO } from "date-fns"

export function Header() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  // Check if we're on a session page and extract the date
  const sessionMatch = pathname.match(/^\/session\/(\d{4}-\d{2}-\d{2})$/)
  const sessionDate = sessionMatch ? parseISO(sessionMatch[1]) : null

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 transition-colors hover:opacity-90">
            <span className="text-2xl font-bold">🐂 Toro</span>
            <span className="text-sm text-muted-foreground">Task Pomodoro</span>
          </Link>
          
          <Tabs value={pathname} className="hidden sm:block">
            <TabsList>
              <Link href="/">
                <TabsTrigger value="/">Plan</TabsTrigger>
              </Link>
              <Link href="/sessions">
                <TabsTrigger value="/sessions">Sessions</TabsTrigger>
              </Link>
              {sessionDate && (
                <TabsTrigger 
                  value={pathname}
                  className="animate-in fade-in-50 slide-in-from-left-1"
                >
                  {format(sessionDate, 'MMM d yyyy')}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  )
}

