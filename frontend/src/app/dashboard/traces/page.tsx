"use client";

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import TraceDetailSheet from '@/components/dashboard/TraceDetailSheet';
import { useDashboard } from '@/context/DashboardContext';
import PageHeader from '@/components/PageHeader';
import { 
    Clock, AlertCircle, Search, Filter, PlayCircle, 
    ChevronDown, ChevronRight, X, Calendar, Download, 
    LayoutList, MoreHorizontal, Star, ArrowUpDown, ArrowUp, ArrowDown, FlaskConical
} from 'lucide-react';
import EvaluationModal from '@/components/dashboard/EvaluationModal';
import { cn } from '@/lib/utils';
import { getPreviewString } from '@/lib/traceUtils';

export default function TracesPage() {
  const { selectedProject, selectedOrg } = useDashboard();
  
  // State
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [appNames, setAppNames] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [dateRange, setDateRange] = useState("24h"); // 24h, 3d, 7d, custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [appFilter, setAppFilter] = useState<string[]>([]);
  
  // Modal State
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // Manual Evaluation State
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
      fetchTraces(selectedProject.id);
      fetchAppNames(selectedProject.id);
    } else {
        setTraces([]);
    }
  }, [selectedProject, searchQuery, statusFilter, appFilter, sortConfig, dateRange, customStart, customEnd]);

  const toggleStatus = (status: string) => {
      setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const toggleApp = (name: string) => {
      setAppFilter(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

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
            application: appFilter,
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
    if (!jsonStr) return <span className="text-muted-foreground italic">Empty</span>;
    const preview = getPreviewString(jsonStr, 50);
    return <span className="font-mono text-xs text-muted-foreground truncate block max-w-[150px]" title={preview}>{preview}</span>;
  };

  const renderMetadata = (meta?: any) => {
      if (!meta || Object.keys(meta).length === 0) return <span className="text-muted-foreground">-</span>;
      return <div className="flex gap-1 flex-wrap max-w-full overflow-hidden">
          {Object.entries(meta).slice(0, 2).map(([k, v]: any) => {
              const valStr = typeof v === 'string' ? v : JSON.stringify(v);
              const preview = getPreviewString(valStr, 40);
              return (
                <span key={k} className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border truncate max-w-[200px]" title={`${k}=${valStr}`}>
                    {k}={preview}
                </span>
              );
          })}
          {Object.keys(meta).length > 2 && <span className="text-[10px] text-muted-foreground">+{Object.keys(meta).length - 2}</span>}
      </div>
  };

  const SortIcon = ({ column }: { column: string }) => {
      if (sortConfig.key !== column) return <ArrowUpDown size={12} className="ml-1 text-muted-foreground/50" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp size={12} className="ml-1 text-primary" />
        : <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col text-foreground overflow-hidden">
        <PageHeader 
            title="Traces" 
            infoTooltip="Detailed logs of your application's executions, including chain of thought, latency, and costs." 
        />
        
       {/* Toolbar */}
       <div className="flex-none px-1 py-3 border-b border-border flex items-center gap-4 bg-background-subtle/30">
            <div className="flex-1 max-w-xl relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input 
                    type="text" 
                    placeholder="Search traces..." 
                    className="w-full bg-background border border-border rounded pl-9 pr-3 py-1.5 text-sm focus:ring-1 focus:ring-primary h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground"/>
                    <select 
                        className="bg-background border border-border rounded text-sm px-2 py-1.5 h-9 focus:ring-1 focus:ring-primary"
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
                            className="bg-background border border-border rounded text-sm px-2 py-1.5 h-9"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                        />
                        <span className="text-muted-foreground">-</span>
                        <input 
                            type="datetime-local" 
                            className="bg-background border border-border rounded text-sm px-2 py-1.5 h-9"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                        />
                    </div>
                )}
            </div>
       </div>

       {/* Main Content Area */}
       <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Filters */}
            <div className="w-64 border-r border-border bg-background-subtle/10 flex-none overflow-y-auto p-4 space-y-6 hidden md:block">
                {/* Filter Group: Status */}
                <div>
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground">Status</h3>
                        <ChevronDown size={14} className="text-muted-foreground"/>
                    </div>
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                             <input 
                                type="checkbox" 
                                className="rounded border-border bg-transparent"
                                checked={statusFilter.includes('SUCCESS')}
                                onChange={() => toggleStatus('SUCCESS')}
                             /> Success
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                             <input 
                                type="checkbox" 
                                className="rounded border-border bg-transparent"
                                checked={statusFilter.includes('ERROR')}
                                onChange={() => toggleStatus('ERROR')}
                             /> Error
                        </label>
                    </div>
                </div>
                

                

                
                {/* Filter Group: Application Name */}
                <div>
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground">Application Name</h3>
                        <ChevronDown size={14} className="text-muted-foreground"/>
                    </div>
                    {/* Dynamic app name list */}
                    <div className="space-y-1">
                        {appNames.length === 0 && <span className="text-xs text-muted-foreground italic px-2">No applications found</span>}
                        {appNames.map(name => (
                             <label key={name} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-border bg-transparent"
                                    checked={appFilter.includes(name)}
                                    onChange={() => toggleApp(name)}
                                /> <span className="truncate" title={name}>{name}</span>
                             </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-background">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-background-subtle/50 sticky top-0 z-10 backdrop-blur-sm">
                        <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="w-10 px-4 py-3 text-center">
                                <input type="checkbox" className="rounded border-border bg-transparent" />
                            </th>
                            <th 
                                className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('timestamp')}
                            >
                                <div className="flex items-center gap-1">
                                    Timestamp <SortIcon column="timestamp" />
                                </div>
                            </th>
                            <th 
                                className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    Name <SortIcon column="name" />
                                </div>
                            </th>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">Application Name</th>
                            <th 
                                className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('latency')}
                            >
                                <div className="flex items-center gap-1">
                                    Latency <SortIcon column="latency" />
                                </div>
                            </th>
                            <th 
                                className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('tokens')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Tokens <SortIcon column="tokens" />
                                </div>
                            </th>
                            <th className="px-4 py-3 font-medium text-right">Cost</th>
                            <th className="px-4 py-3 font-medium w-1/6">Input</th>
                            <th className="px-4 py-3 font-medium w-1/6">Output</th>
                            <th className="px-4 py-3 font-medium">Metadata</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {traces.map((trace: any) => (
                            <tr 
                                key={trace.trace_id} 
                                className="group border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                                onClick={() => handleTraceClick(trace.trace_id)}
                            >
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-2">
                                        <input type="checkbox" className="rounded border-border bg-transparent" />
                                        <Star size={14} className="text-muted-foreground hover:text-yellow-500 cursor-pointer" />
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap font-mono">
                                    {new Date(trace.start_time).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-foreground flex items-center gap-2">
                                        {trace.status_code === 'ERROR' ? (
                                            <AlertCircle size={14} className="text-destructive"/>
                                        ) : (
                                            <PlayCircle size={14} className="text-indigo-400"/>
                                        )}
                                        {trace.name}
                                        {(trace.name.startsWith('evaluation_') || trace.metadata?.is_evaluation) && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 font-normal ml-2">
                                                <FlaskConical size={10} />
                                                Eval
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-70">
                                        {trace.trace_id.slice(0, 8)}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {trace.application_name || <span className="italic opacity-50">Unknown</span>}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                                    {trace.duration_ms ? `${trace.duration_ms.toFixed(3)}s` : '-'}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-right text-foreground">
                                    {trace.total_tokens || '-'}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-right text-foreground">
                                    {trace.total_cost ? `$${trace.total_cost.toFixed(5)}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-xs w-1/6 max-w-[150px] overflow-hidden">
                                     {renderJSONPreview(trace.input)}
                                </td>
                                <td className="px-4 py-3 text-xs w-1/6 max-w-[150px] overflow-hidden">
                                     {renderJSONPreview(trace.output)}
                                </td>
                                <td className="px-4 py-3 text-xs">
                                     {renderMetadata(trace.metadata)}
                                </td>
                            </tr>
                        ))}
                         {traces.length === 0 && !loading && (
                            <tr>
                                <td colSpan={9} className="text-center py-20 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                                            <Search size={20} className="opacity-50" />
                                        </div>
                                        <p>No traces found matching your criteria.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
       </div>
       
       {/* Footer / Pagination */}
       <div className="flex-none px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-background">
            <div>
                 Showing {traces.length} rows
            </div>
            <div className="flex items-center gap-2">
                 <span>Rows per page</span>
                 <select className="bg-background-subtle border border-border rounded px-1 py-0.5">
                     <option>50</option>
                     <option>100</option>
                 </select>
                 <div className="flex items-center gap-1 ml-4">
                     <button className="p-1 hover:bg-muted rounded"><ChevronDown size={14} className="rotate-90" /></button>
                     <button className="px-2 py-0.5 bg-background border border-border rounded text-foreground">1</button>
                     <span className="mx-1">of 4</span>
                     <button className="p-1 hover:bg-muted rounded"><ChevronRight size={14} /></button>
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
