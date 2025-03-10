import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Menu, Activity, Clock, AlertCircle } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{
      background: 'var(--panel-bg)',
      borderBottom: '2px solid var(--panel-highlight)',
      boxShadow: 'var(--screen-glow)',
    }}>
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded flex items-center justify-center" style={{ 
            background: 'var(--panel-light)', 
            border: '1px solid var(--panel-highlight)',
            boxShadow: '0 0 6px var(--panel-highlight)',
          }}>
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-primary blur-in-h" style={{ 
              fontFamily: 'var(--font-text-me-one)',
              letterSpacing: '1px',
            }}>TORODORO</span>
            <span className="text-xs text-muted-foreground" style={{ 
              fontFamily: 'var(--font-text-me-one)',
            }}>COMMAND CENTER</span>
          </div>
        </Link>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="hidden md:flex items-center">
            <div className="led led-green"></div>
            <span className="text-xs font-mono mr-4">SYSTEM ACTIVE</span>
          </div>
          
          <Link href="/workplans" className="command-button">
            <span className="flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Work Plans
            </span>
          </Link>
          
          <Link href="/sessions" className="command-button">
            <span className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Sessions
            </span>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="command-button">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="crt-screen py-2" style={{
              border: '1px solid var(--panel-highlight)',
            }}>
              <DropdownMenuItem asChild className="hover:bg-primary/20">
                <Link href="/workplans" className="flex items-center py-1">
                  <Activity className="h-4 w-4 mr-2" />
                  Work Plans
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-primary/20">
                <Link href="/sessions" className="flex items-center py-1">
                  <Clock className="h-4 w-4 mr-2" />
                  Sessions
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
} 