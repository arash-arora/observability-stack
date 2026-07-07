"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Plus, RotateCcw } from "lucide-react";

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
    deployment_name?: string;
}

interface BatchEvaluation {
  id: string;
  application_id: string;
  status: string;
  total_traces: number;
  traces_to_eval: number;
  evaluated_traces: number;
  successful_evaluations: number;
  failed_evaluations: number;
  avg_score?: number;
  created_at: string;
  completed_at?: string;
}

export default function BatchEvalView() {
  const { selectedOrg, selectedProject } = useDashboard();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [idxLoading, setIdxLoading] = useState(true);

  // Batch Eval State
  const [batchEvals, setBatchEvals] = useState<BatchEvaluation[]>([]);
  const [isBatchEvalOpen, setIsBatchEvalOpen] = useState(false);
  const [batchEvalLoading, setBatchEvalLoading] = useState(false);
  const [useAllTraces, setUseAllTraces] = useState(false);
  const [batchFromDate, setBatchFromDate] = useState("");
  const [batchToDate, setBatchToDate] = useState("");
  const [batchTracesCount, setBatchTracesCount] = useState<number | null>(null);
  const [batchTracesFetching, setBatchTracesFetching] = useState(false);
  const [batchMetrics, setBatchMetrics] = useState<string[]>([]);
  const [batchEvalMode, setBatchEvalMode] = useState<"count" | "percentage">("count");
  const [batchCount, setBatchCount] = useState(10);
  const [batchPercentage, setBatchPercentage] = useState(10);
  const [batchProvider, setBatchProvider] = useState("openai");
  const [batchModel, setBatchModel] = useState("gpt-4o");
  const [batchProviderId, setBatchProviderId] = useState("");
  const [batchConfigType, setBatchConfigType] = useState<"registered" | "custom">("registered");
  const [batchCustomApiKey, setBatchCustomApiKey] = useState("");
  const [batchFormError, setBatchFormError] = useState("");
  const [newApp, setNewApp] = useState("");
  const [customProviders, setCustomProviders] = useState<any[]>([]);

  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  const filteredApplications = useMemo(() => {
    if (!selectedProject) {
      return applications;
    }
    return applications.filter((app) => app.project_id === selectedProject.id);
  }, [applications, selectedProject]);

  const fetchData = async () => {
    setIdxLoading(true);
    try {
      const requests = [
        api.get("/evaluations/metrics"),
        api.get("/management/applications"),
        api.get("/management/providers/supported-for-custom-config")
      ];

      if (selectedProject?.id) {
        requests.push(api.get(`/management/providers?project_id=${selectedProject.id}`));
      }

      const results = await Promise.all(requests);
      setMetrics(results[0].data);
      setApplications(results[1].data);
      setCustomProviders(results[2].data.providers);

      if (selectedProject?.id) {
        setProviders(results[3].data);
      } else {
        setProviders([]);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setIdxLoading(false);
    }
  };

  const fetchBatchEvaluations = async (appId: string) => {
    try {
      const res = await api.get(`/evaluations/batch?application_id=${appId}`);
      setBatchEvals(res.data);
    } catch (e) {
      console.error("Failed to fetch batch evaluations", e);
    }
  };

  const fetchTracesCount = async (appId: string, fromDate: string, toDate: string) => {
    if (!fromDate || !toDate) return;

    setBatchTracesFetching(true);
    try {
      const res = await api.get(
        `/evaluations/batch-traces-count?application_id=${appId}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`
      );
      setBatchTracesCount(res.data.count);
    } catch (e) {
      console.error("Failed to fetch traces count", e);
    } finally {
      setBatchTracesFetching(false);
    }
  };

  const handleBatchFromDateChange = (date: string) => {
    setBatchFromDate(date);
    fetchTracesCount(newApp, date, batchToDate);
  };

  const handleBatchToDateChange = (date: string) => {
    setBatchToDate(date);
    fetchTracesCount(newApp, batchFromDate, date);
  };

  const resetBatchEvalForm = () => {
    setUseAllTraces(false);
    setBatchFromDate("");
    setBatchToDate("");
    setBatchTracesCount(null);
    setBatchMetrics([]);
    setBatchEvalMode("count");
    setBatchCount(10);
    setBatchPercentage(10);
    setBatchProvider("openai");
    setBatchModel("gpt-4o");
    setBatchProviderId("");
    setBatchConfigType("custom");
    setBatchCustomApiKey("");
    setBatchFormError("");
  };

  const handleRunBatchEval = async () => {
    setBatchFormError("");
    try {
      if (!useAllTraces && (!batchFromDate || !batchToDate)) {
        setBatchFormError("Please select both from and to dates or enable 'All Traces'");
        return;
      }

      if (batchMetrics.length === 0) {
        setBatchFormError("Please select at least one metric");
        return;
      }

      if (!newApp) {
        setBatchFormError("Please select an application");
        return;
      }

      let finalProvider = batchProvider;
      let finalModel = batchModel;
      let finalApiKey = batchCustomApiKey;
      let finalProviderId = batchProviderId;

      if (batchConfigType === "registered") {
        const selectedProviderObj = providers.find(p => p.id === batchProviderId);
        if (!selectedProviderObj) {
          setBatchFormError("Please select a registered model");
          return;
        }
        finalProvider = selectedProviderObj.provider;
        finalModel = selectedProviderObj.model_name;
      } else {
        if (!batchModel) {
          setBatchFormError("Please enter a model name");
          return;
        }
      }

      const tracesToEval = batchEvalMode === "percentage" ? batchPercentage : batchCount;

      setBatchEvalLoading(true);
      await api.post("/evaluations/batch", {
        application_id: newApp,
        from_date: useAllTraces ? null : new Date(batchFromDate).toISOString(),
        to_date: useAllTraces ? null : new Date(batchToDate).toISOString(),
        use_all_traces: useAllTraces,
        metric_ids: batchMetrics.join(","),
        traces_to_eval: tracesToEval,
        is_percentage: batchEvalMode === "percentage",
        percentage_value: batchEvalMode === "percentage" ? batchPercentage : null,
        provider: finalProvider,
        model_name: finalModel,
        api_key: finalApiKey,
        provider_id: finalProviderId,
      });

      setIsBatchEvalOpen(false);
      resetBatchEvalForm();
      if (newApp) {
        fetchBatchEvaluations(newApp);
      }
    } catch (e: any) {
      setBatchFormError(e.response?.data?.detail || "Failed to run batch evaluation");
    } finally {
      setBatchEvalLoading(false);
    }
  };

  const handleRerunBatchEval = async (batchId: string) => {
    try {
      await api.post(`/evaluations/batch/${batchId}/rerun`);
      if (newApp) {
        fetchBatchEvaluations(newApp);
      }
    } catch (e) {
      console.error("Failed to rerun batch evaluation", e);
    }
  };

  const getAppName = (id: string) => applications.find(a => a.id === id)?.name || id;

  useEffect(() => {
    fetchData();
  }, [selectedProject?.id]);

  useEffect(() => {
    if (selectedProject?.id) {
      setNewApp("");
      setBatchEvals([]);
    }
  }, [selectedProject?.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Batch Evaluation</h2>
          <p className="text-sm text-muted-foreground">Evaluate a subset of traces from a date range or all traces.</p>
        </div>
        {canCreate && (
          <Dialog open={isBatchEvalOpen} onOpenChange={setIsBatchEvalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetBatchEvalForm}>
                <Plus className="mr-2 h-4 w-4" /> New Batch Eval
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Batch Evaluation</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Application</Label>
                  <Select value={newApp} onValueChange={(val) => {
                    setNewApp(val);
                    if (!useAllTraces) {
                      fetchTracesCount(val, batchFromDate, batchToDate);
                    }
                    fetchBatchEvaluations(val);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Application" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredApplications.map((app) => (
                        <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useAllTraces"
                      checked={useAllTraces}
                      onChange={(e) => {
                        setUseAllTraces(e.target.checked);
                        if (e.target.checked) {
                          setBatchTracesCount(null);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Label htmlFor="useAllTraces" className="font-medium cursor-pointer">Use all available traces</Label>
                  </div>
                </div>

                {!useAllTraces && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>From Date</Label>
                      <Input
                        type="datetime-local"
                        value={batchFromDate}
                        onChange={(e) => handleBatchFromDateChange(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>To Date</Label>
                      <Input
                        type="datetime-local"
                        value={batchToDate}
                        onChange={(e) => handleBatchToDateChange(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {!useAllTraces && batchTracesCount !== null && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900">
                      Total traces in date range: <span className="font-bold">{batchTracesCount}</span>
                    </p>
                  </div>
                )}

                {!useAllTraces && batchTracesFetching && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    Fetching trace count...
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Evaluation Metrics (Select multiple)</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-40 overflow-y-auto bg-muted/20">
                    {metrics.map((m) => {
                      const isSelected = batchMetrics.includes(m.id);
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
                              setBatchMetrics(batchMetrics.filter(id => id !== m.id));
                            } else {
                              setBatchMetrics([...batchMetrics, m.id]);
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
                </div>

                <div className="grid gap-3 p-4 border rounded-2xl bg-muted/10">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                      Evaluation Count
                    </span>
                  </div>

                  <div className="flex bg-muted/20 p-0.5 rounded-lg border border-black/[0.02]">
                    <button
                      type="button"
                      onClick={() => setBatchEvalMode("count")}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        batchEvalMode === "count" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Count
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchEvalMode("percentage")}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        batchEvalMode === "percentage" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Percentage
                    </button>
                  </div>

                  {batchEvalMode === "count" ? (
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-bold uppercase">Traces to Evaluate</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10000"
                        value={batchCount}
                        onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="10"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-bold uppercase">Percentage</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={batchPercentage}
                        onChange={(e) => setBatchPercentage(Math.min(100, parseInt(e.target.value) || 1))}
                        placeholder="10"
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-3 p-4 border rounded-2xl bg-muted/10">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                      Evaluator Configuration
                    </span>
                  </div>

                  <div className="flex bg-muted/20 p-0.5 rounded-lg border border-black/[0.02]">
                    <button
                      type="button"
                      onClick={() => setBatchConfigType("registered")}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        batchConfigType === "registered" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Registered Model
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchConfigType("custom")}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        batchConfigType === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Custom Config
                    </button>
                  </div>

                  {batchConfigType === "registered" ? (
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground font-bold uppercase">Select Registered Model</Label>
                      <Select value={batchProviderId} onValueChange={setBatchProviderId} disabled={!newApp}>
                        <SelectTrigger>
                          <SelectValue placeholder={!newApp ? "Select Application first" : "Select Model Source"} />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.provider} - {p.model_name || p.deployment_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground font-bold uppercase">Provider</Label>
                        <Select value={batchProvider} onValueChange={setBatchProvider}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {customProviders.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground font-bold uppercase">LLM API Key</Label>
                        <Input
                          type="password"
                          value={batchCustomApiKey}
                          onChange={(e) => setBatchCustomApiKey(e.target.value)}
                          placeholder="Enter custom API key (optional)"
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground font-bold uppercase">Model Name</Label>
                        <Input
                          type="text"
                          value={batchModel}
                          onChange={(e) => setBatchModel(e.target.value)}
                          placeholder="gpt-4o"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {batchFormError && <p className="text-sm text-red-500">{batchFormError}</p>}
              </div>
              <DialogFooter>
                <Button onClick={handleRunBatchEval} disabled={batchEvalLoading}>
                  {batchEvalLoading ? "Running..." : "Run Batch Evaluation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-sm">Total Traces</TableHead>
              <TableHead className="text-sm">Evaluated</TableHead>
              <TableHead className="text-sm">Success Rate</TableHead>
              <TableHead className="text-sm">Avg Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchEvals.map((be) => (
              <TableRow key={be.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(be.created_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="text-sm">{getAppName(be.application_id)}</TableCell>
                <TableCell>
                  <Badge variant={be.status === "COMPLETED" ? "default" : be.status === "RUNNING" ? "secondary" : "destructive"}>
                    {be.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{be.total_traces}</TableCell>
                <TableCell className="text-sm">{be.evaluated_traces}/{be.traces_to_eval}</TableCell>
                <TableCell className="text-sm">
                  {be.evaluated_traces > 0 ? `${Math.round((be.successful_evaluations / be.evaluated_traces) * 100)}%` : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {typeof be.avg_score === 'number' ? be.avg_score.toFixed(2) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRerunBatchEval(be.id)}
                    title="Rerun evaluation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!idxLoading && batchEvals.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No batch evaluations found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
