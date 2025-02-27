"use client";

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AuthForm from '@/app/components/AuthForm';
import { LockKeyhole } from 'lucide-react';

interface AuthModalProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AuthModal = ({ 
  trigger, 
  defaultOpen = false,
  onOpenChange 
}: AuthModalProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Update isOpen state when defaultOpen prop changes
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="default" className="bg-primary hover:bg-primary/90 text-white font-medium">
            <LockKeyhole className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Welcome to Toro</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to save your sessions and access them from anywhere.
          </DialogDescription>
        </DialogHeader>
        <AuthForm />
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal; 