"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { TimeChart } from '@/components/dashboard/TimeChart';
import { ModelUsageChart } from '@/components/dashboard/ModelUsageChart';
import { CreateOrgModal } from '@/components/dashboard/CreateOrgModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { LatencyCard } from '@/components/dashboard/LatencyCard';

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Dashboard Data State
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  useEffect(() => {
    if (currentProject) {
        fetchStats(currentProject.id);
    }
  }, [currentProject]);

  const fetchContext = async () => {
      try {
          const [pRes, oRes] = await Promise.all([
              api.get('/management/projects'),
              api.get('/management/organizations')
          ]);
          setProjects(pRes.data);
          setOrgs(oRes.data);
          
          if (pRes.data.length > 0) {
              const proj = pRes.data[0];
              setCurrentProject(proj);
              const org = oRes.data.find((o: any) => o.id === proj.organization_id);
              setCurrentOrg(org);
          } else if (oRes.data.length > 0) {
              setCurrentOrg(oRes.data[0]);
          }
      } catch (e) {
          console.error("Failed to load dashboard context", e);
      }
  };

  const fetchStats = async (projectId: string) => {
      try {
          const res = await api.get(`/analytics/dashboard?project_id=${projectId}`);
          setStats(res.data);
      } catch (e) {
          console.error("Failed to fetch stats", e);
      }
  };

  const handleOrgChange = (org: any) => {
      if (org.id === 'create_new') {
          setShowCreateOrg(true);
      } else {
          setCurrentOrg(org);
          // Auto-select first project of org
          const orgProjects = projects.filter(p => p.organization_id === org.id);
          if (orgProjects.length > 0) {
              setCurrentProject(orgProjects[0]);
          } else {
              setCurrentProject(null);
              setStats(null);
          }
      }
  };

  const handleProjectChange = (proj: any) => {
     if (proj.id === 'create_new') {
         if (!currentOrg) {
             alert("Please select an organization first.");
             return;
         }
         setShowCreateProject(true);
     } else {
         setCurrentProject(proj);
     }
  };

  return (
    <div className="flex flex-col gap-12">
      <DashboardHeader 
        title="Dashboard"
        currentOrg={currentOrg}
        currentProject={currentProject}
        organizations={orgs}
        projects={projects.filter(p => !currentOrg || p.organization_id === currentOrg.id)}
        onOrgChange={handleOrgChange}
        onProjectChange={handleProjectChange}
      />

      {/* Modals */}
      {showCreateOrg && (
          <CreateOrgModal 
            onClose={() => setShowCreateOrg(false)}
            onCreated={(newOrg) => {
                setOrgs([...orgs, newOrg]);
                setCurrentOrg(newOrg);
            }}
          />
      )}
      {showCreateProject && currentOrg && (
          <CreateProjectModal 
            orgId={currentOrg.id}
            onClose={() => setShowCreateProject(false)}
            onCreated={(newProj) => {
                setProjects([...projects, newProj]);
                setCurrentProject(newProj);
            }}
          />
      )}

      {currentProject ? (
          <>
            {/* Row 1: Metrics */}
            <MetricsCards data={stats} />

            {/* Row 2: Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <TimeChart data={stats?.trace_series || []} totalTraces={stats?.total_traces || 0} />
                <ModelUsageChart data={stats?.model_stats || []} totalCost={stats?.total_cost || 0} />
            </div>


            {/* Row 3: Latencies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <LatencyCard title="Trace Latency" data={stats?.trace_latency || []} />
                <LatencyCard title="Generation Latency" data={stats?.generation_latency || []} />
            </div>
          </>
      ) : (
          <div className="text-center py-20 text-muted-foreground">
              Please select or create a project to view the dashboard.
          </div>
      )}
    </div>
  );
}
