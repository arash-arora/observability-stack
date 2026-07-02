"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { DashboardProvider } from '@/context/DashboardContext';
import ContextHeader from '@/components/dashboard/ContextHeader';
import { useLayout, LayoutProvider } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useLayout();
  
  return (
    <div className="min-h-screen bg-background font-sans anti-aliased">
      <Sidebar />
      <main 
        className={cn(
          "transition-[padding] duration-200 ease-in-out",
          isSidebarCollapsed ? "pl-16" : "pl-64"
        )}
      >
        <div className="w-full px-8 py-6">
          <ContextHeader />
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!user) return null;

  return (
    <DashboardProvider>
      <LayoutProvider>
        <DashboardContent>
          {children}
        </DashboardContent>
      </LayoutProvider>
    </DashboardProvider>
  );
}
