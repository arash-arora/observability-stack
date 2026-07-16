"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { EvaluationsCharts } from "./EvaluationsCharts";
import { useDashboard } from "@/context/DashboardContext";
import { Loader2, Activity, CheckCircle, ShieldAlert, Award, Percent, ChevronRight, BarChart3, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function EvaluationsOverview() {
  const { selectedProject } = useDashboard();
  const [stats, setStats] = useState<any>(null);
  const [applications, setApplications] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!selectedProject) {
        setApplications([]);
        return;
      }

      try {
        const res = await api.get("/management/applications");
        const appNames = res.data
          .filter((app: any) => app.project_id === selectedProject.id)
          .map((app: any) => app.name)
          .sort((a: string, b: string) => a.localeCompare(b));
        setApplications(appNames);
      } catch (e) {
        console.error("Failed to fetch applications for evaluation filter", e);
        setApplications([]);
      }
    };

    fetchApplications();
  }, [selectedProject]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedProject) {
        setStats(null);
        setLoading(false);
        setFiltering(false);
        return;
      }

      try {
        if (loading) {
          setLoading(true);
        } else {
          setFiltering(true);
        }

        const params: any = { project_id: selectedProject.id };
        if (selectedApp !== "all") {
          params.application_name = selectedApp;
        }

        const url = "/analytics/evaluation-stats";
        const res = await api.get(url, { params });
        setStats(res.data);
      } catch (e) {
        console.error("Failed to fetch evaluation stats", e);
      } finally {
        setLoading(false);
        setFiltering(false);
      }
    };
    fetchStats();
  }, [selectedApp, selectedProject]);

  useEffect(() => {
    if (selectedApp !== "all" && !applications.includes(selectedApp)) {
      setSelectedApp("all");
    }
  }, [applications, selectedApp]);

  if (loading) {
    return (
      <div className="p-24 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading evaluation analytics...</p>
      </div>
    );
  }

  if (!stats) return <div className="p-4 text-muted-foreground">No evaluation data available.</div>;

  // Calculate derived stats
  const total = stats.total_runs !== undefined ? stats.total_runs : 0;
  const passed = stats.pass_fail ? (stats.pass_fail.find((p: any) => p.name === 'Passed')?.value || 0) : 0;
  const failed = total - passed;
  const passRate = total > 0 ? (passed / total * 100) : 0;
  const avgScore = stats.avg_scores?.length > 0 
    ? stats.avg_scores.reduce((acc: number, curr: any) => acc + curr.score, 0) / stats.avg_scores.length 
    : 0;

  const getScoreRating = (score: number) => {
    if (score >= 0.8) return { label: "Exceptional", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
    if (score >= 0.6) return { label: "Proficient", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    if (score >= 0.4) return { label: "Adequate", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    return { label: "Below Standard", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
  };

  const rating = getScoreRating(avgScore);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header and Application Selection Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-muted pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Overview & Insights</h2>
          <p className="text-sm text-muted-foreground">
            Aggregate quality metrics, test performance, and application comparison insights.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card p-1.5 rounded-lg border border-border self-start md:self-auto">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">Filter Application:</span>
          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger className="w-[200px] h-9 bg-background border-none shadow-none focus:ring-0">
              <SelectValue placeholder="All Applications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              {applications.map((appName) => (
                <SelectItem key={appName} value={appName}>
                  {appName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtering && (
        <div className="h-1 w-full bg-muted overflow-hidden relative rounded-full">
          <div className="absolute h-full bg-primary animate-progress w-[40%] rounded-full" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* 1. Total Evaluations */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Evaluations</CardTitle>
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">Aggregated evaluation checks run</p>
          </CardContent>
        </Card>

        {/* 2. Pass Rate */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Pass Rate</CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{passRate.toFixed(1)}%</div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-3">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" 
                style={{ width: `${passRate}%` }} 
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Average Score */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <div className="p-1.5 rounded-md bg-violet-500/10 text-violet-500">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{avgScore.toFixed(2)}</div>
            {total > 0 ? (
              <Badge className={`mt-2 font-medium tracking-wide text-[10px] uppercase border ${rating.color}`} variant="outline">
                {rating.label}
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No evaluations completed</p>
            )}
          </CardContent>
        </Card>

        {/* 4. Failed Evaluations */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Runs</CardTitle>
            <div className={`p-1.5 rounded-md ${failed > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-muted text-muted-foreground'}`}>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${failed > 0 ? 'text-rose-500' : 'text-foreground'}`}>
              {failed}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {total > 0 ? `${((failed / total) * 100).toFixed(1)}% failure rate` : "0% failure rate"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Aggregated Recharts */}
      <EvaluationsCharts data={stats} />

      {/* Application Wise Insights Grid Section */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        
        {/* Application Performance Table */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground">Application Insights</CardTitle>
              <CardDescription>Metrics comparison across LLM applications</CardDescription>
            </div>
            <Badge variant="outline" className="self-start sm:self-auto text-xs bg-muted/30">
              {stats.app_summary?.length || 0} Applications Registered
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            {stats.app_summary && stats.app_summary.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead className="text-right">Total Runs</TableHead>
                      <TableHead className="text-right">Pass Rate</TableHead>
                      <TableHead className="text-right">Avg Score</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.app_summary.map((app: any) => {
                      const isSelected = selectedApp === app.application_name;
                      const appRating = getScoreRating(app.avg_score);
                      return (
                        <TableRow 
                          key={app.application_name}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'}`}
                          onClick={() => setSelectedApp(isSelected ? "all" : app.application_name)}
                        >
                          <TableCell className="font-semibold text-foreground">
                            {app.application_name}
                            {isSelected && (
                              <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10" variant="outline">
                                Active Filter
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{app.total_runs}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <span className="font-semibold text-xs">{app.pass_rate.toFixed(1)}%</span>
                              <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden hidden sm:block border border-border/20">
                                <div 
                                  className={`h-full rounded-full ${app.pass_rate >= 80 ? 'bg-emerald-500' : app.pass_rate >= 60 ? 'bg-blue-500' : app.pass_rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                  style={{ width: `${app.pass_rate}%` }} 
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`font-semibold text-xs border ${appRating.color}`} variant="outline">
                              {app.avg_score.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground flex items-center justify-end gap-0.5 hover:text-foreground">
                              {isSelected ? "Clear Filter" : "Filter"}
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <HelpCircle className="h-8 w-8 mb-2 opacity-40" />
                No applications database details found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Metric performance Table */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">Metric Analysis</CardTitle>
            <CardDescription>Evaluation statistics per metric evaluator</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {stats.metric_insights && stats.metric_insights.length > 0 ? (
              <div className="space-y-4">
                {stats.metric_insights.slice(0, 5).map((metric: any) => {
                  const scoreColor = metric.avg_score >= 0.8 
                    ? 'text-emerald-500' 
                    : metric.avg_score >= 0.6 
                      ? 'text-blue-500' 
                      : metric.avg_score >= 0.4 
                        ? 'text-amber-500' 
                        : 'text-rose-500';
                  return (
                    <div 
                      key={metric.metric} 
                      className="p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/10 transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground truncate max-w-[160px]" title={metric.metric}>
                          {metric.metric.replace("Evaluator", "")}
                        </span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                          {metric.total_runs} runs
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/20">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Avg Score</p>
                          <p className={`text-sm font-bold ${scoreColor}`}>
                            {metric.avg_score.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Pass Rate</p>
                          <p className="text-sm font-bold text-foreground">
                            {metric.pass_rate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
                No metric-specific insights available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
