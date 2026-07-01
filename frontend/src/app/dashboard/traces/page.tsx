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
    FlaskConical, Sparkles, Star, ArrowUpDown, ArrowUp, ArrowDown, Activity
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

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  
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

  useEffect(() => {
    if (selectedProject) {
      fetchAppNames(selectedProject.id);
      if (!selectedApp) {
        setTraces([]);
      } else if (dateRange === "custom" && (!customStart || !customEnd)) {
        setTraces([]);
      } else {
        fetchTraces(selectedProject.id);
      }
    } else {
        setTraces([]);
    }
  }, [selectedProject, searchQuery, statusFilter, selectedApp, sortConfig, dateRange, customStart, customEnd]);

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
            limit: 50,
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
  
  // Render Helpers
  const renderJSONPreview = (jsonStr?: string) => {
    if (!jsonStr) return <span className="text-neutral-400 italic">Empty</span>;
    const preview = getPreviewString(jsonStr, 40);
    return <span className="font-mono text-[11px] text-[#6e6e73] truncate block max-w-[140px]" title={preview}>{preview}</span>;
  };

  const renderMetadata = (meta?: any) => {
      if (!meta || Object.keys(meta).length === 0) return <span className="text-neutral-400">-</span>;
      return <div className="flex gap-1 flex-wrap max-w-full overflow-hidden">
          {Object.entries(meta).slice(0, 1).map(([k, v]: any) => {
              const valStr = typeof v === 'string' ? v : JSON.stringify(v);
              const preview = getPreviewString(valStr, 30);
              return (
                <span key={k} className="px-1.5 py-0.5 bg-black/[0.02] rounded text-[9px] font-mono border border-black/[0.04] text-[#6e6e73] truncate max-w-[120px]" title={`${k}=${valStr}`}>
                    {k}={preview}
                </span>
              );
          })}
          {Object.keys(meta).length > 1 && <span className="text-[9px] font-mono text-[#6e6e73] opacity-60">+{Object.keys(meta).length - 1}</span>}
      </div>
  };

  const SortIcon = ({ column }: { column: string }) => {
      if (sortConfig.key !== column) return <ArrowUpDown size={11} className="ml-1 text-neutral-400 opacity-60" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp size={11} className="ml-1 text-[#0071e3]" />
        : <ArrowDown size={11} className="ml-1 text-[#0071e3]" />;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col text-[#1d1d1f] font-sans">
        <PageHeader 
            title="Traces" 
            infoTooltip="Inspect LLM execution calls, latency breakdowns, evaluations, and costs per application channel." 
        />
        
        {/* Toolbar */}
        <div className="flex-none px-6 py-4 border-b border-black/[0.04] bg-white/40 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 mt-2 rounded-2xl">
             {/* Left: Search & Status Segments */}
             <div className="flex items-center gap-4 flex-wrap">
                 <div className="relative w-60">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
                     <input 
                         type="text" 
                         placeholder="Search trace name..." 
                         className="w-full bg-neutral-50/50 border border-black/[0.04] hover:bg-neutral-50 transition-all rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0071e3] h-9 text-[#1d1d1f]"
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                     />
                 </div>

                 {selectedApp && (
                   <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-black/[0.02]">
                     <button
                       onClick={() => setStatusFilter([])}
                       className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                         statusFilter.length === 0 ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                       }`}
                     >
                       All
                     </button>
                     <button
                       onClick={() => setStatusFilter(['SUCCESS'])}
                       className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                         statusFilter.includes('SUCCESS') && statusFilter.length === 1 ? "bg-white shadow-sm text-emerald-600" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                       }`}
                     >
                       Success
                     </button>
                     <button
                       onClick={() => setStatusFilter(['ERROR'])}
                       className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                         statusFilter.includes('ERROR') && statusFilter.length === 1 ? "bg-white shadow-sm text-red-600" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                       }`}
                     >
                       Errors
                     </button>
                   </div>
                 )}
             </div>
             
             {/* Right: App Dropdown & Date Picker */}
             <div className="flex items-center gap-3 flex-wrap ml-auto">
                 {/* App Selector Dropdown */}
                 <div className="flex items-center gap-1.5">
                     <Layers size={13} className="text-neutral-400"/>
                     <select 
                         className="bg-neutral-50/50 border border-black/[0.04] hover:bg-neutral-50 transition-all rounded-xl text-xs font-bold px-3 py-1.5 h-9 focus:outline-none focus:ring-1 focus:ring-[#0071e3] text-[#1d1d1f] cursor-pointer"
                         value={selectedApp}
                         onChange={(e) => setSelectedApp(e.target.value)}
                     >
                         <option value="">Select Application...</option>
                         {appNames.map(name => (
                             <option key={name} value={name}>{name}</option>
                         ))}
                     </select>
                 </div>

                 {selectedApp && (
                   <>
                     <div className="flex items-center gap-1.5">
                         <Calendar size={13} className="text-neutral-400"/>
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
                   </>
                 )}
             </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden mt-6">
             {!selectedApp ? (
               <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/40 border border-black/[0.04] rounded-3xl backdrop-blur-xl">
                 <div className="max-w-2xl w-full text-center space-y-8">
                   <div className="space-y-3">
                     <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center border border-black/[0.03] text-[#0071e3] shadow-sm animate-pulse">
                       <Layers size={22} />
                     </div>
                     <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wider mt-2">Select an Application Channel</h3>
                     <p className="text-[11px] text-[#6e6e73] leading-relaxed max-w-md mx-auto">
                       Choose an active application channel from the list below to inspect its execution traces, trace latencies, token consumption, and evaluations.
                     </p>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto pr-1">
                     {appNames.map(name => (
                       <button
                         key={name}
                         onClick={() => setSelectedApp(name)}
                         className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.04] bg-white hover:bg-black/[0.01] hover:border-black/[0.08] transition-all cursor-pointer text-left shadow-sm hover:scale-[1.01] group"
                       >
                         <div className="flex items-center gap-3 min-w-0">
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                           <div className="flex flex-col min-w-0">
                             <span className="text-xs font-semibold text-[#1d1d1f] truncate font-mono">{name}</span>
                             <span className="text-[9px] text-[#6e6e73] font-semibold mt-0.5">Click to view traces</span>
                           </div>
                         </div>
                         <ChevronRight size={13} className="text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                       </button>
                     ))}
                     {appNames.length === 0 && (
                       <div className="col-span-2 p-8 rounded-2xl bg-black/[0.01] border border-dashed border-black/[0.06] text-center">
                         <p className="text-xs text-[#86868b] italic">No active integrations found. Register an app in Settings to begin.</p>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             ) : (
               /* Table Area */
               <div className="flex-1 flex flex-col bg-white/70 border border-black/[0.04] rounded-3xl backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.01)] overflow-hidden">
                   <div className="flex-1 overflow-auto">
                     <table className="w-full text-left border-collapse">
                         <thead className="bg-neutral-50/50 sticky top-0 z-10 backdrop-blur-sm border-b border-black/[0.04]">
                             <tr className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-wider">
                                 <th className="w-10 px-4 py-3 text-center">
                                     <input type="checkbox" className="rounded border-black/[0.08] bg-transparent" />
                                 </th>
                                 <th 
                                     className="px-4 py-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                                     onClick={() => handleSort('timestamp')}
                                 >
                                     <div className="flex items-center">
                                         Timestamp <SortIcon column="timestamp" />
                                     </div>
                                 </th>
                                 <th 
                                     className="px-4 py-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                                     onClick={() => handleSort('name')}
                                 >
                                     <div className="flex items-center">
                                         Name <SortIcon column="name" />
                                     </div>
                                 </th>
                                 <th className="px-4 py-3">Application Name</th>
                                 <th 
                                     className="px-4 py-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                                     onClick={() => handleSort('latency')}
                                 >
                                     <div className="flex items-center">
                                         Latency <SortIcon column="latency" />
                                     </div>
                                 </th>
                                 <th 
                                     className="px-4 py-3 text-right cursor-pointer hover:bg-black/[0.02] transition-colors"
                                     onClick={() => handleSort('tokens')}
                                 >
                                     <div className="flex items-center justify-end">
                                         Tokens <SortIcon column="tokens" />
                                     </div>
                                 </th>
                                 <th className="px-4 py-3 text-right">Cost</th>
                                 <th className="px-4 py-3 w-1/6">Input</th>
                                 <th className="px-4 py-3 w-1/6">Output</th>
                                 <th className="px-4 py-3">Metadata</th>
                             </tr>
                         </thead>
                         <tbody className="text-xs">
                             {traces.map((trace: any) => (
                                 <tr 
                                     key={trace.trace_id} 
                                     className="group border-b border-black/[0.04] hover:bg-black/[0.01] cursor-pointer transition-colors"
                                     onClick={() => handleTraceClick(trace.trace_id)}
                                 >
                                     <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                         <div className="flex items-center justify-center gap-2">
                                             <input type="checkbox" className="rounded border-black/[0.08] bg-transparent" />
                                             <Star size={13} className="text-neutral-300 hover:text-yellow-500 cursor-pointer transition-colors" />
                                         </div>
                                     </td>
                                     <td className="px-4 py-3.5 text-[#6e6e73] font-mono text-[10px] whitespace-nowrap">
                                         {new Date(trace.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                     </td>
                                     <td className="px-4 py-3.5 font-semibold text-[#1d1d1f]">
                                         <div className="flex items-center gap-2 font-mono">
                                             {trace.status_code === 'ERROR' ? (
                                                 <AlertCircle size={13} className="text-red-500"/>
                                             ) : (
                                                 <PlayCircle size={13} className="text-[#0071e3]"/>
                                             )}
                                             {trace.name}
                                             {(trace.metadata?.is_evaluation) && (
                                                 <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-[#0071e3] text-[9px] border border-blue-100 font-bold ml-2">
                                                     <FlaskConical size={9} />
                                                     Eval
                                                 </span>
                                             )}
                                         </div>
                                         <div className="text-[9px] text-[#6e6e73] font-mono mt-0.5 opacity-60">
                                             {trace.trace_id.slice(0, 8)}
                                         </div>
                                     </td>
                                     <td className="px-4 py-3.5 text-[#6e6e73] font-semibold">
                                         {trace.application_name || <span className="italic opacity-50">Unknown</span>}
                                     </td>
                                     <td className="px-4 py-3.5 text-[10px] font-mono text-[#6e6e73]">
                                         {trace.duration_ms ? `${trace.duration_ms.toFixed(3)}s` : '-'}
                                     </td>
                                     <td className="px-4 py-3.5 text-[10px] font-mono text-right text-[#1d1d1f]">
                                         {trace.total_tokens || '-'}
                                     </td>
                                     <td className="px-4 py-3.5 text-[10px] font-mono text-right text-[#1d1d1f]">
                                         {trace.total_cost ? `$${trace.total_cost.toFixed(5)}` : '-'}
                                     </td>
                                     <td className="px-4 py-3.5 w-1/6 max-w-[150px] overflow-hidden">
                                          {renderJSONPreview(trace.input)}
                                     </td>
                                     <td className="px-4 py-3.5 w-1/6 max-w-[150px] overflow-hidden">
                                          {renderJSONPreview(trace.output)}
                                     </td>
                                     <td className="px-4 py-3.5">
                                          {renderMetadata(trace.metadata)}
                                     </td>
                                 </tr>
                             ))}
                              {traces.length === 0 && !loading && (
                                 <tr>
                                     <td colSpan={10} className="text-center py-20 text-[#6e6e73]">
                                         <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
                                             <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center border border-black/[0.03]">
                                                 <Calendar size={18} className="opacity-50" />
                                             </div>
                                             {dateRange === "custom" && (!customStart || !customEnd) ? (
                                                 <>
                                                     <p className="font-bold text-[#1d1d1f] text-xs">Custom Date Range Required</p>
                                                     <p className="text-[11px] text-[#6e6e73] leading-relaxed">
                                                         Please select both a start date and an end date in the date picker to view traces from this custom range.
                                                     </p>
                                                 </>
                                             ) : (
                                                 <p className="text-xs font-semibold">No traces found matching your criteria.</p>
                                             )}
                                         </div>
                                     </td>
                                 </tr>
                             )}
                         </tbody>
                     </table>
                   </div>

                   {/* Footer / Pagination */}
                   <div className="flex-none px-6 py-3 border-t border-black/[0.04] bg-white/40 flex items-center justify-between text-[11px] text-[#6e6e73]">
                        <div>
                             Showing {traces.length} rows
                        </div>
                        <div className="flex items-center gap-2">
                             <span>Rows per page</span>
                             <select className="bg-white border border-black/[0.06] rounded px-1.5 py-0.5 text-[10px] font-bold">
                                 <option>50</option>
                                 <option>100</option>
                             </select>
                             <div className="flex items-center gap-1 ml-4">
                                 <button className="p-1 hover:bg-black/[0.02] rounded cursor-pointer"><ChevronDown size={13} className="rotate-90" /></button>
                                 <button className="px-2 py-0.5 bg-white border border-black/[0.04] rounded font-bold text-[#1d1d1f]">1</button>
                                 <span className="mx-1">of 1</span>
                                 <button className="p-1 hover:bg-black/[0.02] rounded cursor-pointer"><ChevronRight size={13} /></button>
                             </div>
                        </div>
                   </div>
               </div>
             )}
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
