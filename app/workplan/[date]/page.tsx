"use client"

import React from "react"
import { useState, useEffect } from "react"
import { use } from "react"
import { WorkPlanStorageService } from "@/app/features/workplan-manager/services/workplan-storage.service"
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
import { TodoWorkPlan, TodoWorkPlanStatus } from "@/lib/types"
import { useRouter } from "next/navigation"
import { format, parse } from "date-fns"
import { cn } from "@/lib/utils"
import { getWorkPlanTimeEstimates } from "@/lib/durationUtils"
import { WorkPlanView } from "@/app/features/workplan-manager/components/workplan-view"

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

interface WorkPlanPageProps {
  params: { date: string } | Promise<{ date: string }>
}

export default function WorkPlanPage({ params }: WorkPlanPageProps) {
  // Unwrap params using React.use() as recommended by Next.js
  const unwrappedParams = params instanceof Promise ? use(params) : params
  const { date } = unwrappedParams
  const router = useRouter()
  
  const storageService = new WorkPlanStorageService()
  const [isLoading, setIsLoading] = useState(true)
  const [hasWorkPlan, setHasWorkPlan] = useState(false)
  const [workplanData, setWorkPlanData] = useState<TodoWorkPlan | null>(null)
  const [showStartModal, setShowStartModal] = useState(false)
  
  // Format date for display (MM/DD/YYYY)
  const formattedDate = date ? 
    format(parse(date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy') : 
    'Invalid date'
  
  // Check if the workplan exists
  useEffect(() => {
    async function checkWorkPlan() {
      console.log(`[WorkPlanPage] Checking for workplan on date: ${date}`)
      try {
        const workplan = await storageService.getWorkPlan(date)
        setHasWorkPlan(!!workplan)
        setWorkPlanData(workplan)
        
        // Show modal if workplan exists but is in 'planned' status
        if (workplan && workplan.status === 'planned') {
          setShowStartModal(true)
        }
        
        console.log(`[WorkPlanPage] WorkPlan found for date ${date}:`, !!workplan)
      } catch (error) {
        console.error(`[WorkPlanPage] Error checking for workplan on date ${date}:`, error)
        setHasWorkPlan(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkWorkPlan()
    
    // Set up an interval to refresh the workplan data if the modal is shown
    let intervalId: NodeJS.Timeout | null = null;
    
    if (showStartModal) {
      intervalId = setInterval(() => {
        checkWorkPlan();
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
  const { totalTime, estimatedEnd } = workplanData ? 
    getWorkPlanTimeEstimates(workplanData.totalDuration) : 
    { totalTime: '0 min', estimatedEnd: 'N/A' };

  const handleStartWorkPlan = async () => {
    if (!workplanData) return;
    
    try {
      // Update workplan with in-progress status
      const updatedWorkPlan: TodoWorkPlan = {
        ...workplanData,
        status: 'in-progress' as TodoWorkPlanStatus,
        lastUpdated: new Date().toISOString()
      }
      await storageService.saveWorkPlan(updatedWorkPlan)
      setWorkPlanData(updatedWorkPlan)
      setShowStartModal(false)
    } catch (error) {
      console.error("Failed to start workplan:", error)
    }
  }
  
  const handleCloseModal = () => {
    // Navigate back to workplans list when user closes modal
    router.push("/workplans")
  }
  
  if (isLoading) {
    return (
      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <p>Loading workplan...</p>
        </div>
      </main>
    )
  }
  
  if (!hasWorkPlan) {
    return (
      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">WorkPlan Not Found</h1>
          <p>No workplan was found for the date: {date}</p>
          <p className="mt-4">
            <a href="/workplans" className="text-blue-500 hover:underline">
              Return to WorkPlans List
            </a>
          </p>
        </div>
      </main>
    )
  }
  
  // If the workplan exists but is in 'planned' status and the modal is not showing,
  // force it to show to prevent access to the underlying workplan
  if (workplanData?.status === 'planned' && !showStartModal) {
    setShowStartModal(true)
  }
  
  return (
    <main className="flex-1 container py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Only render the workplan view if explicitly allowed */}
        {(workplanData?.status !== 'planned' || !showStartModal) && (
          <WorkPlanView id={date} storageService={storageService} />
        )}
        
        {/* Artistic Start WorkPlan Modal */}
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
                aria-label="Close and return to workplans"
              >
                <X className="h-5 w-5" />
              </button>

              {/* DialogTitle for accessibility - visually hidden */}
              <DialogTitle className="sr-only">Start WorkPlan</DialogTitle>

              {/* Header */}
              <h2 className="text-3xl font-medium text-center mb-2 dark:text-gray-100">Ready to Focus?</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                Your work plan is prepared and waiting for you.
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
              
              {/* Start WorkPlan Button */}
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
                  onClick={handleStartWorkPlan} 
                  className="w-full py-5 text-lg font-medium bg-blue-700 hover:bg-blue-800 text-white relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center w-full">
                    Start Your Work Plan
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                </Button>
              </motion.div>
              
              {/* Return to WorkPlans button */}
              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={handleCloseModal}
                  className="mt-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Return to WorkPlans
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
} 