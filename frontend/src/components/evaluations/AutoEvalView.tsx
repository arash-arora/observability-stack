"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
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
  const [rules, setRules] = useState<Rule[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [idxLoading, setIdxLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newApp, setNewApp] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("custom");
  const [newInputs, setNewInputs] = useState("{}");
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
      setSelectedProviderId("custom"); 
  }, [newApp, applications]);
  
  const handleProviderChange = (val: string) => {
      setSelectedProviderId(val);
      if (val === "custom") {
          // Do nothing to inputs? or reset? Let's leave it.
          return;
      }
      
      const provider = providers.find(p => p.id === val);
      if (provider) {
          const inputs = {
              provider: provider.provider,
              model: provider.model_name
          };
          setNewInputs(JSON.stringify(inputs, null, 2));
      }
  };

  const handleCreate = async () => {
    setFormError("");
    try {
      let parsedInputs: any = {};
      try {
        parsedInputs = JSON.parse(newInputs);
      } catch (e) {
        setFormError("Invalid JSON in Inputs field");
        return;
      }

      if (!parsedInputs.model) {
        setFormError("Evaluation Model is required. Please specify a 'model' in the Inputs JSON.");
        return;
      }

      if (!newName || !newApp || selectedMetrics.length === 0) {
        setFormError("Please fill all required fields (Name, App, and at least one Metric)");
        return;
      }

      await api.post("/evaluations/rules", {
        name: newName,
        application_id: newApp,
        metric_ids: selectedMetrics.join(","),
        inputs: parsedInputs,
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
    setSelectedProviderId("custom");
    setNewInputs("{}");
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
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
                    <div className="flex flex-wrap gap-1 pt-1">
                        {selectedMetrics.map(id => {
                            const name = metrics.find(m => m.id === id)?.name;
                            return (
                                <Badge key={id} variant="secondary" className="text-[10px]">
                                    {name}
                                </Badge>
                            );
                        })}
                    </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Model Configuration</Label>
                <Select value={selectedProviderId} onValueChange={handleProviderChange} disabled={!newApp}>
                  <SelectTrigger>
                    <SelectValue placeholder={!newApp ? "Select Application first" : "Select Model Source"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom / Manual (Specify in JSON)</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.provider} - {p.model_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                    <Label>Inputs Override & Model Config (JSON)</Label>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => setNewInputs('{\n  "model": "gpt-4o",\n  "provider": "openai"\n}')}
                    >
                        Load Template
                    </Button>
                </div>
                <Textarea 
                   value={newInputs} 
                   onChange={(e) => setNewInputs(e.target.value)} 
                   placeholder='{"model": "gpt-4o", "provider": "openai"}'
                   className="font-mono text-xs h-24"
                />
                <p className="text-xs text-muted-foreground">
                    By default, input/output/context are extracted from the trace. Use this to override inputs or set model config.
                </p>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Create Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
