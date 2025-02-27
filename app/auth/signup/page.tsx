"use client";

import { useEffect } from 'react';
import AuthForm from '@/app/components/AuthForm';

export default function SignUpPage() {
  // Set default tab to signup on component mount
  useEffect(() => {
    const tabTrigger = document.querySelector('[data-value="signup"]');
    if (tabTrigger instanceof HTMLElement) {
      tabTrigger.click();
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Create an Account</h1>
      <AuthForm />
    </div>
  );
} 