"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useDashboard } from '@/context/DashboardContext';
import PageHeader from '@/components/PageHeader';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { TimeChart } from '@/components/dashboard/TimeChart';
import { TokenTimeChart } from '@/components/dashboard/TokenTimeChart';
import { ModelUsageChart } from '@/components/dashboard/ModelUsageChart';
import { LatencyChart } from '@/components/dashboard/LatencyChart';
import { AdvancedCharts } from '@/components/dashboard/AdvancedCharts';
import { EvaluationTrendCard } from '@/components/dashboard/EvaluationTrendCard';

export default function DashboardPage() {
  const { selectedProject } = useDashboard();
  const [stats, setStats] = useState<any>(null);
  const [dateRange, setDateRange] = useState<string>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [applications, setApplications] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");

  useEffect(() => {
    if (selectedProject) {
        fetchStats(selectedProject.id);
    } else {
        setStats(null);
    }
  }, [selectedProject, dateRange, customStart, customEnd, selectedApp]);

  useEffect(() => {
    if (selectedProject) {
        fetchApplications(selectedProject.id);
        setSelectedApp("");
    } else {
        setApplications([]);
    }
  }, [selectedProject]);

  const fetchApplications = async (projectId: string) => {
    try {
        const res = await api.get(`/analytics/traces/applications?project_id=${projectId}`);
        setApplications(res.data || []);
    } catch (e) {
        console.error("Failed to fetch applications", e);
    }
  };

  const fetchStats = async (projectId: string) => {
      try {
          let url = `/analytics/dashboard?project_id=${projectId}`;
          if (selectedApp) {
              url += `&application_name=${encodeURIComponent(selectedApp)}`;
          }

          // Calculate time range
          const now = Date.now() / 1000; // Convert to Unix timestamp
          let fromTs: number | null = null;
          let toTs: number | null = null;

          if (dateRange === "24h") {
              fromTs = now - 24 * 60 * 60;
              toTs = now;
          } else if (dateRange === "3d") {
              fromTs = now - 3 * 24 * 60 * 60;
              toTs = now;
          } else if (dateRange === "7d") {
              fromTs = now - 7 * 24 * 60 * 60;
              toTs = now;
          } else if (dateRange === "custom" && customStart && customEnd) {
              fromTs = new Date(customStart).getTime() / 1000;
              toTs = new Date(customEnd).getTime() / 1000;
          }

          if (fromTs !== null && toTs !== null) {
              url += `&from_ts=${fromTs}&to_ts=${toTs}`;
          }

          const res = await api.get(url);
          setStats(res.data);
      } catch (e) {
          console.error("Failed to fetch stats", e);
      }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <PageHeader
        title="Overview"
        infoTooltip="Comprehensive view of your application telemetry and performance metrics."
      />

      {/* Filters (Time & Application) */}
      <div className="flex flex-wrap items-center gap-4 bg-white/70 backdrop-blur-xl border border-black/[0.04] rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider select-none">Time Range:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-xs font-medium bg-white border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all cursor-pointer"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="3d">Last 3 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs font-medium bg-white border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all"
            />
            <span className="text-[#6e6e73] text-xs">to</span>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs font-medium bg-white border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all"
            />
          </div>
        )}

        <div className="h-4 w-px bg-black/[0.08]" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider select-none">Application:</span>
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="text-xs font-medium bg-white border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all cursor-pointer min-w-[140px]"
          >
            <option value="">All Applications</option>
            {applications.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {selectedProject ? (
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
              <LatencyChart title="Trace Latency Over Time" data={stats?.trace_latency_series || []} />
          </div>

          {/* Row 4: Gen Latency & Eval Trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <LatencyChart title="Generation Latency Over Time" data={stats?.generation_latency_series || []} />
              <EvaluationTrendCard data={stats?.eval_trend || []} />
          </div>

          {/* Advanced Application & General Analytics */}
          <AdvancedCharts data={stats} />
        </div>
      ) : (
        <div className="text-center py-20 text-[#6e6e73] text-xs font-semibold">
          Please select or create a project to view the dashboard.
        </div>
      )}
    </div>
  );
}
