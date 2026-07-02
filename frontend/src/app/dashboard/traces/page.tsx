"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import TraceDetailSheet from '@/components/dashboard/TraceDetailSheet';
import { useDashboard } from '@/context/DashboardContext';
import PageHeader from '@/components/PageHeader';
import {
  Clock, AlertCircle, Search, Calendar,
  ChevronRight, ChevronDown, Layers, PlayCircle,
  FlaskConical, Sparkles, Star, ArrowUpDown, ArrowUp, ArrowDown,
  Activity, ShieldAlert, Cpu, CircleDollarSign, CheckCircle2, RefreshCw,
  Boxes, ExternalLink
} from 'lucide-react';
import EvaluationModal from '@/components/dashboard/EvaluationModal';
import { getPreviewString } from '@/lib/traceUtils';

export default function TracesPage() {
  const { selectedProject } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appNames, setAppNames] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [dateRange, setDateRange] = useState("24h"); // 24h, 3d, 7d, custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Custom Selector Dropdown state
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);

  // Modal State
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalTraceData, setEvalTraceData] = useState<any>(null);

  // Sync state with URL params on mount/update
  useEffect(() => {
    const traceId = searchParams.get('trace_id');
    if (traceId) {
      setSelectedTraceId(traceId);
    } else {
      setSelectedTraceId(null);
    }
  }, [searchParams]);

  const handleTraceClick = (traceId: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('trace_id', traceId);
    router.push(`/dashboard/traces?${newParams.toString()}`);
  };

  const handleCloseTrace = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('trace_id');
    router.push(`/dashboard/traces?${newParams.toString()}`);
  };

  // Reset page to 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedProject, searchQuery, statusFilter, selectedApp, dateRange, customStart, customEnd]);

  useEffect(() => {
    if (selectedProject) {
      fetchAppNames(selectedProject.id);
      if (dateRange === "custom" && (!customStart || !customEnd)) {
        setTraces([]);
      } else {
        fetchTraces(selectedProject.id);
      }
    } else {
      setTraces([]);
    }
  }, [selectedProject, searchQuery, statusFilter, selectedApp, sortConfig, dateRange, customStart, customEnd, page, rowsPerPage]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const fetchAppNames = async (projectId: string) => {
    try {
      const res = await api.get('/analytics/traces/applications', {
        params: { project_id: projectId }
      });
      setAppNames(res.data);
    } catch (err) {
      console.error("Failed to fetch app names for filter", err);
    }
  };

  const fetchTraces = async (projectId: string) => {
    try {
      setLoading(true);

      let from_ts: number | undefined = undefined;
      let to_ts: number | undefined = undefined;

      const now = new Date();
      if (dateRange === "24h") {
        from_ts = new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime() / 1000;
      } else if (dateRange === "3d") {
        from_ts = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).getTime() / 1000;
      } else if (dateRange === "7d") {
        from_ts = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000;
      } else if (dateRange === "custom") {
        if (customStart) from_ts = new Date(customStart).getTime() / 1000;
        if (customEnd) to_ts = new Date(customEnd).getTime() / 1000;
      }

      const res = await api.get(`/analytics/traces`, {
        params: {
          project_id: projectId,
          limit: rowsPerPage,
          offset: (page - 1) * rowsPerPage,
          search: searchQuery,
          status: statusFilter,
          application: selectedApp ? [selectedApp] : undefined,
          sort_by: sortConfig.key,
          order: sortConfig.direction,
          from_ts: from_ts,
          to_ts: to_ts
        },
        paramsSerializer: (params) => {
          const searchParams = new URLSearchParams();
          for (const key of Object.keys(params)) {
            const value = params[key];
            if (Array.isArray(value)) {
              value.forEach(v => searchParams.append(key, v));
            } else if (value !== undefined && value !== null && value !== '') {
              searchParams.append(key, value);
            }
          }
          return searchParams.toString();
        }
      });
      setTraces(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute live client-side stats from the traces list
  const liveStats = useMemo(() => {
    if (!traces || traces.length === 0) {
      return { total: 0, avgLatency: 0, successRate: 100, totalCost: 0, totalTokens: 0 };
    }
    const total = traces.length;
    let successCount = 0;
    let sumLatency = 0;
    let totalCost = 0;
    let totalTokens = 0;

    traces.forEach(t => {
      if (t.status_code !== 'ERROR') successCount++;
      sumLatency += t.duration_ms || 0;
      totalTokens += t.total_tokens || 0;
      totalCost += t.total_cost || ((t.total_tokens || 0) * 0.000002);
    });

    return {
      total,
      avgLatency: sumLatency / total,
      successRate: (successCount / total) * 100,
      totalCost,
      totalTokens
    };
  }, [traces]);

  // Render Helpers
  const renderJSONPreview = (jsonStr?: string) => {
    if (!jsonStr) return <span className="text-neutral-400 italic text-[10px]">Empty</span>;
    const preview = getPreviewString(jsonStr, 50);
    return (
      <span className="font-mono text-[10px] text-neutral-500 bg-neutral-50 border border-black/[0.03] px-2 py-1 rounded-lg truncate block max-w-[160px]" title={preview}>
        {preview}
      </span>
    );
  };

  const renderMetadata = (meta?: any) => {
    if (!meta || Object.keys(meta).length === 0) return <span className="text-neutral-400">-</span>;
    return <div className="flex gap-1 flex-wrap max-w-full overflow-hidden">
      {Object.entries(meta).slice(0, 1).map(([k, v]: any) => {
        const valStr = typeof v === 'string' ? v : JSON.stringify(v);
        const preview = getPreviewString(valStr, 30);
        return (
          <span key={k} className="px-1.5 py-0.5 bg-neutral-50 rounded text-[9px] font-mono border border-black/[0.04] text-[#6e6e73] truncate max-w-[120px]" title={`${k}=${valStr}`}>
            {k}={preview}
          </span>
        );
      })}
      {Object.keys(meta).length > 1 && <span className="text-[9px] font-mono text-neutral-400 font-bold ml-1">+{Object.keys(meta).length - 1}</span>}
    </div>
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={11} className="ml-1 text-neutral-400 opacity-60" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={11} className="ml-1 text-[#0071e3]" />
      : <ArrowDown size={11} className="ml-1 text-[#0071e3]" />;
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col text-[#1d1d1f] font-sans overflow-visible pb-12">
      <PageHeader
        title="Execution Traces"
        infoTooltip="Inspect LLM execution calls, latency breakdowns, evaluations, and costs per application channel."
      />

      {/* Toolbar */}
      <div className="flex-none px-6 py-4 mt-4 border border-black/[0.04] bg-white/70 backdrop-blur-md rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm select-none relative z-20">
        {/* Left: Search & Status Segments */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
            <input
              type="text"
              placeholder="Search trace name..."
              className="w-full bg-neutral-50/50 border border-black/[0.04] hover:bg-neutral-50 transition-all rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0071e3] h-9 text-[#1d1d1f]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex bg-neutral-100 p-0.5 rounded-xl border border-black/[0.02]">
            <button
              onClick={() => setStatusFilter([])}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${statusFilter.length === 0 ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                }`}
            >
              All Traces
            </button>
            <button
              onClick={() => setStatusFilter(['SUCCESS'])}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${statusFilter.includes('SUCCESS') && statusFilter.length === 1 ? "bg-white shadow-sm text-emerald-600" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                }`}
            >
              Success
            </button>
            <button
              onClick={() => setStatusFilter(['ERROR'])}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${statusFilter.includes('ERROR') && statusFilter.length === 1 ? "bg-white shadow-sm text-red-600" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                }`}
            >
              Errors
            </button>
          </div>
        </div>

        {/* Right: Custom Selector Popover & Date Picker */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Custom Styled Popover Application Selector */}
          <div className="relative">
            <button
              onClick={() => setAppDropdownOpen(!appDropdownOpen)}
              className="flex items-center gap-2 bg-white border border-black/[0.05] hover:bg-neutral-50 transition-all rounded-xl text-xs font-bold px-3.5 py-1.5 h-9 focus:outline-none focus:ring-1 focus:ring-[#0071e3] text-[#1d1d1f] cursor-pointer shadow-sm min-w-[200px] justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers size={13} className="text-[#0071e3] shrink-0" />
                <span className="truncate max-w-[130px] font-mono">
                  {selectedApp || "All Applications"}
                </span>
              </div>
              <ChevronDown size={12} className={`text-neutral-400 transition-transform duration-200 shrink-0 ${appDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {appDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAppDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-black/[0.06] rounded-2xl shadow-lg py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-black/[0.03] mb-1">
                    <span className="text-[9px] font-bold text-[#6e6e73] uppercase tracking-wider block">Filter by App</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => {
                        setSelectedApp("");
                        setAppDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${!selectedApp
                          ? 'bg-blue-50/50 text-[#0071e3] font-bold'
                          : 'hover:bg-neutral-50 text-[#1d1d1f]'
                        }`}
                    >
                      <span className="font-semibold">All Applications</span>
                      {!selectedApp && <CheckCircle2 size={12} className="text-[#0071e3]" />}
                    </button>

                    {appNames.map(name => {
                      const isSelected = selectedApp === name;
                      return (
                        <button
                          key={name}
                          onClick={() => {
                            setSelectedApp(name);
                            setAppDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${isSelected
                              ? 'bg-blue-50/50 text-[#0071e3] font-bold'
                              : 'hover:bg-neutral-50 text-[#1d1d1f]'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#0071e3]' : 'bg-emerald-500'} shrink-0`} />
                            <span className="truncate font-mono">{name}</span>
                          </div>
                          {isSelected && <CheckCircle2 size={12} className="text-[#0071e3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-neutral-400" />
            <select
              className="bg-neutral-50/50 border border-black/[0.04] hover:bg-neutral-50 transition-all rounded-xl text-xs font-bold px-3 py-1.5 h-9 focus:outline-none focus:ring-1 focus:ring-[#0071e3] text-[#1d1d1f] cursor-pointer"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="3d">Last 3 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                className="bg-neutral-50/50 border border-black/[0.04] rounded-xl text-xs px-2 py-1.5 h-9 text-[#1d1d1f]"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-[#6e6e73] text-xs font-semibold">-</span>
              <input
                type="datetime-local"
                className="bg-neutral-50/50 border border-black/[0.04] rounded-xl text-xs px-2 py-1.5 h-9 text-[#1d1d1f]"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Live Summary Statistics Cards inside Traces View */}
      {traces.length > 0 && (
        <div className="flex-none grid grid-cols-2 md:grid-cols-4 gap-4 px-6 mt-4 select-none animate-in fade-in duration-200">
          <div className="p-4 bg-white border border-black/[0.04] rounded-2xl shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider">Total Executions</span>
              <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Activity size={12} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight">{liveStats.total}</p>
            <p className="text-[9px] text-[#86868b] font-medium">In selected date scope</p>
          </div>

          <div className="p-4 bg-white border border-black/[0.04] rounded-2xl shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider">Avg Latency</span>
              <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Clock size={12} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight">
              {liveStats.avgLatency >= 1
                ? `${liveStats.avgLatency.toFixed(2)}s`
                : `${(liveStats.avgLatency * 1000).toFixed(0)}ms`}
            </p>
            <p className="text-[9px] text-[#86868b] font-medium">Execution duration mean</p>
          </div>

          <div className="p-4 bg-white border border-black/[0.04] rounded-2xl shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider">Success Rate</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={12} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-emerald-600">{liveStats.successRate.toFixed(1)}%</p>
            <p className="text-[9px] text-[#86868b] font-medium">Non-error traces status</p>
          </div>

          <div className="p-4 bg-white border border-black/[0.04] rounded-2xl shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider">Est. Accum Cost</span>
              <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <CircleDollarSign size={12} />
              </div>
            </div>
            <p className="text-xl font-bold font-mono tracking-tight text-purple-600">${liveStats.totalCost.toFixed(5)}</p>
            <p className="text-[9px] text-[#86868b] font-medium">Tokens: {liveStats.totalTokens.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col py-6 pt-4">
        {/* Table Area */}
        <div className="flex-1 flex flex-col bg-white border border-black/[0.04] rounded-3xl shadow-sm overflow-hidden">
          <div className="flex-1 relative min-h-[300px] overflow-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-[#f5f5f7] sticky top-0 z-10 border-b border-black/[0.04] select-none">
                <tr className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-wider">

                  <th
                    className="w-44 px-4 py-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center">
                      Timestamp <SortIcon column="timestamp" />
                    </div>
                  </th>
                  <th
                    className="w-64 px-4 py-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Trace Name <SortIcon column="name" />
                    </div>
                  </th>
                  <th className="w-40 px-4 py-3.5">Application</th>
                  <th
                    className="w-24 px-4 py-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                    onClick={() => handleSort('latency')}
                  >
                    <div className="flex items-center">
                      Latency <SortIcon column="latency" />
                    </div>
                  </th>
                  <th
                    className="w-24 px-4 py-3.5 text-right cursor-pointer hover:bg-black/[0.02] transition-colors"
                    onClick={() => handleSort('tokens')}
                  >
                    <div className="flex items-center justify-end">
                      Tokens <SortIcon column="tokens" />
                    </div>
                  </th>
                  <th className="w-24 px-4 py-3.5 text-right">Cost</th>
                  <th className="px-4 py-3.5 w-72">Input Preview</th>
                  <th className="px-4 py-3.5 w-72">Output Preview</th>
                  <th className="px-4 py-3.5 w-56">Metadata</th>
                </tr>
              </thead>
              {traces.length > 0 && (
                <tbody className="text-xs divide-y divide-black/[0.03]">
                  {traces.map((trace: any) => (
                    <tr
                      key={trace.trace_id}
                      className="group hover:bg-neutral-50/50 cursor-pointer transition-colors"
                      onClick={() => handleTraceClick(trace.trace_id)}
                    >

                      <td className="px-4 py-3.5 text-[#6e6e73] font-mono text-[10px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="opacity-50" />
                          {new Date(trace.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#1d1d1f]">
                        <div className="flex items-center gap-2 font-mono">
                          {trace.status_code === 'ERROR' ? (
                            <ShieldAlert size={14} className="text-red-500 shrink-0" />
                          ) : (
                            <PlayCircle size={14} className="text-[#0071e3] shrink-0" />
                          )}
                          <span className="truncate text-xs font-bold text-[#1d1d1f] hover:text-[#0071e3] transition-colors">{trace.name}</span>
                          {(trace.metadata?.is_evaluation) && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-[#0071e3] text-[9px] border border-blue-100 font-bold shrink-0 ml-1">
                              <FlaskConical size={9} />
                              Eval
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-[#6e6e73] font-mono mt-0.5 opacity-60">
                          ID: {trace.trace_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[#6e6e73] font-semibold font-mono truncate">
                        {trace.application_name || <span className="italic opacity-40 font-sans">global</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[10px] font-mono text-[#6e6e73]">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${trace.duration_ms > 3
                            ? 'bg-red-50 border-red-100 text-red-600'
                            : trace.duration_ms > 1
                              ? 'bg-amber-50 border-amber-100 text-amber-600'
                              : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          }`}>
                          {trace.duration_ms ? `${trace.duration_ms.toFixed(2)}s` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[10px] font-mono text-right text-[#1d1d1f] font-semibold">
                        {trace.total_tokens ? trace.total_tokens.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-[10px] font-mono text-right text-emerald-600 font-bold">
                        {trace.total_cost !== undefined && trace.total_cost !== null
                          ? `$${trace.total_cost.toFixed(5)}`
                          : `$${((trace.total_tokens || 0) * 0.000002).toFixed(5)}`}
                      </td>
                      <td className="px-4 py-3.5 truncate">
                        {renderJSONPreview(trace.input)}
                      </td>
                      <td className="px-4 py-3.5 truncate">
                        {renderJSONPreview(trace.output)}
                      </td>
                      <td className="px-4 py-3.5">
                        {renderMetadata(trace.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {traces.length === 0 && !loading && (
              <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto text-center pointer-events-auto">
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center border border-black/[0.04] shadow-sm">
                    <Calendar size={18} className="opacity-50 text-[#6e6e73]" />
                  </div>
                  {dateRange === "custom" && (!customStart || !customEnd) ? (
                    <>
                      <p className="font-bold text-[#1d1d1f] text-xs">Custom Date Range Required</p>
                      <p className="text-[11px] text-[#6e6e73] leading-relaxed">
                        Please select both a start date and an end date in the date picker to view traces from this custom range.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-[#6e6e73]">No traces found matching your criteria.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer / Pagination */}
          <div className="flex-none px-6 py-3.5 border-t border-black/[0.04] bg-white flex items-center justify-between text-[11px] text-[#6e6e73] select-none">
            <div>
              Showing <span className="font-bold text-[#1d1d1f]">{traces.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}</span> to <span className="font-bold text-[#1d1d1f]">{(page - 1) * rowsPerPage + traces.length}</span> executions
            </div>
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-black/[0.06] rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <div className="flex items-center gap-1 ml-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1 hover:bg-black/[0.02] disabled:opacity-30 disabled:hover:bg-transparent rounded cursor-pointer transition-all"
                  title="Previous Page"
                >
                  <ChevronDown size={13} className="rotate-90" />
                </button>
                <button className="px-2 py-0.5 bg-neutral-50 border border-black/[0.04] rounded font-bold text-[#1d1d1f] min-w-[20px] text-center">
                  {page}
                </button>
                <button
                  disabled={traces.length < rowsPerPage}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 hover:bg-black/[0.02] disabled:opacity-30 disabled:hover:bg-transparent rounded cursor-pointer transition-all"
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Include Trace Detail Sheet */}
      <TraceDetailSheet
        isOpen={!!selectedTraceId}
        onClose={handleCloseTrace}
        traceId={selectedTraceId}
      />

      {/* Evaluation Modal for Row Actions */}
      <EvaluationModal
        isOpen={evalModalOpen}
        onClose={() => setEvalModalOpen(false)}
        initialData={{
          input: "",
          output: "",
          context: "",
          application_name: "",
          trace: evalTraceData
        }}
        defaultObserve={true}
      />
    </div>
  );
}
