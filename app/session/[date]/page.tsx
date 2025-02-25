"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { SessionView, SessionStorageService } from "@/app/features/session-manager"

interface PageParams {
  date: string
}

interface SessionPageProps {
  params: PageParams | Promise<PageParams>
}

// Create a singleton instance 
const storageService = new SessionStorageService()

export default function SessionPage({ params }: SessionPageProps) {
  // Unwrap params using React.use() as recommended by Next.js
  const unwrappedParams = params instanceof Promise ? use(params) : params
  const { date } = unwrappedParams
  
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  
  // Check if the session exists
  useEffect(() => {
    async function checkSession() {
      console.log(`[SessionPage] Checking for session on date: ${date}`)
      try {
        const session = await storageService.getSession(date)
        setHasSession(!!session)
        console.log(`[SessionPage] Session found for date ${date}:`, !!session)
      } catch (error) {
        console.error(`[SessionPage] Error checking for session on date ${date}:`, error)
        setHasSession(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkSession()
  }, [date])
  
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
  
  return (
    <main className="flex-1 container py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <SessionView id={date} storageService={storageService} />
      </div>
    </main>
  )
} 