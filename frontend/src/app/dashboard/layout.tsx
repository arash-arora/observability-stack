"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { DashboardProvider } from '@/context/DashboardContext';
import ContextHeader from '@/components/dashboard/ContextHeader';

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
      <div className="min-h-screen bg-background font-sans anti-aliased">
        <Sidebar />
        <main className="pl-64 transition-[padding] duration-200 ease-in-out">
          <div className="container max-w-7xl mx-auto p-8 pt-6">
            <ContextHeader />
            {children}
          </div>
        </main>
      </div>
    </DashboardProvider>
  );
}
