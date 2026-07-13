"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Plus, Trash2, ShieldAlert, Boxes, Sparkles, Activity, Cpu, Calendar, Clock, Terminal, Layers } from "lucide-react";
import ApplicationModal from "@/components/applications/ApplicationModal";
import { useDashboard } from "@/context/DashboardContext";
import PageHeader from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Application {
  id: string;
  name: string;
  project_id: string;
  api_key?: string;
  last_trace_at?: string;
}

export default function ApplicationsPage() {
  const { projects, selectedProject, selectedOrg } = useDashboard();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGetStartedOpen, setIsGetStartedOpen] = useState(false);
  const [createdApp, setCreatedApp] = useState<Application | null>(null);

  // Check permissions - Admin or Maintainer can create
  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  const fetchData = async () => {
    setLoading(true);
    try {
      const appsRes = await api.get("/management/applications");
      setApplications(appsRes.data);
    } catch (e) {
      console.error("Failed to fetch applications", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || "Unknown";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      await api.delete(`/management/applications/${id}`);
      fetchData();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleCreated = (app: Application) => {
    setCreatedApp(app);
    setIsGetStartedOpen(true);
    fetchData();
  };

  // Filter projects by selected organization
  const orgProjects = useMemo(() => {
    if (!selectedOrg) return projects;
    return projects.filter(p => p.organization_id === selectedOrg.id);
  }, [projects, selectedOrg]);

  // Filter applications by selected project if one is selected, or by selected organization
  const filteredApplications = useMemo(() => {
    if (selectedProject) {
      return applications.filter(app => app.project_id === selectedProject.id);
    }
    if (selectedOrg) {
      const orgProjectIds = orgProjects.map(p => p.id);
      return applications.filter(app => orgProjectIds.includes(app.project_id));
    }
    return applications;
  }, [applications, selectedProject, selectedOrg, orgProjects]);

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return "Never";
    const time = new Date(isoString).getTime();
    const diffMs = Date.now() - time;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const lastActivity = useMemo(() => {
    const dates = filteredApplications
      .map(app => app.last_trace_at ? new Date(app.last_trace_at).getTime() : 0)
      .filter(time => time > 0);
    if (dates.length === 0) return "No activity";
    const maxTime = Math.max(...dates);
    const diffMs = Date.now() - maxTime;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(maxTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [filteredApplications]);

  return (
    <div className="flex flex-col gap-8 font-sans">
      <div className="flex items-center justify-between">
         <PageHeader 
            title="Applications" 
            infoTooltip="Register and configure integrations for your framework-agnostic LLM applications." 
         />
         {canCreate && (
             <Button 
               onClick={() => setIsModalOpen(true)}
               disabled={selectedOrg && orgProjects.length === 0}
               className="bg-[#0071e3] hover:bg-[#0071e3]/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Plus size={14} /> New Application
             </Button>
         )}
      </div>

      {selectedOrg && orgProjects.length === 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 flex flex-col gap-2 -mt-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldAlert size={18} className="text-amber-600 shrink-0" />
            <span className="font-bold text-xs">No project created yet</span>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed max-w-2xl">
            You must create a project under <span className="font-bold">{selectedOrg.name}</span> before you can create an application. Please use the project selector in the top navigation bar to create a project first.
          </p>
        </div>
      )}

      {selectedProject && (
          <p className="text-xs text-[#6e6e73] font-semibold -mt-6">
              Showing integrations for: <span className="text-[#1d1d1f] font-bold">{selectedProject.name}</span>
          </p>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 -mt-2">
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-wider">Integrations</span>
            <div className="text-2xl font-bold text-[#1d1d1f] tracking-tight mt-1">{filteredApplications.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-[#0071e3]">
            <Boxes size={18} />
          </div>
        </div>

        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-wider">Last Telemetry</span>
            <div className="text-2xl font-bold text-[#1d1d1f] tracking-tight mt-1 truncate max-w-[160px]">{lastActivity}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-[#34c759]">
            <Activity size={18} />
          </div>
        </div>

        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-wider">Telemetry Gateway</span>
            <div className="text-2xl font-bold text-[#1d1d1f] tracking-tight mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-[#5856d6]">
            <Cpu size={18} />
          </div>
        </div>
      </div>

      {/* Applications List Table */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-black/[0.04]">
              <TableHead className="text-xs font-bold text-[#6e6e73] py-3.5">Name</TableHead>
              <TableHead className="text-xs font-bold text-[#6e6e73] py-3.5">Project</TableHead>
              <TableHead className="text-xs font-bold text-[#6e6e73] py-3.5">API Key</TableHead>
              <TableHead className="text-xs font-bold text-[#6e6e73] py-3.5">Last Active Trace</TableHead>
              <TableHead className="text-xs font-bold text-[#6e6e73] py-3.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((app) => (
              <TableRow key={app.id} className="hover:bg-black/[0.01] border-black/[0.04] transition-colors">
                <TableCell className="font-semibold text-xs py-4 text-[#1d1d1f]">
                    <Link href={`/dashboard/applications/${app.id}`} className="hover:underline text-[#0071e3]">
                        {app.name}
                    </Link>
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant="outline" className="text-[10px] font-bold text-[#6e6e73] bg-black/[0.02] border-black/[0.03] px-2 py-0.5 rounded-full">
                    {getProjectName(app.project_id)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-[#6e6e73] py-4">
                    {app.api_key ? (
                        <div className="flex items-center gap-2">
                            <span>{app.api_key}</span>
                            {/* <CopyButton text={app.api_key} size="icon" /> */}
                        </div>
                    ) : (
                        "sk-••••••••••••••••"
                    )}
                </TableCell>
                <TableCell className="text-xs py-4 font-mono text-[#6e6e73]">
                  {formatRelativeTime(app.last_trace_at)}
                </TableCell>
                <TableCell className="text-right py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(app.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredApplications.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3 text-[#6e6e73] max-w-sm mx-auto">
                    <div className="p-3.5 rounded-2xl bg-neutral-100/80 border border-black/[0.03] text-[#86868b]">
                      <Boxes size={24} />
                    </div>
                    <h3 className="text-xs font-bold text-[#1d1d1f] mt-2">No Applications Configured</h3>
                    <p className="text-[11px] leading-relaxed text-[#86868b]">
                      Applications allow your framework-agnostic AI codebases to connect, retrieve api credentials, and stream telemetry traces to this dashboard.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={selectedProject ? [selectedProject] : orgProjects} 
        onCreated={handleCreated}
      />

      <GetStartedModal 
        isOpen={isGetStartedOpen}
        onClose={() => setIsGetStartedOpen(false)}
        app={createdApp}
      />
    </div>
  );
}

function GetStartedModal({
  isOpen,
  onClose,
  app,
}: {
  isOpen: boolean;
  onClose: () => void;
  app: Application | null;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!app) return null;

  const codeSnippets = {
    importCode: `from observix import observe`,
    decorator: `@observe(name="agent_workflow_span")
def execute_agent_loop(query: str):
    # Logs nested tool calls and inputs/outputs automatically
    return "workflow_response"`,
    env: `# Set these configuration variables in your project env
export OBSERVIX_API_KEY="${app.api_key || "sk-your-new-app-key"}"
export OBSERVIX_BACKEND_URL="http://localhost:8000/api/v1"`
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] rounded-3xl p-6 bg-white/95 backdrop-blur-xl border border-black/[0.04]">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
            <Sparkles size={16} className="text-[#0071e3]" />
            Integrate Application
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6e6e73] leading-relaxed mt-1">
            Follow these 3 simple framework-agnostic steps to initialize telemetry tracing for <strong>{app.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-4 max-h-[400px] overflow-y-auto pr-1">
          <div className="rounded-2xl border border-black/[0.06] bg-[#f8fbff] p-3.5">
            <p className="text-[10px] font-bold tracking-wider uppercase text-[#6e6e73]">Application API Key</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="text-[11px] font-mono text-[#1d1d1f] break-all">{app.api_key || "sk-your-new-app-key"}</code>
              {app.api_key && <CopyButton text={app.api_key} size="icon" />}
            </div>
            <p className="mt-1.5 text-[10px] text-[#6e6e73]">Copy and store this key securely before closing.</p>
          </div>

          {/* Step 1 */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-black/[0.04] text-[9px] font-mono font-bold inline-flex items-center justify-center">1</span>
              Import Observix
            </h4>
            <div className="relative">
              <pre className="text-[10px] font-mono bg-black/90 text-neutral-300 p-3 rounded-xl overflow-x-auto select-all leading-normal">
                {codeSnippets.importCode}
              </pre>
              <button
                onClick={() => handleCopy(codeSnippets.importCode, "import")}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-neutral-300 cursor-pointer"
              >
                {copiedId === "import" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-black/[0.04] text-[9px] font-mono font-bold inline-flex items-center justify-center">2</span>
              Decorate Functions
            </h4>
            <div className="relative">
              <pre className="text-[10px] font-mono bg-black/90 text-neutral-300 p-3 rounded-xl overflow-x-auto select-all leading-normal">
                {codeSnippets.decorator}
              </pre>
              <button
                onClick={() => handleCopy(codeSnippets.decorator, "decorator")}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-neutral-300 cursor-pointer"
              >
                {copiedId === "decorator" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-black/[0.04] text-[9px] font-mono font-bold inline-flex items-center justify-center">3</span>
              Set Environment Variables
            </h4>
            <div className="relative">
              <pre className="text-[10px] font-mono bg-black/90 text-neutral-300 p-3 rounded-xl overflow-x-auto select-all leading-normal">
                {codeSnippets.env}
              </pre>
              <button
                onClick={() => handleCopy(codeSnippets.env, "env")}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-neutral-300 cursor-pointer"
              >
                {copiedId === "env" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-black/[0.04] pt-4 mt-2">
          <Button 
            onClick={onClose}
            className="bg-[#0071e3] hover:bg-[#0071e3]/90 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Got it, let's trace!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ text, label, variant = "ghost", size = "sm" }: { text: string, label?: string, variant?: any, size?: any }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
            } catch (e) {
                console.error('Copy failed', e);
            }
            document.body.removeChild(textArea);
        }
        setTimeout(() => setCopied(false), 2000);
    };

    if (size === "icon") {
        return (
            <button 
                onClick={handleCopy} 
                className="p-1 hover:bg-black/[0.04] rounded text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                title="Copy API Key"
            >
                {copied ? <Check size={13} className="text-green-500"/> : <Copy size={13}/>}
            </button>
        );
    }

    return (
        <Button variant={variant} size={size} onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : (label || "Copy")}
        </Button>
    );
}
