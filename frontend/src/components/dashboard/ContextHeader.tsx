"use client";

import { useDashboard } from "@/context/DashboardContext";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

export default function ContextHeader() {
  const pathname = usePathname();
  const { 
    organizations, 
    projects, 
    selectedOrg, 
    selectedProject, 
    setSelectedOrg, 
    setSelectedProject,
    isLoading 
  } = useDashboard();

  if (isLoading) {
      return <div className="h-10 w-full animate-pulse bg-muted/20 rounded-md mb-6"></div>;
  }

  // Filter projects based on selected org
  const availableProjects = selectedOrg 
    ? projects.filter(p => p.organization_id === selectedOrg.id) 
    : [];

  const getPageTitle = (path: string) => {
    if (path === "/dashboard") return "Overview";
    if (path.includes("/applications")) return "Applications";
    if (path.includes("/traces")) return "Traces";
    if (path.includes("/evaluations")) return "Evaluations";
    if (path.includes("/metrics")) return "Metrics Hub";
    return "Dashboard";
  };
  
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{pageTitle}</span>
      <div className="h-4 w-[1px] bg-border mx-2"></div>
      
      {/* Organization Selector */}
      <Select 
        value={selectedOrg?.id} 
        onValueChange={(val) => {
            const org = organizations.find(o => o.id === val);
            if (org) setSelectedOrg(org);
        }}
      >
        <SelectTrigger className="w-[180px] h-8 border-none shadow-none bg-transparent hover:bg-accent/50 p-2 focus:ring-0 font-medium text-foreground">
          <SelectValue placeholder="Select Organization" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />

      {/* Project Selector */}
      <Select 
        value={selectedProject?.id} 
        onValueChange={(val) => {
            const proj = projects.find(p => p.id === val);
            if (proj) setSelectedProject(proj);
        }}
        disabled={!selectedOrg}
      >
        <SelectTrigger className="w-[180px] h-8 border-none shadow-none bg-transparent hover:bg-accent/50 p-2 focus:ring-0 font-medium text-foreground">
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
        </SelectContent>
      </Select>
    </div>
  );
}
