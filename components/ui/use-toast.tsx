"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { VariantProps, cva } from "class-variance-authority"
import { X } from "lucide-react"

const ToastProvider = React.createContext<{
  toast: (props: ToastProps) => void
  dismiss: (id: string) => void
}>({
  toast: () => {},
  dismiss: () => {},
})

export const useToast = () => {
  return React.useContext(ToastProvider)
}

export type ToastProps = {
  id?: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success"
  duration?: number
}

type ToastState = {
  toasts: Array<ToastProps & { id: string }>
}

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full data-[state=open]:sm:slide-in-from-bottom-full data-[state=closed]:slide-out-to-right-full",
  {
    variants: {
      variant: {
        default: "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700",
        destructive:
          "group destructive bg-red-50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-800 dark:text-red-300",
        success: "group success bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-800 dark:text-green-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export function ToastViewport({
  className,
  ...props
}: React.HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
}

export function Toast({
  className,
  title,
  description,
  variant,
  action,
  onClose,
  ...props
}: VariantProps<typeof toastVariants> &
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string
    description?: string
    action?: React.ReactNode
    onClose?: () => void
  }) {
  return (
    <div
      className={cn(toastVariants({ variant }), className)}
      {...props}>
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      {action}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-500 opacity-0 transition-opacity hover:text-gray-900 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  )
}

export function Toaster() {
  const [state, setState] = React.useState<ToastState>({
    toasts: [],
  })

  const dismiss = React.useCallback((id: string) => {
    setState((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  }, [])

  const toast = React.useCallback((props: ToastProps) => {
    const id = props.id || String(Math.random())
    
    setState((state) => {
      const toasts = state.toasts.concat({
        ...props,
        id,
      }).slice(-TOAST_LIMIT)
      
      return {
        toasts,
      }
    })

    return id
  }, [])

  return (
    <ToastProvider.Provider value={{ toast, dismiss }}>
      <ToastViewport>
        {state.toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            action={toast.action}
            variant={toast.variant}
            onClose={() => dismiss(toast.id)}
            className="mb-2"
          />
        ))}
      </ToastViewport>
    </ToastProvider.Provider>
  )
}

// Actual toast function exported for use throughout the app
export const toast = (props: ToastProps) => {
  const id = props.id || String(Math.random())
  const toastDuration = props.duration || 5000
  
  // Create the toast element
  const toastElement = document.createElement('div')
  toastElement.id = `toast-${id}`
  toastElement.className = cn(
    toastVariants({ variant: props.variant }),
    "fixed bottom-4 right-4 z-50 max-w-md animate-in fade-in-0 slide-in-from-bottom-5"
  )
  
  // Create the toast content
  const content = document.createElement('div')
  content.className = "grid gap-1"
  
  if (props.title) {
    const title = document.createElement('div')
    title.className = "text-sm font-semibold"
    title.textContent = props.title
    content.appendChild(title)
  }
  
  if (props.description) {
    const description = document.createElement('div')
    description.className = "text-sm opacity-90"
    description.textContent = props.description
    content.appendChild(description)
  }
  
  toastElement.appendChild(content)
  
  // Add close button
  const closeButton = document.createElement('button')
  closeButton.className = "absolute right-2 top-2 rounded-md p-1 text-gray-500 opacity-0 transition-opacity hover:text-gray-900 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 dark:text-gray-400 dark:hover:text-gray-100"
  closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="sr-only">Close</span>`
  
  closeButton.addEventListener('click', () => {
    toastElement.classList.add('animate-out', 'fade-out-0', 'slide-out-to-right-5')
    setTimeout(() => {
      toastElement.remove()
    }, 300)
  })
  
  toastElement.appendChild(closeButton)
  
  // Add to document
  document.body.appendChild(toastElement)
  
  // Auto-dismiss after duration
  setTimeout(() => {
    toastElement.classList.add('animate-out', 'fade-out-0', 'slide-out-to-right-5')
    setTimeout(() => {
      toastElement.remove()
    }, 300)
  }, toastDuration)
  
  return id
} 