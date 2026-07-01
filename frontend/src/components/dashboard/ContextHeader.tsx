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
    <div className="flex items-center gap-3 py-3 px-4 bg-white/60 backdrop-blur-md border border-black/[0.04] rounded-2xl mb-6 text-sm text-[#6e6e73] shadow-sm animate-in fade-in duration-200">
      {/* Sidebar Toggle */}
      <button 
        onClick={toggleSidebar}
        className="p-1.5 hover:bg-black/[0.03] rounded-lg transition-all duration-200 text-[#6e6e73] hover:text-[#1d1d1f] shrink-0 cursor-pointer"
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <PanelLeft size={16} />
      </button>

      <span className="text-neutral-300 font-light shrink-0">/</span>

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
            <SelectTrigger className="w-auto h-8 px-2.5 border-none shadow-none bg-transparent hover:bg-black/[0.03] rounded-lg focus:ring-0 focus:outline-none font-semibold text-[#1d1d1f] gap-1.5 transition-all cursor-pointer">
                <SelectValue placeholder="Select Org" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-lg border border-black/[0.05] rounded-xl shadow-lg p-1">
            {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id} className="rounded-lg cursor-pointer font-medium text-xs">
                {org.name}
                </SelectItem>
            ))}
            {user?.is_superuser && (
              <>
                <div className="h-px bg-black/[0.04] my-1" />
                <SelectItem value="create_new" className="text-[#0071e3] focus:text-[#0071e3] font-semibold rounded-lg cursor-pointer text-xs">
                    <div className="flex items-center gap-2">
                        <Plus size={13} /> Create Org
                    </div>
                </SelectItem>
              </>
            )}
            </SelectContent>
        </Select>
      </div>

      <span className="text-neutral-300 font-light shrink-0">/</span>

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
            <SelectTrigger className="w-auto h-8 px-2.5 border-none shadow-none bg-transparent hover:bg-black/[0.03] rounded-lg focus:ring-0 focus:outline-none font-semibold text-[#1d1d1f] gap-1.5 transition-all cursor-pointer">
                 <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-lg border border-black/[0.05] rounded-xl shadow-lg p-1">
            {availableProjects.length > 0 ? (
                availableProjects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id} className="rounded-lg cursor-pointer font-medium text-xs">
                    {proj.name}
                    </SelectItem>
                ))
            ) : (
                <SelectItem value="none" disabled className="rounded-lg text-xs">No projects found</SelectItem>
            )}
            <div className="h-px bg-black/[0.04] my-1" />
            <SelectItem value="create_new" className="text-[#0071e3] focus:text-[#0071e3] font-semibold rounded-lg cursor-pointer text-xs">
                <div className="flex items-center gap-2">
                    <Plus size={13} /> Create Project
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
