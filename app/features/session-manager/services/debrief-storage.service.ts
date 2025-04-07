"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SessionDebriefData } from "../components/session-debrief-modal"

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
  const queryClient = useQueryClient()
  const storageService = new DebriefStorageService()
  
  // Query key for all debriefs
  const allDebriefsKey = ['debriefs'] as const
  
  // Query for fetching all debriefs
  const { data: allDebriefs = [] } = useQuery({
    queryKey: allDebriefsKey,
    queryFn: () => storageService.getAllDebriefs(),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  })
  
  // Query for fetching a specific debrief by session date
  const useDebriefData = (sessionDate: string) => {
    const queryKey = ['debriefs', sessionDate] as const
    
    return useQuery({
      queryKey,
      queryFn: () => storageService.getDebriefData(sessionDate),
      staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    })
  }
  
  // Mutation for saving a debrief
  const saveDebriefMutation = useMutation({
    mutationFn: (debriefData: SessionDebriefData) => storageService.saveDebriefData(debriefData),
    onSuccess: (_, variables) => {
      // Invalidate specific debrief query
      queryClient.invalidateQueries({ queryKey: ['debriefs', variables.sessionDate] })
      // Invalidate all debriefs query
      queryClient.invalidateQueries({ queryKey: allDebriefsKey })
    },
  })
  
  // Mutation for deleting a debrief
  const deleteDebriefMutation = useMutation({
    mutationFn: (sessionDate: string) => storageService.deleteDebriefData(sessionDate),
    onSuccess: (_, sessionDate) => {
      // Invalidate specific debrief query
      queryClient.invalidateQueries({ queryKey: ['debriefs', sessionDate] })
      // Invalidate all debriefs query
      queryClient.invalidateQueries({ queryKey: allDebriefsKey })
    },
  })
  
  return {
    allDebriefs,
    useDebriefData,
    saveDebrief: saveDebriefMutation.mutate,
    deleteDebrief: deleteDebriefMutation.mutate,
    isSaving: saveDebriefMutation.isPending,
    isDeleting: deleteDebriefMutation.isPending,
  }
} 