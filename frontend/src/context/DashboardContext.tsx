"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  current_user_role?: string;
}

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

interface DashboardContextType {
  organizations: Organization[];
  projects: Project[];
  selectedOrg: Organization | null;
  selectedProject: Project | null;
  setSelectedOrg: (org: Organization) => void;
  setSelectedProject: (project: Project) => void;
  isLoading: boolean;
  refreshContext: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [orgsRes, projectsRes] = await Promise.all([
        api.get('/management/organizations'),
        api.get('/management/projects')
      ]);

      setOrganizations(orgsRes.data);
      setProjects(projectsRes.data);

      // Default selection logic
      let resolvedOrg = selectedOrg;
      if (orgsRes.data.length > 0) {
        const savedOrgId = localStorage.getItem('selectedOrgId');
        const savedOrg = orgsRes.data.find((o: Organization) => o.id === savedOrgId);
        
        if (savedOrg) {
           resolvedOrg = savedOrg;
           setSelectedOrg(savedOrg);
        } else if (!resolvedOrg) {
           resolvedOrg = orgsRes.data[0];
           setSelectedOrg(resolvedOrg);
        }
      }
      
      // Filter projects for selected org
      if (projectsRes.data.length > 0) {
         let resolvedProject = selectedProject;
         const savedProjectId = localStorage.getItem('selectedProjectId');
         const savedProject = projectsRes.data.find((p: Project) => p.id === savedProjectId);

         // Check if saved project belongs to the resolved org
         if (savedProject && resolvedOrg && savedProject.organization_id === resolvedOrg.id) {
             resolvedProject = savedProject;
             setSelectedProject(savedProject);
         } else if (!resolvedProject && resolvedOrg) {
             // Fallback: find first project in the resolved org
             const firstProjectInOrg = projectsRes.data.find((p: Project) => p.organization_id === resolvedOrg?.id);
             if (firstProjectInOrg) {
                 setSelectedProject(firstProjectInOrg);
             }
         }
      }

    } catch (error) {
      console.error("Failed to fetch dashboard context:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
        localStorage.setItem('selectedOrgId', selectedOrg.id);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedProject) {
        localStorage.setItem('selectedProjectId', selectedProject.id);
    }
  }, [selectedProject]);

  // Update selected project when org changes if current project doesn't belong to new org
  useEffect(() => {
    if (selectedOrg && selectedProject) {
        if (selectedProject.organization_id !== selectedOrg.id) {
            // Try to find a project in the new org
            const projsInOrg = projects.filter(p => p.organization_id === selectedOrg.id);
            if (projsInOrg.length > 0) {
                setSelectedProject(projsInOrg[0]);
            } else {
                setSelectedProject(null);
            }
        }
    } else if (selectedOrg && !selectedProject) {
         const projsInOrg = projects.filter(p => p.organization_id === selectedOrg.id);
         if (projsInOrg.length > 0) {
             setSelectedProject(projsInOrg[0]);
         }
    }
  }, [selectedOrg, projects]);


  return (
    <DashboardContext.Provider value={{
      organizations,
      projects,
      selectedOrg,
      selectedProject,
      setSelectedOrg,
      setSelectedProject,
      isLoading,
      refreshContext: fetchData
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
