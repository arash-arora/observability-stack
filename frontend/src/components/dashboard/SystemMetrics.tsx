"use client";

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Cpu, HardDrive, Layout, RefreshCw, Server, ShieldCheck } from 'lucide-react';

interface MetricSnapshot {
  cpu_percent: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  process_cpu: number;
  process_memory: number;
  timestamp: number;
  status: string;
}

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState<MetricSnapshot | null>(null);
  const [history, setHistory] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/analytics/system-metrics');
      const snapshot: MetricSnapshot = res.data;
      setMetrics(snapshot);
      setHistory(prev => {
        const next = [...prev, snapshot];
        if (next.length > 30) next.shift(); // Keep last 30 ticks (2.5 mins of history)
        return next;
      });
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch platform metrics:', err);
      setError('Could not connect to system telemetry client.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const chartData = useMemo(() => {
    return history.map(h => ({
      time: new Date(h.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpu: h.cpu_percent,
      memory: h.memory_percent,
      processCpu: h.process_cpu
    }));
  }, [history]);

  if (loading && !metrics) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6e6e73]">
          <RefreshCw size={24} className="animate-spin text-[#0071e3]" />
          <span className="text-xs font-semibold">Connecting to platform resource monitor...</span>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-xs font-bold text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CPU Card */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[130px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider">CPU Usage</span>
            <div className="p-2 rounded-xl bg-purple-50 text-[#5856d6]">
              <Cpu size={16} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-3">
              {metrics?.cpu_percent}%
            </div>
            <p className="text-[10px] text-[#6e6e73] font-semibold mt-1">
              App CPU: {metrics?.process_cpu}%
            </p>
          </div>
        </div>

        {/* Memory Card */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[130px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider">System RAM</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#0071e3]">
              <Server size={16} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-3">
              {metrics?.memory_percent}%
            </div>
            <p className="text-[10px] text-[#6e6e73] font-semibold mt-1">
              {formatBytes(metrics?.memory_used || 0)} / {formatBytes(metrics?.memory_total || 0)}
            </p>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[130px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider">Disk Storage</span>
            <div className="p-2 rounded-xl bg-amber-50 text-[#ff9500]">
              <HardDrive size={16} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-3">
              {metrics?.disk_percent}%
            </div>
            <p className="text-[10px] text-[#6e6e73] font-semibold mt-1">
              {formatBytes(metrics?.disk_used || 0)} / {formatBytes(metrics?.disk_total || 0)}
            </p>
          </div>
        </div>

        {/* Process Memory Card */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[130px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider">App Memory</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#34c759]">
              <Layout size={16} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mt-3">
              {formatBytes(metrics?.process_memory || 0)}
            </div>
            <p className="text-[10px] text-[#6e6e73] font-semibold mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API Service Active
            </p>
          </div>
        </div>
      </div>

      {/* Resource Graphs */}
      <div className="grid grid-cols-1 gap-8">
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider mb-6">Resource Timeline</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5856d6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#5856d6" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6e6e73' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(0, 0, 0, 0.04)', 
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontFamily: 'Inter, sans-serif',
                    color: '#1d1d1f'
                  }} 
                />
                <Area type="monotone" dataKey="cpu" name="CPU Usage (%)" stroke="#5856d6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                <Area type="monotone" dataKey="memory" name="RAM Usage (%)" stroke="#0071e3" strokeWidth={2} fillOpacity={1} fill="url(#colorMemory)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h3 className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-[#34c759]" />
          Platform Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs text-[#6e6e73]">
          <div>
            <span className="font-semibold text-[#1d1d1f]">Host Status:</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 uppercase tracking-wider text-[9px]">
              ONLINE
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#1d1d1f]">Telemetry Feed:</span>
            <span className="ml-2 font-mono">5s poll interval</span>
          </div>
          <div>
            <span className="font-semibold text-[#1d1d1f]">Telemetry Type:</span>
            <span className="ml-2 font-mono">{metrics?.status === 'mocked' ? 'Virtual Node Monitor' : 'System Agent Direct'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
