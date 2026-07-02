"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/context/DashboardContext";
import PageHeader from '@/components/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, TrendingUp, AlertCircle, Zap, DollarSign, Loader2 } from "lucide-react";

interface MetricSummary {
  metric_type: string;
  application_name: string;
  avg_value: number;
  max_value: number;
  min_value: number;
  data_points: number;
}

export default function SystemMetricsPage() {
  const { selectedProject } = useDashboard();
  const [summary, setSummary] = useState<MetricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1h");

  const fetchMetrics = async () => {
    if (!selectedProject) {
      setSummary([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(
        `/system-metrics/summary?project_id=${selectedProject.id}&time_range=${timeRange}`
      );
      setSummary(res.data.summary || []);
    } catch (e) {
      console.error("Failed to fetch system metrics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedProject, timeRange]);

  const getMetricsByType = (type: string) => {
    return summary.filter((m) => m.metric_type === type);
  };

  const getMetricIcon = (type: string) => {
    const icons: Record<string, any> = {
      LATENCY_P95: Activity,
      THROUGHPUT_RPS: TrendingUp,
      ERROR_RATE: AlertCircle,
      TOKEN_RATE: Zap,
      COST_RATE: DollarSign,
    };
    return icons[type] || Activity;
  };

  const getMetricLabel = (type: string) => {
    const labels: Record<string, string> = {
      LATENCY_P50: "Latency P50",
      LATENCY_P95: "Latency P95",
      LATENCY_P99: "Latency P99",
      THROUGHPUT_RPS: "Throughput (RPS)",
      ERROR_RATE: "Error Rate",
      TOKEN_RATE: "Token Rate",
      COST_RATE: "Cost Rate",
    };
    return labels[type] || type;
  };

  const getMetricUnit = (type: string) => {
    const units: Record<string, string> = {
      LATENCY_P50: "ms",
      LATENCY_P95: "ms",
      LATENCY_P99: "ms",
      THROUGHPUT_RPS: "req/s",
      ERROR_RATE: "%",
      TOKEN_RATE: "tokens/s",
      COST_RATE: "$/s",
    };
    return units[type] || "";
  };

  const formatValue = (value: number, type: string) => {
    const unit = getMetricUnit(type);
    if (type.includes("LATENCY")) {
      return `${value.toFixed(2)} ${unit}`;
    }
    if (type === "ERROR_RATE") {
      return `${value.toFixed(2)}${unit}`;
    }
    if (type === "THROUGHPUT_RPS") {
      return `${value.toFixed(2)} ${unit}`;
    }
    return `${value.toFixed(4)} ${unit}`;
  };

  const metricTypes = ["LATENCY_P95", "LATENCY_P99", "THROUGHPUT_RPS", "ERROR_RATE"];

  if (loading && selectedProject) {
    return (
      <div className="container mx-auto space-y-6">
        <PageHeader
          title="System Metrics"
          infoTooltip="Real-time system performance metrics aggregated from traces. Metrics are automatically calculated every minute."
        />
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="System Metrics"
          infoTooltip="Real-time system performance metrics aggregated from traces. Metrics are automatically calculated every minute."
        />

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15 minutes</SelectItem>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="1d">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProject ? (
        <p className="text-sm text-muted-foreground -mt-4 mb-4">
          Showing metrics for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
        </p>
      ) : (
        <div className="p-8 text-center border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">Please select a project to view metrics.</p>
        </div>
      )}

      {selectedProject && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metricTypes.map((metricType) => {
            const metrics = getMetricsByType(metricType);
            const Icon = getMetricIcon(metricType);

            return (
              <Card key={metricType}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle>{getMetricLabel(metricType)}</CardTitle>
                    </div>
                    <Badge variant="outline">{timeRange}</Badge>
                  </div>
                  <CardDescription>
                    Aggregated across all applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics.length > 0 ? (
                    <div className="space-y-4">
                      {metrics.map((metric, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{metric.application_name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {metric.data_points} data points
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Average</div>
                              <div className="font-semibold text-lg">
                                {formatValue(metric.avg_value, metricType)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Maximum</div>
                              <div className="font-semibold text-lg text-destructive">
                                {formatValue(metric.max_value, metricType)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Minimum</div>
                              <div className="font-semibold text-lg text-green-500">
                                {formatValue(metric.min_value, metricType)}
                              </div>
                            </div>
                          </div>

                          {idx < metrics.length - 1 && (
                            <div className="border-t pt-2"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No data available for this metric.</p>
                      <p className="text-xs mt-2">
                        Metrics are generated from traces automatically.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedProject && summary.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No metrics data available</p>
              <p className="text-sm mt-2">
                System metrics are automatically generated from traces.
              </p>
              <p className="text-sm mt-1">
                Start sending traces to see metrics appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
