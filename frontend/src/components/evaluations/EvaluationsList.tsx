"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { useDashboard } from "@/context/DashboardContext";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, RefreshCw, Activity, X, RotateCcw } from "lucide-react";
import EvaluationModal from "@/components/dashboard/EvaluationModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TraceEvaluationSummary {
  trace_id: string;
  application_name: string;
  created_at: string;
  status: string;
  passed: boolean; // True if ALL passed
  score_avg: number;
  evaluation_count: number;
  trigger_type?: string;
}

// Maps URL param values → internal tab keys
const EVAL_TYPE_TO_TAB: Record<string, "sdk" | "auto_eval" | "batch_eval"> = {
  manual_runs: "sdk",
  batch: "batch_eval",
  auto_eval: "auto_eval",
};
const TAB_TO_EVAL_TYPE: Record<string, string> = {
  sdk: "manual_runs",
  batch_eval: "batch",
  auto_eval: "auto_eval",
};

export default function EvaluationsList() {
  const router = useRouter();
  const { selectedProject } = useDashboard();
  const [runs, setRuns] = useState<TraceEvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedApp, setSelectedApp] = useState("all");
  const [applications, setApplications] = useState<Array<{ id: string; name: string }>>([]);

  // Read initial tab from URL ?eval_type=...
  const [subTab, setSubTabState] = useState<"sdk" | "auto_eval" | "batch_eval">("sdk");

  // Batch Evaluations State (disabled)
  // const [batchEvals, setBatchEvals] = useState<any[]>([]);
  // const [batchLoading, setBatchLoading] = useState(false);

  // Helper to map application ID to name
  const getAppName = (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    return app ? app.name : appId;
  };

  // const handleRerunBatchEval = async (batchId: string) => {
  //   try {
  //     await api.post(`/evaluations/batch/${batchId}/rerun`);
  //     fetchBatchEvals();
  //   } catch (e) {
  //     console.error("Failed to rerun batch evaluation", e);
  //   }
  // };

  // On mount, sync subTab from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const evalType = params.get("eval_type");
      if (evalType && EVAL_TYPE_TO_TAB[evalType]) {
        setSubTabState(EVAL_TYPE_TO_TAB[evalType]);
      }
    }
  }, []);

  // When tab changes, update URL without full navigation
  const setSubTab = useCallback((tab: "sdk" | "auto_eval" | "batch_eval") => {
    setSubTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("eval_type", TAB_TO_EVAL_TYPE[tab]);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router]);

  const fetchApplications = async () => {
    try {
      const res = await api.get("/management/applications");
      // Filter applications by selected project (if one is selected)
      const filtered = selectedProject
        ? res.data.filter((app: any) => app.project_id === selectedProject.id)
        : res.data;
      setApplications(filtered);
    } catch (e) {
      console.error("Failed to fetch applications", e);
    }
  };

  // const fetchBatchEvals = async () => {
  //   setBatchLoading(true);
  //   try {
  //     const params = new URLSearchParams();
  //     if (selectedApp && selectedApp !== "all") {
  //       const appObj = applications.find(a => a.name === selectedApp);
  //       if (appObj) {
  //         params.set("application_id", appObj.id);
  //       } else if (selectedProject) {
  //         params.set("project_id", selectedProject.id);
  //       }
  //     } else if (selectedProject) {
  //       params.set("project_id", selectedProject.id);
  //     }
  //     const res = await api.get(`/evaluations/batch?${params.toString()}`);
  //     setBatchEvals(res.data);
  //   } catch (e) {
  //     console.error("Failed to fetch batch evaluations", e);
  //   } finally {
  //     setBatchLoading(false);
  //   }
  // };

  const fetchRuns = async (time: string = timeRange, app: string = selectedApp) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("time_range", time);
      if (app && app !== "all") {
        params.append("application_name", app);
      }
      const res = await api.get(`/evaluations/runs?${params.toString()}`);
      setRuns(res.data);
    } catch (e) {
      console.error("Failed to fetch runs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // Reset selected app when project changes
    setSelectedApp("all");
  }, [selectedProject]);

  useEffect(() => {
    if (subTab === "batch_eval") {
      // fetchBatchEvals();
    } else {
      fetchRuns(timeRange, selectedApp);
    }
  }, [timeRange, selectedApp, selectedProject, subTab, applications]);

  // Polling for Runs (SDK & Auto Eval)
  useEffect(() => {
    if (subTab === "batch_eval") return;
    // Only poll when there are actively RUNNING evaluations, to avoid constant API spam
    const hasRunning = runs.some(r => r.status === "RUNNING");
    if (!hasRunning) return;
    const interval = setInterval(() => {
      fetchRuns(timeRange, selectedApp);
    }, 5000);
    return () => clearInterval(interval);
  }, [runs, timeRange, selectedApp, selectedProject, subTab]);

  // Polling for Batch Evaluations (disabled)
  // useEffect(() => {
  //   if (subTab !== "batch_eval") return;
  //   const hasRunning = batchEvals.some(be => be.status === "RUNNING");
  //   if (!hasRunning) return;
  //   const interval = setInterval(() => {
  //     fetchBatchEvals();
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [batchEvals, selectedApp, selectedProject, subTab]);

  // Filter runs by selected project's applications if one is selected
  const filteredRuns = useMemo(() => {
    if (!selectedProject || selectedApp !== "all") return runs;
    const allowedAppNames = new Set(applications.map(a => a.name));
    return runs.filter(run => allowedAppNames.has(run.application_name));
  }, [runs, applications, selectedProject, selectedApp]);

  // Filter runs by trigger type bucket
  const subTabFilteredRuns = useMemo(() => {
    return filteredRuns.filter((run) => {
      const type = run.trigger_type || "sdk";
      return type === subTab;
    });
  }, [filteredRuns, subTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-[#6e6e73]">Time Range:</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-[#6e6e73]">Application:</label>
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All applications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All applications</SelectItem>
                {applications.map((app) => (
                  <SelectItem key={app.id} value={app.name}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRuns(timeRange, selectedApp)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs value={subTab} onValueChange={(val) => setSubTab(val as any)} className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="sdk">Traces / SDK Manual Runs</TabsTrigger>
          <TabsTrigger value="auto_eval">Auto Eval Rules</TabsTrigger>
          {/* <TabsTrigger value="batch_eval">Batch Evaluations</TabsTrigger> */}
        </TabsList>
      </Tabs>
      
      <div className="rounded-md border">
        {/* Batch Eval Table Disabled */}
        {subTab === "batch_eval" ? (
          <div className="text-center py-8 text-muted-foreground">Batch evaluations are temporarily disabled.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Trace ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pass Status</TableHead>
                <TableHead>Avg. Score</TableHead>
                <TableHead>Eval Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subTabFilteredRuns.map((run) => (
                <TableRow 
                  key={run.trace_id} 
                  className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => router.push(`/dashboard/evaluations/run?evaluation_id=${run.trace_id}`)}
                >
                  <TableCell className="font-mono text-xs">
                    {format(new Date(run.created_at), "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                     {run.application_name || "Unknown"}
                  </TableCell>
                  <TableCell>
                      <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs text-muted-foreground" title={run.trace_id}>
                              {run.trace_id.substring(0, 8)}...
                          </span>
                          <Link href={`/dashboard/traces?trace_id=${run.trace_id}`} onClick={(e) => e.stopPropagation()}>
                               <ExternalLink className="h-3 w-3 text-blue-500 hover:text-blue-700" />
                          </Link>
                      </div>
                  </TableCell>
                  <TableCell>
                    {run.status === "RUNNING" ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 animate-pulse text-[10px]">
                            RUNNING
                        </Badge>
                    ) : run.status === "FAILED" ? (
                         <Badge variant="destructive" className="text-[10px]">FAILED</Badge>
                    ) : (
                        <Badge variant="outline" className="text-[10px]">COMPLETED</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                      {run.status === "RUNNING" ? (
                          <span className="text-muted-foreground text-xs">-</span>
                      ) : (
                        <Badge variant={run.passed ? "default" : "destructive"} className={run.passed ? "bg-green-500 hover:bg-green-600 text-[10px]" : "bg-red-500 hover:bg-red-600 text-[10px]"}>
                            {run.passed ? "ALL PASSED" : "ISSUES FOUND"}
                        </Badge>
                      )}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-sm">
                    {run.score_avg.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">
                      {run.evaluation_count}
                  </TableCell>
                  <TableCell className="text-right">
                      <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/evaluations/run?evaluation_id=${run.trace_id}`);
                          }}
                      >
                          View Details
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && subTabFilteredRuns.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No evaluation runs found.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Rerun Modal */}
    </div>
  );
}
