"use client";

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Loader2, UserCircle } from 'lucide-react';
import SignOutButton from './SignOutButton';
import AuthModal from './AuthModal';
import Link from 'next/link';

export const UserMenu = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user || null);
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.email) return '?';
    const email = user.email;
    const parts = email.split('@')[0].split(/[._-]/);
    return parts.map(part => part[0]?.toUpperCase() || '').join('').slice(0, 2);
  };
  
  if (loading) {
    return (
      <Button variant="ghost" size="icon" className="h-10 w-10" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <AuthModal 
        defaultOpen={showAuthModal}
        onOpenChange={setShowAuthModal}
        trigger={
          <button 
            className="relative font-accent text-foreground tracking-wider text-base hover:text-primary transition-colors group"
            onClick={() => setShowAuthModal(true)}
          >
            Sign In
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
          </button>
        }
      />
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-primary/10">
          <div className="flex items-center justify-center h-full w-full text-primary font-medium">
            {getUserInitials()}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            {user.user_metadata?.name && (
              <p className="text-xs leading-none text-muted-foreground">
                {user.user_metadata.name}
              </p>
            )}
          </div>
        </div>
        <div className="h-px bg-muted my-1" />
        <DropdownMenuItem asChild>
          <Link href="/sessions" className="cursor-pointer">
            My Sessions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            Settings
          </Link>
        </DropdownMenuItem>
        <div className="h-px bg-muted my-1" />
        <div className="p-1">
          <SignOutButton 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start px-2 h-8"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu; 