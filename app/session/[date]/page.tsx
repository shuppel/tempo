"use client"

import React from "react"
import { useState, useEffect } from "react"
import { use } from "react"
import { SessionStorageService } from "@/app/features/session-manager"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion } from "framer-motion"
import { ArrowRight, X } from "lucide-react"
import { Session, SessionStatus } from "@/lib/types"
import { useRouter } from "next/navigation"
import { format, parse } from "date-fns"
import { cn } from "@/lib/utils"
import { getSessionTimeEstimates } from "@/lib/durationUtils"
import { SessionView } from "@/app/features/session-manager"

// Create a custom DialogContent without the close button
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

interface PageParams {
  date: string
}

interface SessionPageProps {
  params: { date: string } | Promise<{ date: string }>
}

export default function SessionPage({ params }: SessionPageProps) {
  // Unwrap params using React.use() as recommended by Next.js
  const unwrappedParams = params instanceof Promise ? use(params) : params
  const { date } = unwrappedParams
  const router = useRouter()
  
  const storageService = new SessionStorageService()
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [showStartModal, setShowStartModal] = useState(false)
  
  // Format date for display (MM/DD/YYYY)
  const formattedDate = date ? 
    format(parse(date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy') : 
    'Invalid date'
  
  // Check if the session exists
  useEffect(() => {
    async function checkSession() {
      console.log(`[SessionPage] Checking for session on date: ${date}`)
      try {
        const session = await storageService.getSession(date)
        setHasSession(!!session)
        setSessionData(session)
        
        // Show modal if session exists but is in 'planned' status
        if (session && session.status === 'planned') {
          setShowStartModal(true)
        }
        
        console.log(`[SessionPage] Session found for date ${date}:`, !!session)
      } catch (error) {
        console.error(`[SessionPage] Error checking for session on date ${date}:`, error)
        setHasSession(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkSession()
    
    // Set up an interval to refresh the session data if the modal is shown
    let intervalId: NodeJS.Timeout | null = null;
    
    if (showStartModal) {
      intervalId = setInterval(() => {
        checkSession();
      }, 30000); // Check every 30 seconds
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [date, showStartModal])

  // Get time estimates using the utility function
  const { totalTime, estimatedEnd } = sessionData ? 
    getSessionTimeEstimates(sessionData.totalDuration) : 
    { totalTime: '0 min', estimatedEnd: 'N/A' };

  const handleStartSession = async () => {
    if (!sessionData) return;
    
    try {
      // Update session with in-progress status
      const updatedSession: Session = {
        ...sessionData,
        status: 'in-progress' as SessionStatus,
        lastUpdated: new Date().toISOString()
      }
      await storageService.saveSession(date, updatedSession)
      setSessionData(updatedSession)
      setShowStartModal(false)
    } catch (error) {
      console.error("Failed to start session:", error)
    }
  }
  
  const handleCloseModal = () => {
    // Navigate back to sessions list when user closes modal
    router.push("/sessions")
  }
  
  if (isLoading) {
    return (
      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <p>Loading session...</p>
        </div>
      </main>
    )
  }
  
  if (!hasSession) {
    return (
      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p>No session was found for the date: {date}</p>
          <p className="mt-4">
            <a href="/sessions" className="text-blue-500 hover:underline">
              Return to Sessions List
            </a>
          </p>
        </div>
      </main>
    )
  }
  
  // If the session exists but is in 'planned' status and the modal is not showing,
  // force it to show to prevent access to the underlying session
  if (sessionData?.status === 'planned' && !showStartModal) {
    setShowStartModal(true)
  }
  
  return (
    <main className="flex-1 container py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Only render the session view if explicitly allowed */}
        {(sessionData?.status !== 'planned' || !showStartModal) && (
          <SessionView id={date} storageService={storageService} />
        )}
        
        {/* Artistic Start Session Modal */}
        <Dialog 
          open={showStartModal} 
          onOpenChange={(open) => {
            if (!open) handleCloseModal()
          }}
          modal={true} // Force modal behavior
        >
          <DialogContent 
            className="sm:max-w-md bg-[#f0f4fa] dark:bg-gray-900 rounded-lg p-0 border-0 dark:border dark:border-gray-800"
            onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing with Escape key
            onPointerDownOutside={(e) => e.preventDefault()} // Prevent closing by clicking outside
            onInteractOutside={(e) => e.preventDefault()} // Prevent any interaction outside
          >
            <div className="relative p-6">
              {/* Close button */}
              <button 
                onClick={handleCloseModal}
                className="absolute right-6 top-6 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close and return to sessions"
              >
                <X className="h-5 w-5" />
              </button>

              {/* DialogTitle for accessibility - visually hidden */}
              <DialogTitle className="sr-only">Start Session</DialogTitle>

              {/* Header */}
              <h2 className="text-3xl font-medium text-center mb-2 dark:text-gray-100">Ready to Focus?</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                Your work session is prepared and waiting for you.
              </p>
              
              {/* Content */}
              <div className="flex gap-4 mb-8">
                {/* Calendar card */}
                <div className="flex-1 bg-[#e4e9f7] dark:bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center text-center dark:text-gray-200">
                  <svg className="h-10 w-10 text-blue-700 dark:text-blue-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span className="text-sm font-medium">{formattedDate}</span>
                </div>
                
                {/* Timer info card */}
                <div className="flex-[2] bg-[#e4e9f7] dark:bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center text-center dark:text-gray-200">
                  <svg className="h-10 w-10 text-blue-700 dark:text-blue-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Total time: <span className="font-semibold">{totalTime}</span></p>
                    <p className="text-sm font-medium">Est. completion: <span className="font-semibold">{estimatedEnd}</span></p>
                  </div>
                </div>
              </div>
              
              {/* Start Session Button */}
              <motion.div 
                className="w-full mb-4"
                whileHover={{ scale: 1.02 }}
                initial={{ scale: 1 }}
                animate={{ 
                  scale: [1, 1.03, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(29, 78, 216, 0)",
                    "0 0 0 6px rgba(29, 78, 216, 0.2)",
                    "0 0 0 0 rgba(29, 78, 216, 0)"
                  ]
                }}
                transition={{ 
                  repeat: 3,
                  repeatDelay: 2,
                  duration: 1.5,
                  ease: "easeInOut"
                }}
              >
                <Button 
                  onClick={handleStartSession} 
                  className="w-full py-5 text-lg font-medium bg-blue-700 hover:bg-blue-800 text-white relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center w-full">
                    Start Your Session
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                </Button>
              </motion.div>
              
              {/* Return to Sessions button */}
              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={handleCloseModal}
                  className="mt-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Return to Sessions
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
} 