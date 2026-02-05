"use client";

import { useDashboard } from "@/context/DashboardContext";
import { useLayout } from '@/context/LayoutContext';
import { useAuth } from '@/context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, PanelLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CreateOrgModal } from "@/components/dashboard/CreateOrgModal";
import { CreateProjectModal } from "@/components/dashboard/CreateProjectModal";

export default function ContextHeader() {
  const { 
    organizations, 
    projects, 
    selectedOrg, 
    selectedProject, 
    setSelectedOrg, 
    setSelectedProject,
    isLoading,
    refreshContext // Assuming this exists or we need to reload
  } = useDashboard();
  
  const { user } = useAuth();
  const { toggleSidebar, isSidebarCollapsed } = useLayout();
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  if (isLoading) {
      return <div className="h-10 w-full animate-pulse bg-muted/20 rounded-md mb-6"></div>;
  }

  // Filter projects based on selected org
  const availableProjects = selectedOrg 
    ? projects.filter(p => p.organization_id === selectedOrg.id) 
    : [];

  const handleOrgCreated = (newOrg: any) => {
      // Refresh logic: ideally context updates automatically or we trigger a refetch
      window.location.reload(); 
  };

  const handleProjectCreated = (newProj: any) => {
      window.location.reload();
  };

  return (
    <>
    <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground bg-transparent">
      {/* Sidebar Toggle */}
      <button 
        onClick={toggleSidebar}
        className="mr-2 p-1 hover:bg-accent/50 rounded-sm transition-colors text-foreground/70 hover:text-foreground"
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <PanelLeft size={18} />
      </button>

      {/* Organization Selector */}
      <div className="flex items-center">
        <Select 
            value={selectedOrg?.id} 
            onValueChange={(val) => {
                if (val === 'create_new') {
                    setShowCreateOrg(true);
                } else {
                    const org = organizations.find(o => o.id === val);
                    if (org) setSelectedOrg(org);
                }
            }}
        >
            <SelectTrigger className="w-auto h-auto p-1 border-none shadow-none bg-transparent hover:bg-accent/50 focus:ring-0 font-medium text-foreground gap-1">
                <SelectValue placeholder="Select Organization" />
            </SelectTrigger>
            <SelectContent>
            {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                {org.name}
                </SelectItem>
            ))}
            {user?.is_superuser && (
              <>
                <div className="h-px bg-border my-1" />
                <SelectItem value="create_new" className="text-primary focus:text-primary font-medium">
                    <div className="flex items-center gap-2">
                        <Plus size={14} /> Create Organization
                    </div>
                </SelectItem>
              </>
            )}
            </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground/40 font-light">/</span>

      {/* Project Selector */}
      <div className="flex items-center">
        <Select 
            value={selectedProject?.id} 
            onValueChange={(val) => {
                if (val === 'create_new') {
                     setShowCreateProject(true);
                } else {
                    const proj = projects.find(p => p.id === val);
                    if (proj) setSelectedProject(proj);
                }
            }}
            disabled={!selectedOrg}
        >
            <SelectTrigger className="w-auto h-auto p-1 border-none shadow-none bg-transparent hover:bg-accent/50 focus:ring-0 font-medium text-foreground gap-1">
                 <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
            {availableProjects.length > 0 ? (
                availableProjects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                    </SelectItem>
                ))
            ) : (
                <SelectItem value="none" disabled>No projects found</SelectItem>
            )}
            <div className="h-px bg-border my-1" />
            <SelectItem value="create_new" className="text-primary focus:text-primary font-medium">
                <div className="flex items-center gap-2">
                    <Plus size={14} /> Create Project
                </div>
            </SelectItem>
            </SelectContent>
        </Select>
      </div>
    </div>

    {/* Modals */}
    {showCreateOrg && (
        <CreateOrgModal 
            onClose={() => setShowCreateOrg(false)}
            onCreated={handleOrgCreated}
        />
    )}
    {showCreateProject && selectedOrg && (
        <CreateProjectModal 
            orgId={selectedOrg.id}
            onClose={() => setShowCreateProject(false)}
            onCreated={handleProjectCreated}
        />
    )}
    </>
  );
}
