"use client"

import * as React from "react"
import { useState } from "react"
import { FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Slider } from "@/app/components/ui/slider"
import { Label } from "@/components/ui/label"

export interface SessionDebriefModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (debriefData: SessionDebriefData) => void
  sessionDate: string
}

export interface SessionDebriefData {
  sessionDate: string
  reflections: string
  productivityRating: number
  stressLevel: number
  satisfactionRating: number
  energyLevel: number
  focusRating: number
  lastUpdated?: string
}

export function SessionDebriefModal({
  isOpen,
  onClose,
  onSave,
  sessionDate,
}: SessionDebriefModalProps) {
  const [reflections, setReflections] = useState("")
  const [productivityRating, setProductivityRating] = useState(5)
  const [stressLevel, setStressLevel] = useState(5)
  const [satisfactionRating, setSatisfactionRating] = useState(5)
  const [energyLevel, setEnergyLevel] = useState(5)
  const [focusRating, setFocusRating] = useState(5)

  React.useEffect(() => {
    console.log("SessionDebriefModal isOpen:", isOpen);
  }, [isOpen]);

  const handleSave = () => {
    const debriefData: SessionDebriefData = {
      sessionDate,
      reflections,
      productivityRating,
      stressLevel,
      satisfactionRating,
      energyLevel,
      focusRating,
    }
    console.log("Saving debrief data:", debriefData);
    onSave(debriefData)
    onClose()
  }

  if (!isOpen) return null

  // For debugging purposes, add a highly visible indicator
  console.log("Rendering SessionDebriefModal with isOpen:", isOpen, "sessionDate:", sessionDate);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center"
      style={{
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        // Close when clicking outside
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-background rounded-lg shadow-xl border-4 border-rose-500 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-rose-500" />
            <h2 className="text-xl font-semibold">Session Debrief</h2>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Reflect on your completed session and capture your thoughts and feelings.
        </p>

        <div className="flex flex-col gap-6 py-4">
          <div>
            <Label htmlFor="reflections" className="mb-2 block">
              Reflections
            </Label>
            <Textarea
              id="reflections"
              className="min-h-[150px]"
              placeholder="What went well? What challenges did you face? What would you do differently next time?"
              value={reflections}
              onChange={(e) => setReflections(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">How do you feel about this session?</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="productivity">Productivity</Label>
                  <span className="text-sm text-muted-foreground">{productivityRating}/10</span>
                </div>
                <Slider
                  id="productivity"
                  min={1}
                  max={10}
                  step={1}
                  value={[productivityRating]}
                  onValueChange={(value) => setProductivityRating(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Unproductive</span>
                  <span>Very productive</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="stress">Stress Level</Label>
                  <span className="text-sm text-muted-foreground">{stressLevel}/10</span>
                </div>
                <Slider
                  id="stress"
                  min={1}
                  max={10}
                  step={1}
                  value={[stressLevel]}
                  onValueChange={(value) => setStressLevel(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Relaxed</span>
                  <span>Overwhelmed</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="satisfaction">Satisfaction</Label>
                  <span className="text-sm text-muted-foreground">{satisfactionRating}/10</span>
                </div>
                <Slider
                  id="satisfaction"
                  min={1}
                  max={10}
                  step={1}
                  value={[satisfactionRating]}
                  onValueChange={(value) => setSatisfactionRating(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Unsatisfied</span>
                  <span>Very satisfied</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="energy">Energy Level</Label>
                  <span className="text-sm text-muted-foreground">{energyLevel}/10</span>
                </div>
                <Slider
                  id="energy"
                  min={1}
                  max={10}
                  step={1}
                  value={[energyLevel]}
                  onValueChange={(value) => setEnergyLevel(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Exhausted</span>
                  <span>Energized</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="focus">Focus Quality</Label>
                  <span className="text-sm text-muted-foreground">{focusRating}/10</span>
                </div>
                <Slider
                  id="focus"
                  min={1}
                  max={10}
                  step={1}
                  value={[focusRating]}
                  onValueChange={(value) => setFocusRating(value[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Distracted</span>
                  <span>Deep focus</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-rose-500 hover:bg-rose-600">
            Save Debrief
          </Button>
        </div>
      </div>
    </div>
  )
} 