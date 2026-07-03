"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useDashboard } from "@/context/DashboardContext";
import { format } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Play, MoreHorizontal } from "lucide-react";

interface Rule {
  id: number;
  name: string;
  application_id: string;
  metric_ids: string;
  inputs: any;
  active: boolean;
  percentage: number;
  created_at: string;
}

interface Metric {
  id: string;
  name: string;
  description: string;
  inputs?: string[];
}

interface Application {
  id: string;
  name: string;
  project_id: string;
}

interface LLMProvider {
    id: string;
    name: string;
    provider: string;
    model_name: string;
}

export default function AutoEvalView() {
  const { selectedOrg } = useDashboard();
  const [rules, setRules] = useState<Rule[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [idxLoading, setIdxLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Check permissions
  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  // Form State
  const [newName, setNewName] = useState("");
  const [newApp, setNewApp] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [configType, setConfigType] = useState<"registered" | "custom">("custom");
  const [customProvider, setCustomProvider] = useState("openai");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customModelName, setCustomModelName] = useState("gpt-4o");
  const [formError, setFormError] = useState("");

  const fetchData = async () => {
    setIdxLoading(true);
    try {
      const [rulesRes, metricRes, appsRes] = await Promise.all([
        api.get("/evaluations/rules"),
        api.get("/evaluations/metrics"),
        api.get("/management/applications") // Assuming this endpoint exists, or projects/applications
      ]);
      setRules(rulesRes.data);
      setMetrics(metricRes.data);
      setApplications(appsRes.data);
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setIdxLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchProviders = async (projectId: string) => {
      try {
          const res = await api.get(`/management/providers?project_id=${projectId}`);
          setProviders(res.data);
      } catch (e) {
          console.error("Failed to fetch providers", e);
          setProviders([]);
      }
  };

  useEffect(() => {
      if (newApp) {
          const app = applications.find(a => a.id === newApp);
          if (app) {
              fetchProviders(app.project_id);
          }
      } else {
          setProviders([]);
      }
  }, [newApp, applications]);

  useEffect(() => {
      if (providers.length > 0) {
          setSelectedProviderId(providers[0].id);
      } else {
          setSelectedProviderId("");
      }
  }, [providers]);

  const handleCreate = async () => {
    setFormError("");
    try {
      let finalInputs: any = {};
      if (configType === "custom") {
          if (!customModelName) {
              setFormError("Model Name is required for Custom Config.");
              return;
          }
          finalInputs.provider = customProvider;
          finalInputs.model = customModelName;
          if (customApiKey) {
              finalInputs.api_key = customApiKey;
          }
      } else {
          const provider = providers.find(p => p.id === selectedProviderId);
          if (!provider) {
              setFormError("Please select a registered model or switch to Custom Config.");
              return;
          }
          finalInputs.provider = provider.provider;
          finalInputs.model = provider.model_name;
      }

      if (!newName || !newApp || selectedMetrics.length === 0) {
        setFormError("Please fill all required fields (Name, App, and at least one Metric)");
        return;
      }

      await api.post("/evaluations/rules", {
        name: newName,
        application_id: newApp,
        metric_ids: selectedMetrics.join(","),
        inputs: finalInputs,
        active: true,
        percentage: 100.0
      });

      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      setFormError(e.response?.data?.detail || "Failed to create rule");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      await api.delete(`/evaluations/rules/${id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const handleToggle = async (r: Rule) => {
    try {
      await api.post(`/evaluations/rules/${r.id}/toggle?active=${!r.active}`);
      fetchData();
    } catch (e) {
      console.error("Toggle failed", e);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewApp("");
    setSelectedMetrics([]);
    setSelectedProviderId("");
    setConfigType("custom");
    setCustomProvider("openai");
    setCustomApiKey("");
    setCustomModelName("gpt-4o");
    setFormError("");
  };

  const getAppName = (id: string) => applications.find(a => a.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-semibold tracking-tight">Auto-Evaluation Rules</h2>
           <p className="text-sm text-muted-foreground">Automatically trigger evaluations on new traces.</p>
        </div>
        {canCreate && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
                <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" /> New Rule
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                <DialogTitle>Create Auto-Eval Rule</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Rule Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Hallucination Check" />
                </div>
                
                <div className="grid gap-2">
                    <Label>Application</Label>
                    <Select value={newApp} onValueChange={setNewApp}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Application" />
                    </SelectTrigger>
                    <SelectContent>
                        {applications.map((app) => (
                        <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label>Evaluation Metrics (Select multiple)</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-40 overflow-y-auto bg-muted/20">
                        {metrics.map((m) => {
                            const isSelected = selectedMetrics.includes(m.id);
                            return (
                                <div 
                                    key={m.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                                        isSelected 
                                        ? "bg-primary/10 border-primary text-primary" 
                                        : "bg-background border-transparent hover:bg-muted"
                                    }`}
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedMetrics(selectedMetrics.filter(id => id !== m.id));
                                        } else {
                                            setSelectedMetrics([...selectedMetrics, m.id]);
                                        }
                                    }}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                        isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                    }`}>
                                        {isSelected && <Plus className="h-3 w-3 text-primary-foreground rotate-45" />}
                                    </div>
                                    <span className="text-sm font-medium">{m.name}</span>
                                </div>
                            );
                        })}
                    </div>
                    {selectedMetrics.length > 0 && (
                        <div className="flex flex-col gap-2 pt-2 border-t mt-3">
                            <div className="flex flex-wrap gap-1">
                                {selectedMetrics.map(id => {
                                    const name = metrics.find(m => m.id === id)?.name;
                                    return (
                                        <Badge key={id} variant="secondary" className="text-[10px]">
                                            {name}
                                        </Badge>
                                    );
                                })}
                            </div>
                            
                            {/* Required Inputs Hint */}
                            {(() => {
                                const activeInputs = new Set<string>();
                                selectedMetrics.forEach(id => {
                                    const m = metrics.find(m => m.id === id);
                                    if (m && m.inputs) {
                                        m.inputs.forEach((inp: string) => activeInputs.add(inp));
                                    }
                                });
                                const reqInputs = Array.from(activeInputs).filter(i => 
                                    !['input', 'output', 'query', 'response', 'context'].includes(i.toLowerCase())
                                );
                                
                                if (reqInputs.length > 0) {
                                    return (
                                        <div className="text-xs p-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-md">
                                            <strong>Note:</strong> Selected metrics require custom inputs. Please provide them in the JSON override below:
                                            <div className="font-mono mt-1 text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded w-fit">
                                                {reqInputs.join(', ')}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}
                </div>

                {/* Evaluator Model Configuration block */}
                <div className="grid gap-3 p-4 border rounded-2xl bg-muted/10">
                    <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                            Evaluator Configuration
                        </span>
                    </div>

                    <div className="flex bg-muted/20 p-0.5 rounded-lg border border-black/[0.02]">
                        <button
                            type="button"
                            onClick={() => setConfigType("registered")}
                            className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                configType === "registered" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Registered Model
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfigType("custom")}
                            className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                configType === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Custom Config
                        </button>
                    </div>

                    {configType === "registered" ? (
                        <div className="grid gap-1.5">
                            <Label className="text-xs text-muted-foreground font-bold uppercase">Select Registered Model</Label>
                            <Select value={selectedProviderId} onValueChange={setSelectedProviderId} disabled={!newApp}>
                                <SelectTrigger>
                                    <SelectValue placeholder={!newApp ? "Select Application first" : "Select Model Source"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {providers.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} ({p.provider} - {p.model_name})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid gap-1.5">
                                <Label className="text-xs text-muted-foreground font-bold uppercase">Provider</Label>
                                <Select value={customProvider} onValueChange={setCustomProvider}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="groq">Groq</SelectItem>
                                        <SelectItem value="anthropic">Anthropic</SelectItem>
                                        <SelectItem value="google">Google</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs text-muted-foreground font-bold uppercase">LLM API Key</Label>
                                <Input 
                                    type="password" 
                                    value={customApiKey} 
                                    onChange={(e) => setCustomApiKey(e.target.value)} 
                                    placeholder="Enter custom API key (optional)" 
                                />
                            </div>

                            <div className="grid gap-1.5">
                                <Label className="text-xs text-muted-foreground font-bold uppercase">Model Name</Label>
                                <Input 
                                    type="text" 
                                    value={customModelName} 
                                    onChange={(e) => setCustomModelName(e.target.value)} 
                                    placeholder="gpt-4o" 
                                />
                            </div>
                        </div>
                    )}
                </div>
                

                {formError && <p className="text-sm text-red-500">{formError}</p>}
                </div>
                <DialogFooter>
                <Button onClick={handleCreate}>Create Rule</Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{getAppName(r.application_id)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.metric_ids.split(",").map(mId => (
                      <Badge key={mId} variant="outline">{mId}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={r.active ? "default" : "secondary"}
                    className={r.active ? "bg-green-500 hover:bg-green-600" : ""}
                    onClick={() => handleToggle(r)}
                  >
                    {r.active ? "Active" : "Paused"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(r.created_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        title={r.active ? "Pause" : "Resume"}
                        onClick={() => handleToggle(r)}
                    >
                        {r.active ? <span className="text-xs">⏸</span> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(r.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!idxLoading && rules.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No auto-eval rules found. Create one to start evaluating new traces automatically.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
