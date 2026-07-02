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
import { AdvancedCharts } from '@/components/dashboard/AdvancedCharts';
import { EvaluationTrendCard } from '@/components/dashboard/EvaluationTrendCard';
import SystemMetrics from '@/components/dashboard/SystemMetrics';

export default function DashboardPage() {
  const { selectedProject } = useDashboard();
  const [activeTab, setActiveTab] = useState<"llm" | "platform">("llm");
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
    <div className="flex flex-col gap-6 font-sans">
      <PageHeader 
        title="Overview" 
        infoTooltip="Comprehensive view of your application telemetry and platform host performance metrics." 
      />

      {/* Tabs */}
      <div className="flex border-b border-black/[0.04] shrink-0">
        <button
          onClick={() => setActiveTab("llm")}
          className={`px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer ${
            activeTab === "llm" 
              ? "border-[#0071e3] text-[#1d1d1f]" 
              : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
          }`}
        >
          LLM Observability
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`px-4 py-2.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer ${
            activeTab === "platform" 
              ? "border-[#0071e3] text-[#1d1d1f]" 
              : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
          }`}
        >
          Platform Observability
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "llm" ? (
        selectedProject ? (
          <div className="space-y-8 animate-in fade-in duration-200">
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

            {/* Row 4: Gen Latency & Eval Trend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <LatencyCard title="Generation Latency" data={stats?.generation_latency || []} />
                <EvaluationTrendCard data={stats?.eval_trend || []} />
            </div>

            {/* Advanced Application & General Analytics */}
            <AdvancedCharts data={stats} />
          </div>
        ) : (
          <div className="text-center py-20 text-[#6e6e73] text-xs font-semibold">
            Please select or create a project to view the LLM dashboard.
          </div>
        )
      ) : (
        <SystemMetrics />
      )}
    </div>
  );
}
