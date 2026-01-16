"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useDashboard } from '@/context/DashboardContext';
import PageHeader from '@/components/PageHeader';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { TimeChart } from '@/components/dashboard/TimeChart';
import { TokenTimeChart } from '@/components/dashboard/TokenTimeChart';
import { ModelUsageChart } from '@/components/dashboard/ModelUsageChart';
import { LatencyCard } from '@/components/dashboard/LatencyCard';

export default function DashboardPage() {
  const { selectedProject, selectedOrg, organizations, projects, setSelectedOrg, setSelectedProject } = useDashboard();
  
  // Dashboard Data State
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (selectedProject) {
        fetchStats(selectedProject.id);
    } else {
        setStats(null);
    }
  }, [selectedProject]);

  const fetchStats = async (projectId: string) => {
      try {
          const res = await api.get(`/analytics/dashboard?project_id=${projectId}`);
          setStats(res.data);
      } catch (e) {
          console.error("Failed to fetch stats", e);
      }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Overview" 
        infoTooltip="Comprehensive view of your application's telemetry and performance metrics." 
      />

      {selectedProject ? (
          <>
            {/* Row 1: Metrics */}
            <MetricsCards data={stats} />

            {/* Row 2: Charts (Time Series) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <TimeChart data={stats?.trace_series || []} totalTraces={stats?.total_traces || 0} />
                <TokenTimeChart data={stats?.token_series || []} totalTokens={stats?.total_tokens || 0} /> 
            </div>

            {/* Row 3: Usage & Latency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ModelUsageChart data={stats?.model_stats || []} totalCost={stats?.total_cost || 0} />
                <LatencyCard title="Trace Latency" data={stats?.trace_latency || []} />
            </div>

             {/* Row 4: Gen Latency */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
