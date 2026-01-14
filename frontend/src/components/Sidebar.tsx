"use client";

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Activity, Key, LogOut, LayoutList,
  Sparkles,
  FlaskConical,
  Settings,
  Beaker,
  Boxes,
} from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/applications', label: 'Applications', icon: Boxes },
    { href: '/dashboard/traces', label: 'Traces', icon: Activity },
    { href: '/dashboard/evaluations', label: 'Evaluations', icon: FlaskConical },
    { href: '/dashboard/metrics', label: 'Metrics Hub', icon: Beaker },
  ];

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-64 border-r bg-card flex flex-col">
      <div className="h-14 flex items-center px-6 border-b">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
           <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
             <div className="w-2.5 h-2.5 bg-background rounded-full" />
           </div>
           <span className="text-foreground font-semibold">AI Observability</span>
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  isActive 
                    ? "bg-accent text-accent-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <Icon size={16} className={cn("opacity-70", isActive && "opacity-100 text-primary")} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="p-4 border-t relative">
        {showUserMenu && (
             <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute bottom-16 left-4 w-56 bg-card border border-border shadow-lg rounded-md overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 p-1">
                    <Link 
                        href="/dashboard/settings" 
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                        onClick={() => setShowUserMenu(false)}
                    >
                        <Settings size={14} className="opacity-70" />
                        Settings
                    </Link>
                    <div className="h-px bg-border my-1"></div>
                    <button 
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-sm transition-colors"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
             </>
        )}
        
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium hover:bg-accent/50 rounded-md transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-background">
              {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email?.[0].toUpperCase() || 'U')}
          </div>
          <div className="flex-1 min-w-0">
             <div className="text-sm font-medium truncate text-foreground group-hover:text-accent-foreground transition-colors">
                 {user?.full_name || 'User'}
             </div>
             <div className="text-xs text-muted-foreground truncate opacity-70 group-hover:opacity-100 transition-opacity">
                 {user?.email || 'user@example.com'}
             </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
