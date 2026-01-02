"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
}

interface DashboardHeaderProps {
  currentOrg: MenuItem | null;
  currentProject: MenuItem | null;
  organizations: MenuItem[];
  projects: MenuItem[];
  onOrgChange: (org: MenuItem) => void;
  onProjectChange: (project: MenuItem) => void;
  title?: string;
}

function SelectionDropdown({ 
  label, 
  items, 
  selectedItem, 
  onChange,
  className 
}: { 
  label?: string,
  items: MenuItem[], 
  selectedItem: MenuItem | null, 
  onChange: (item: MenuItem) => void,
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn("flex items-center gap-1.5 hover:bg-muted/50 px-2 py-1 rounded transition-colors outline-none focus:ring-1 focus:ring-ring", className)}
      >
        <span className="font-medium truncate max-w-[200px]">{selectedItem?.name || label || "Select..."}</span>
        <ChevronDown size={14} className="text-muted-foreground opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 z-50 rounded-md border border-border bg-popover shadow-md text-popover-foreground animate-in fade-in-0 zoom-in-95 duration-100">
           <div className="p-1 max-h-60 overflow-y-auto">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Select...</div>
              {items.map((item) => (
                  <button
                      key={item.id}
                      onClick={() => {
                          onChange(item);
                          setIsOpen(false);
                      }}
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                      <span className="truncate">{item.name}</span>
                      {selectedItem?.id === item.id && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                              <Check size={14} />
                          </span>
                      )}
                  </button>
              ))}
              <div className="my-1 h-px bg-border" />
              <button
                  onClick={() => {
                      onChange({ id: 'create_new', name: 'Create New...' });
                      setIsOpen(false);
                  }}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 text-sm outline-none hover:bg-cyan-500/10 hover:text-cyan-400 text-cyan-500 font-medium"
              >
                  + Create New
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

export function DashboardHeader({ 
  title,
  currentOrg, 
  currentProject, 
  organizations, 
  projects,
  onOrgChange,
  onProjectChange
}: DashboardHeaderProps) {
  return (
    <div className="flex-none px-6 py-4 border-b border-border flex items-center justify-between bg-background">
      <div className="flex items-center gap-4">
        {title && (
            <>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                <div className="h-6 w-px bg-border hidden sm:block"></div>
            </>
        )}
        <div className="flex items-center gap-1 text-sm text-foreground">
        <SelectionDropdown 
            items={organizations}
            selectedItem={currentOrg}
            onChange={onOrgChange}
            className="font-semibold text-foreground hover:bg-muted"
        />
        <ChevronRight size={16} className="text-muted-foreground/50" />
        <SelectionDropdown 
            items={projects}
            selectedItem={currentProject}
            onChange={onProjectChange}
            className="font-semibold text-foreground hover:bg-muted"
        />
      </div>
      </div>
    </div>
  );
}
