"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import TraceDetailSheet from '@/components/dashboard/TraceDetailSheet';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CreateOrgModal } from '@/components/dashboard/CreateOrgModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { 
    Clock, AlertCircle, Search, Filter, PlayCircle, 
    ChevronDown, ChevronRight, X, Calendar, Download, 
    LayoutList, MoreHorizontal, Star 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple utility if utils not present
const classNames = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface Trace {
  trace_id: string;
  name: string;
  duration_ms: number;
  start_time: string;
  status_code: string;
  user_id?: string;
  input?: string;
  output?: string;
}

export default function TracesPage() {
  // State
  const [projects, setProjects] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]); // New: Orgs
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Computed
  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentOrg = currentProject ? orgs.find(o => o.id === currentProject.organization_id) : null;
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // Header State
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const handleOrgChange = (org: any) => {
      if (org.id === 'create_new') {
          setShowCreateOrg(true);
      } else {
          // Find first project for this org
          const orgProjects = projects.filter(p => p.organization_id === org.id);
          if (orgProjects.length > 0) {
              setSelectedProjectId(orgProjects[0].id);
          } else {
              setSelectedProjectId(''); // No projects
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
         setSelectedProjectId(proj.id);
     }
  };

  useEffect(() => {
    fetchContext(); // Fetch both projects and orgs
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTraces(selectedProjectId);
    }
  }, [selectedProjectId, searchQuery]);

  const fetchContext = async () => {
      try {
          const [pRes, oRes] = await Promise.all([
              api.get('/management/projects'),
              api.get('/management/organizations')
          ]);
          setProjects(pRes.data);
          setOrgs(oRes.data);
          if (pRes.data.length > 0) setSelectedProjectId(pRes.data[0].id);
      } catch (err) {
          console.error('Failed to fetch context');
      }
  };

  const fetchTraces = async (projectId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/analytics/traces`, {
        params: { 
            project_id: projectId, 
            limit: 50,
            search: searchQuery 
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

  // Render Helpers
  const renderJSONPreview = (jsonStr?: string) => {
    if (!jsonStr) return <span className="text-muted-foreground italic">Empty</span>;
    try {
        const parsed = JSON.parse(jsonStr);
        const preview = JSON.stringify(parsed);
        return <span className="font-mono text-xs text-muted-foreground truncate block max-w-[150px]">{preview}</span>;
    } catch (e) {
        return <span className="font-mono text-xs text-muted-foreground truncate block max-w-[150px]">{jsonStr}</span>;
    }
  };

  const renderMetadata = (meta?: any) => {
      if (!meta || Object.keys(meta).length === 0) return <span className="text-muted-foreground">-</span>;
      return <div className="flex gap-1 flex-wrap">
          {Object.entries(meta).slice(0, 2).map(([k, v]: any) => (
              <span key={k} className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border">
                  {k}={String(v)}
              </span>
          ))}
          {Object.keys(meta).length > 2 && <span className="text-[10px] text-muted-foreground">+{Object.keys(meta).length - 2}</span>}
      </div>
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background text-foreground overflow-hidden">
        {/* Header */}
       <DashboardHeader 
         title="Traces"
         currentOrg={currentOrg || null}
         currentProject={currentProject || null}
         organizations={orgs}
         projects={projects.filter(p => !currentOrg || p.organization_id === currentOrg?.id)}
         onOrgChange={handleOrgChange}
         onProjectChange={handleProjectChange}
       />

       {/* Modals */}
        {showCreateOrg && (
            <CreateOrgModal 
                onClose={() => setShowCreateOrg(false)}
                onCreated={(newOrg) => {
                    setOrgs([...orgs, newOrg]);
                    // Auto select? 
                    // handleOrgChange(newOrg);
                }}
            />
        )}
        {showCreateProject && currentOrg && (
            <CreateProjectModal 
                orgId={currentOrg.id}
                onClose={() => setShowCreateProject(false)}
                onCreated={(newProj) => {
                    setProjects([...projects, newProj]);
                    setSelectedProjectId(newProj.id);
                }}
            />
        )}

       {/* Toolbar */}
       <div className="flex-none px-6 py-3 border-b border-border flex items-center gap-4 bg-background-subtle/30">
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
                <button className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded text-sm hover:bg-muted font-medium">
                    <Filter size={14} /> Filters
                </button>
                <div className="w-px h-6 bg-border mx-1" />
                <button className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded text-sm hover:bg-muted">
                    Columns <span className="bg-muted px-1 rounded text-xs">19/31</span>
                </button>
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
                             <input type="checkbox" className="rounded border-border bg-transparent"/> Success
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                             <input type="checkbox" className="rounded border-border bg-transparent"/> Error
                        </label>
                    </div>
                </div>
                
                {/* Filter Group: Trace Name */}
                <div>
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground">Trace Name</h3>
                        <ChevronDown size={14} className="text-muted-foreground"/>
                    </div>
                    {/* Mock trace name list */}
                    <div className="space-y-1">
                        {['Execute evaluator', 'QA-Chatbot', 'Data Processing', 'User Login'].map(name => (
                             <label key={name} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                                <input type="checkbox" className="rounded border-border bg-transparent"/> {name}
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
                            <th className="px-4 py-3 font-medium whitespace-nowrap">Timestamp</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Latency</th>
                            <th className="px-4 py-3 font-medium text-right">Tokens</th>
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
                                onClick={() => setSelectedTraceId(trace.trace_id)}
                            >
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-2">
                                        <input type="checkbox" className="rounded border-border bg-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <Star size={14} className="text-muted-foreground hover:text-yellow-500 cursor-pointer opacity-0 group-hover:opacity-100" />
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
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-70">
                                        {trace.trace_id.slice(0, 8)}
                                    </div>
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
         onClose={() => setSelectedTraceId(null)}
         traceId={selectedTraceId}
       />
    </div>
  );
}
