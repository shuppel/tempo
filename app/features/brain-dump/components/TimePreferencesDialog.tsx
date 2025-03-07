"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Clock,
  Bell,
  RotateCcw,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  useUserPreferences, 
  DEFAULT_DURATION_RULES 
} from "@/lib/userPreferences";
import { toast } from "@/components/ui/use-toast";

export function TimePreferencesDialog() {
  const { 
    preferences, 
    isLoaded, 
    updatePreferences, 
    resetPreferences 
  } = useUserPreferences();
  
  // Local state to track changes before saving
  const [localDurationRules, setLocalDurationRules] = useState(preferences.durationRules);
  const [localReminders, setLocalReminders] = useState(preferences.breakReminders);
  const [localFrequency, setLocalFrequency] = useState(preferences.breakSuggestionFrequency);
  const [isOpen, setIsOpen] = useState(false);

  // Reset local state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && isLoaded) {
      setLocalDurationRules(preferences.durationRules);
      setLocalReminders(preferences.breakReminders);
      setLocalFrequency(preferences.breakSuggestionFrequency);
    }
    setIsOpen(open);
  };

  // Update a specific duration rule
  const updateDurationRule = (key: keyof typeof DEFAULT_DURATION_RULES, value: number) => {
    setLocalDurationRules(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save changes
  const saveChanges = () => {
    updatePreferences({
      durationRules: localDurationRules,
      breakReminders: localReminders,
      breakSuggestionFrequency: localFrequency,
    });
    
    toast({
      title: "Preferences saved",
      description: "Your time management preferences have been updated.",
    });
    
    setIsOpen(false);
  };

  // Reset to defaults
  const handleReset = () => {
    const defaults = resetPreferences();
    setLocalDurationRules(defaults.durationRules);
    setLocalReminders(defaults.breakReminders);
    setLocalFrequency(defaults.breakSuggestionFrequency);
    
    toast({
      title: "Preferences reset",
      description: "Your time management preferences have been reset to defaults.",
    });
  };

  // Format time for display
  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${minutes}m`;
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 px-3 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="font-medium">Time Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Time Management Preferences</DialogTitle>
          <DialogDescription>
            Customize how you want to manage your work and break times.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="duration" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="duration">
              <Clock className="mr-2 h-4 w-4" />
              Duration Rules
            </TabsTrigger>
            <TabsTrigger value="breaks">
              <Bell className="mr-2 h-4 w-4" />
              Break Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="duration" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="maxWork">
                    Maximum work time without a break
                  </Label>
                  <span className="text-sm font-medium">
                    {formatTime(localDurationRules.maxWorkWithoutBreak)}
                  </span>
                </div>
                <Slider
                  id="maxWork"
                  min={30}
                  max={240}
                  step={15}
                  value={[localDurationRules.maxWorkWithoutBreak]}
                  onValueChange={(value) => updateDurationRule("maxWorkWithoutBreak", value[0])}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  After this much continuous work time, a break will be required.
                </p>
              </div>

              <div className="flex justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="shortBreak">Short break duration</Label>
                  <div className="flex items-center mt-2">
                    <Input
                      id="shortBreak"
                      type="number"
                      min={1}
                      max={30}
                      value={localDurationRules.shortBreakDuration}
                      onChange={(e) => updateDurationRule("shortBreakDuration", parseInt(e.target.value) || 5)}
                      className="w-20"
                    />
                    <span className="ml-2 text-sm">minutes</span>
                  </div>
                </div>

                <div className="flex-1">
                  <Label htmlFor="longBreak">Long break duration</Label>
                  <div className="flex items-center mt-2">
                    <Input
                      id="longBreak"
                      type="number"
                      min={5}
                      max={60}
                      value={localDurationRules.longBreakDuration}
                      onChange={(e) => updateDurationRule("longBreakDuration", parseInt(e.target.value) || 15)}
                      className="w-20"
                    />
                    <span className="ml-2 text-sm">minutes</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="blockSize">Time block size</Label>
                <div className="flex items-center mt-2">
                  <Input
                    id="blockSize"
                    type="number"
                    min={1}
                    max={15}
                    value={localDurationRules.blockSize}
                    onChange={(e) => updateDurationRule("blockSize", parseInt(e.target.value) || 5)}
                    className="w-20"
                  />
                  <span className="ml-2 text-sm">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All times will be rounded to this increment.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="breaks" className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="break-reminders">Enable break reminders</Label>
                <Switch
                  id="break-reminders"
                  checked={localReminders}
                  onCheckedChange={setLocalReminders}
                />
              </div>

              <div>
                <Label htmlFor="break-frequency">Break suggestion frequency</Label>
                <div className="mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={localFrequency === "low" ? "default" : "outline"}
                      onClick={() => setLocalFrequency("low")}
                      className="w-full"
                    >
                      Low
                    </Button>
                    <Button
                      variant={localFrequency === "medium" ? "default" : "outline"}
                      onClick={() => setLocalFrequency("medium")}
                      className="w-full"
                    >
                      Medium
                    </Button>
                    <Button
                      variant={localFrequency === "high" ? "default" : "outline"}
                      onClick={() => setLocalFrequency("high")}
                      className="w-full"
                    >
                      High
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {localFrequency === "low" && "Fewer break suggestions - ideal for deep flow states."}
                  {localFrequency === "medium" && "Balanced break suggestions - good for most work."}
                  {localFrequency === "high" && "Frequent break reminders - best for high-intensity focus."}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveChanges}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 