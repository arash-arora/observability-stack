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
import { Check, X, BellOff, AlertTriangle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useDashboard } from "@/context/DashboardContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Alert {
  id: string;
  alert_rule_id: string;
  state: string;
  severity: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  application_name: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  fingerprint: string;
  occurrence_count: number;
  last_occurrence: string;
}

export default function ActiveAlertsPage() {
  const { selectedProject } = useDashboard();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const fetchAlerts = async () => {
    if (!selectedProject) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let url = `/alerts/?project_id=${selectedProject.id}&limit=100`;
      if (stateFilter !== "all") {
        url += `&state=${stateFilter}`;
      }
      if (severityFilter !== "all") {
        url += `&severity=${severityFilter}`;
      }

      const res = await api.get(url);
      setAlerts(res.data);
    } catch (e) {
      console.error("Failed to fetch alerts", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedProject, stateFilter, severityFilter]);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      fetchAlerts();
    } catch (e) {
      console.error("Failed to acknowledge alert", e);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/resolve`, null, {
        params: {
          resolved_by: "user",
          resolution_note: "Manually resolved",
        },
      });
      fetchAlerts();
    } catch (e) {
      console.error("Failed to resolve alert", e);
    }
  };

  const handleMute = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/mute`);
      fetchAlerts();
    } catch (e) {
      console.error("Failed to mute alert", e);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "destructive",
      HIGH: "destructive",
      MEDIUM: "default",
      LOW: "secondary",
      INFO: "outline",
    };
    return colors[severity] || "default";
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      TRIGGERED: "destructive",
      ACKNOWLEDGED: "default",
      RESOLVED: "secondary",
      MUTED: "outline",
    };
    return colors[state] || "default";
  };

  const getStateIcon = (state: string) => {
    const icons: Record<string, any> = {
      TRIGGERED: AlertTriangle,
      ACKNOWLEDGED: Check,
      RESOLVED: Check,
      MUTED: BellOff,
    };
    const Icon = icons[state] || AlertTriangle;
    return <Icon className="h-4 w-4 mr-1" />;
  };

  if (loading && selectedProject) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {selectedProject ? (
        <p className="text-sm text-muted-foreground">
          Showing alerts for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
        </p>
      ) : (
        <div className="p-8 text-center border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">Please select a project to view alerts.</p>
        </div>
      )}

      {selectedProject && (
        <>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Label className="text-sm font-medium mb-2">Filter by State</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="TRIGGERED">Triggered</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="MUTED">Muted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-sm font-medium mb-2">Filter by Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1"></div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value / Threshold</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">{alert.application_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.metric_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-semibold text-destructive">
                          {alert.metric_value.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">
                          Threshold: {alert.threshold.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStateColor(alert.state) as any} className="flex items-center w-fit">
                        {getStateIcon(alert.state)}
                        {alert.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(alert.triggered_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{alert.occurrence_count}x</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {alert.state === "TRIGGERED" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              title="Acknowledge"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMute(alert.id)}
                              title="Mute"
                            >
                              <BellOff className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(alert.state === "TRIGGERED" || alert.state === "ACKNOWLEDGED") && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            title="Resolve"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && alerts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No alerts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
