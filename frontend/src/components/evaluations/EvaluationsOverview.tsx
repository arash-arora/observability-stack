"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { EvaluationsCharts } from "./EvaluationsCharts";
import { Loader2, Activity, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EvaluationsOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/analytics/evaluation-stats");
        setStats(res.data);
      } catch (e) {
        console.error("Failed to fetch evaluation stats", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
      return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground"/></div>;
  }

  if (!stats) return <div className="p-4 text-muted-foreground">No evaluation data available.</div>;

  // Calculate derived stats
  const total = stats.pass_fail ? stats.pass_fail.reduce((acc: number, curr: any) => acc + curr.value, 0) : 0;
  const passed = stats.pass_fail ? (stats.pass_fail.find((p: any) => p.name === 'Passed')?.value || 0) : 0;
  const passRate = total > 0 ? (passed / total * 100) : 0;
  const avgScore = stats.avg_scores?.length > 0 
    ? stats.avg_scores.reduce((acc: number, curr: any) => acc + curr.score, 0) / stats.avg_scores.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

       <EvaluationsCharts data={stats} />
    </div>
  );
}

