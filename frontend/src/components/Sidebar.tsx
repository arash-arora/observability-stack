"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Activity, Key, LogOut, LayoutList,
  Sparkles,
  FlaskConical,
  Settings,
  Beaker,
  Boxes,
  Shield,
  Building2,
  Bell,
} from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { useLayout } from '@/context/LayoutContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isSidebarCollapsed } = useLayout();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/applications', label: 'Applications', icon: Boxes },
    { href: '/dashboard/traces', label: 'Traces', icon: Activity },
    { href: '/dashboard/evaluations', label: 'Evaluations', icon: FlaskConical },
    { href: '/dashboard/models', label: 'Model Hub', icon: Sparkles },
    { href: '/dashboard/metrics', label: 'Metrics Hub', icon: Beaker },
    { href: '/dashboard/alerts/active', label: 'Alerts', icon: Bell },
    // Show Organizations only if superuser
    ...(user?.is_superuser ? [{ href: '/dashboard/organizations', label: 'Organizations', icon: Building2 }] : []),
    // Show Admin Pages only if superuser
    ...(user?.is_superuser ? [
      { href: '/dashboard/admin/user-management', label: 'User Management', icon: Shield },
      { href: '/dashboard/admin/role-management', label: 'Role Management', icon: Key }
    ] : []),
  ];

  return (
    <aside 
        className={cn(
            "fixed top-0 left-0 z-40 h-screen glass-sidebar flex flex-col transition-all duration-300 ease-in-out shadow-sm",
            isSidebarCollapsed ? "w-16" : "w-64"
        )}
    >
      <div className={cn("flex flex-col items-center justify-center py-4 gap-2 px-3 border-b border-black/[0.04] bg-white/30", isSidebarCollapsed ? "px-0" : "")}>
        <div className="w-[60%] flex items-center justify-center shrink-0">
          <Image
            src="/logo.png"
            alt="AI Reliability Suite"
            width={80}
            height={80}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        {!isSidebarCollapsed && (
          <h1 className="text-[18px] font-semibold tracking-tight text-[#1d1d1f] leading-tight text-center">
            AI Reliability Suite
          </h1>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto py-5 px-3">
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200 relative group",
                  isActive 
                    ? "bg-black/[0.04] text-[#1d1d1f]" 
                    : "text-[#6e6e73] hover:bg-black/[0.02] hover:text-[#1d1d1f]",
                  isSidebarCollapsed && "justify-center px-2"
                )}
                title={isSidebarCollapsed ? link.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full bg-[#0071e3]" />
                )}
                <Icon size={16} className={cn("opacity-70 shrink-0 transition-transform duration-200 group-hover:scale-105", isActive && "opacity-100 text-[#0071e3]")} />
                {!isSidebarCollapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="p-4 border-t border-black/[0.04] relative bg-white/20">
        {showUserMenu && (
             <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                <div className={cn(
                    "absolute bottom-16 bg-white/95 border border-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 p-1.5 backdrop-blur-lg w-56",
                    isSidebarCollapsed ? "left-14" : "left-4"
                )}>
                    <Link 
                        href="/dashboard/settings" 
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-black/[0.03] rounded-lg transition-colors"
                        onClick={() => setShowUserMenu(false)}
                    >
                        <Settings size={14} className="opacity-70 text-[#6e6e73]" />
                        Settings
                    </Link>
                    <div className="h-px bg-black/[0.04] my-1"></div>
                    <button 
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
             </>
        )}
        
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={cn(
            "flex w-full items-center gap-3 px-2 py-2 text-sm font-medium hover:bg-black/[0.03] rounded-2xl transition-all duration-200 text-left group cursor-pointer",
            isSidebarCollapsed && "justify-center px-1"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white shrink-0 shadow-sm">
              {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email?.[0].toUpperCase() || 'U')}
          </div>
          {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                 <div className="text-xs font-semibold truncate text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">
                     {user?.full_name || 'User'}
                 </div>
                 <div className="text-[10px] text-[#6e6e73] truncate opacity-80 group-hover:opacity-100 transition-opacity">
                     {user?.email || 'user@example.com'}
                 </div>
              </div>
          )}
        </button>
      </div>
    </aside>
  );
}
