"use client";

import { useEffect, useState } from "react";
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
import { ExternalLink, RefreshCw, Activity, X } from "lucide-react";
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
}

export default function EvaluationsList() {
  const router = useRouter();
  const { selectedProject } = useDashboard();
  const [runs, setRuns] = useState<TraceEvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedApp, setSelectedApp] = useState("");
  const [applications, setApplications] = useState<Array<{ id: string; name: string }>>([]);

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

  const fetchRuns = async (time: string = timeRange, app: string = selectedApp) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("time_range", time);
      if (app) {
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
    setSelectedApp("");
  }, [selectedProject]);

  useEffect(() => {
    fetchRuns(timeRange, selectedApp);
  }, [timeRange, selectedApp]);

  useEffect(() => {
    // Poll for running methods
    const interval = setInterval(() => {
      fetchRuns(timeRange, selectedApp);
    }, 5000);
    return () => clearInterval(interval);
  }, [timeRange, selectedApp]);

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
                <SelectItem value="">All applications</SelectItem>
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
      
      <div className="rounded-md border">
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
            {runs.map((run) => (
              <TableRow 
                key={run.trace_id} 
                className="cursor-pointer hover:bg-muted/50" 
                onClick={() => router.push(`/dashboard/evaluations/run?trace_id=${run.trace_id}`)}
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
                            router.push(`/dashboard/evaluations/run?trace_id=${run.trace_id}`);
                        }}
                    >
                        View Details
                    </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && runs.length === 0 && (
                <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No evaluation runs found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rerun Modal */}
    </div>
  );
}
