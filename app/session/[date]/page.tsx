"use client"

import { use } from "react"
import { SessionView } from "@/components/session-view"

interface PageParams {
  date: string
}

interface SessionPageProps {
  params: Promise<PageParams>
}

export default function SessionPage({ params }: SessionPageProps) {
  const { date } = use(params)
  
  return (
    <main className="flex-1 container py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <SessionView date={date} />
      </div>
    </main>
  )
} 