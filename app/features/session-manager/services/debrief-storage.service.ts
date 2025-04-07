"use client"

import { useState } from 'react'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'

export interface SessionMetrics {
  totalTimeSpent: number
  plannedTime: number
  timeSaved: number
  averageBreakTime: number
  focusRating: number
  focusConsistency: number
  longestFocusStretch: number
  taskCompletionSpeed: number
}

export interface SessionDebriefData {
  sessionDate: string
  productivity: number
  stress: number
  satisfaction: number
  energy: number
  focus: number
  metrics?: SessionMetrics
  lastUpdated?: string
}

/**
 * Service for managing session debrief data storage and retrieval
 */
export class DebriefStorageService {
  private readonly DEBRIEF_STORAGE_KEY = 'torodoro-session-debriefs'

  /**
   * Save session debrief data
   * 
   * @param debriefData - The debrief data to save
   * @returns A promise that resolves to true if successfully saved
   */
  async saveDebriefData(debriefData: SessionDebriefData): Promise<boolean> {
    try {
      // Get existing debriefs
      const existingDebriefs = this.getAllDebriefs()
      
      // Add new debrief data or replace existing one for the same session
      const updatedDebriefs = existingDebriefs.filter(
        debrief => debrief.sessionDate !== debriefData.sessionDate
      )
      updatedDebriefs.push({
        ...debriefData,
        lastUpdated: new Date().toISOString(),
      })
      
      // Save to localStorage
      localStorage.setItem(
        this.DEBRIEF_STORAGE_KEY,
        JSON.stringify(updatedDebriefs)
      )
      
      return true
    } catch (error) {
      console.error('Failed to save debrief data:', error)
      return false
    }
  }
  
  /**
   * Get debrief data for a specific session
   * 
   * @param sessionDate - The date of the session to retrieve debrief data for
   * @returns The debrief data for the specified session, or null if not found
   */
  getDebriefData(sessionDate: string): SessionDebriefData | null {
    try {
      const allDebriefs = this.getAllDebriefs()
      return allDebriefs.find(debrief => debrief.sessionDate === sessionDate) || null
    } catch (error) {
      console.error('Failed to retrieve debrief data:', error)
      return null
    }
  }
  
  /**
   * Get all saved debrief data
   * 
   * @returns An array of all saved debrief data
   */
  getAllDebriefs(): SessionDebriefData[] {
    try {
      const debriefDataJson = localStorage.getItem(this.DEBRIEF_STORAGE_KEY)
      return debriefDataJson ? JSON.parse(debriefDataJson) : []
    } catch (error) {
      console.error('Failed to retrieve all debrief data:', error)
      return []
    }
  }
  
  /**
   * Delete debrief data for a specific session
   * 
   * @param sessionDate - The date of the session to delete debrief data for
   * @returns A promise that resolves to true if successfully deleted
   */
  async deleteDebriefData(sessionDate: string): Promise<boolean> {
    try {
      const existingDebriefs = this.getAllDebriefs()
      const updatedDebriefs = existingDebriefs.filter(
        debrief => debrief.sessionDate !== sessionDate
      )
      
      localStorage.setItem(
        this.DEBRIEF_STORAGE_KEY,
        JSON.stringify(updatedDebriefs)
      )
      
      return true
    } catch (error) {
      console.error('Failed to delete debrief data:', error)
      return false
    }
  }
}

/**
 * Hook for interacting with session debrief data using TanStack Query
 */
export function useDebriefStorage() {
  const [isSaving, setIsSaving] = useState(false)
  const [debriefs, setDebriefs] = useLocalStorage<SessionDebriefData[]>('session-debriefs', [])

  const saveDebrief = async (data: SessionDebriefData) => {
    setIsSaving(true)
    
    try {
      // Get current debriefs
      const currentDebriefs = debriefs || []
      
      // Check if a debrief for this session date already exists
      const existingIndex = currentDebriefs.findIndex(d => d.sessionDate === data.sessionDate)
      
      if (existingIndex >= 0) {
        // Update existing debrief
        const updatedDebriefs = [...currentDebriefs]
        updatedDebriefs[existingIndex] = {
          ...data,
          // Add a timestamp for when this was last updated
          lastUpdated: new Date().toISOString()
        }
        setDebriefs(updatedDebriefs)
      } else {
        // Add new debrief
        setDebriefs([
          ...currentDebriefs,
          {
            ...data,
            // Add a timestamp for when this was created/updated
            lastUpdated: new Date().toISOString()
          }
        ])
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      return true
    } catch (error) {
      console.error('Error saving debrief:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const getDebrief = (sessionDate: string): SessionDebriefData | undefined => {
    return debriefs?.find((d: SessionDebriefData) => d.sessionDate === sessionDate)
  }

  const getAllDebriefs = (): SessionDebriefData[] => {
    return debriefs || []
  }

  return {
    saveDebrief,
    getDebrief,
    getAllDebriefs,
    isSaving
  }
} 