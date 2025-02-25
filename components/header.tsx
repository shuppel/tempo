"use client"

import { Menu, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function Header() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Check if we're on a session page and extract the date
  const sessionMatch = pathname.match(/^\/session\/(\d{4}-\d{2}-\d{2})$/)
  const sessionDate = sessionMatch ? parseISO(sessionMatch[1]) : null

  return (
    <header className="relative border-b bg-gradient-to-r from-background to-card pt-4">
      {/* Logo Container */}
      <div className="absolute left-0 top-0 w-full">
        <div className="container flex md:px-8">
          <Link 
            href="/" 
            className="flex items-center gap-4 transition-transform hover:scale-[1.02] duration-150 pl-6 md:pl-0 lg:pl-4 mx-auto md:mx-0"
          >
            <div className="relative w-20 h-20">
              <Image
                src="/assets/logo/toro_logo.png"
                alt="Toro Logo"
                fill
                className="object-contain drop-shadow-[0_0_25px_rgba(56,189,248,0.2)]"
                priority
              />
            </div>
            <div className="flex flex-col justify-center h-20">
              <span className="text-2xl font-heading leading-none bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Toro
              </span>
              <span className="text-xs font-accent tracking-[0.2em] text-muted-foreground/80 uppercase">
                Task Pomodoro
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Navigation Container */}
      <div className="container mx-auto flex h-20 items-center justify-end md:px-8">
        <div className="flex items-center gap-4 px-4">
          {/* Desktop Navigation */}
          <Tabs value={pathname} className="hidden lg:block">
            <TabsList className="bg-background/50 backdrop-blur-sm border-2 h-12">
              <Link href="/">
                <TabsTrigger 
                  value="/" 
                  className="font-accent tracking-wide text-base h-10 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner"
                >
                  Plan
                </TabsTrigger>
              </Link>
              <Link href="/sessions">
                <TabsTrigger 
                  value="/sessions" 
                  className="font-accent tracking-wide text-base h-10 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner"
                >
                  Sessions
                </TabsTrigger>
              </Link>
              {sessionDate && (
                <TabsTrigger 
                  value={pathname}
                  className="font-accent tracking-wide text-base h-10 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-inner animate-in fade-in-50 slide-in-from-left-1"
                >
                  {format(sessionDate, 'MMM d yyyy')}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <Button 
            variant="ghost" 
            size="icon"
            className="bg-background/50 backdrop-blur-sm border-2 h-12 w-12"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden bg-background/50 backdrop-blur-sm border-2 h-12 w-12"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4 pt-8">
                <Link 
                  href="/"
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-md hover:bg-primary/10 transition-colors",
                    pathname === "/" && "bg-primary/20 text-primary"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="font-accent tracking-wide text-base">Plan</span>
                </Link>
                <Link 
                  href="/sessions"
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-md hover:bg-primary/10 transition-colors",
                    pathname === "/sessions" && "bg-primary/20 text-primary"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="font-accent tracking-wide text-base">Sessions</span>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

