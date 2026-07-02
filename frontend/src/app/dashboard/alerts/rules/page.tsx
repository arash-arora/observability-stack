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
import { Plus, Trash2, Edit, Power, PowerOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlertRuleModal from "@/components/alerts/AlertRuleModal";
import { useDashboard } from "@/context/DashboardContext";

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  application_id?: string;
  metric_source: string;
  metric_filter: any;
  threshold_type: string;
  threshold_config: any;
  condition: string;
  severity: string;
  aggregation_window: string;
  aggregation_function: string;
  notification_config: any;
  active: boolean;
  created_at: string;
}

export default function AlertRulesPage() {
  const { selectedProject, selectedOrg } = useDashboard();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Check permissions
  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  const fetchRules = async () => {
    if (!selectedProject) {
      setRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/alert-rules/?project_id=${selectedProject.id}`);
      setRules(res.data);
    } catch (e) {
      console.error("Failed to fetch alert rules", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [selectedProject]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await api.delete(`/alert-rules/${id}`);
      fetchRules();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleToggleActive = async (rule: AlertRule) => {
    try {
      await api.put(`/alert-rules/${rule.id}`, {
        ...rule,
        active: !rule.active,
      });
      fetchRules();
    } catch (e) {
      console.error("Failed to toggle active status", e);
    }
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSaved = () => {
    fetchRules();
    handleModalClose();
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

  const getMetricSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      SYSTEM_PERFORMANCE: "System Performance",
      DATA_DRIFT: "Data Drift",
      MODEL_QUALITY: "Model Quality",
      USER_LOGGED: "User Evaluations",
    };
    return labels[source] || source;
  };

  if (loading && selectedProject) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {selectedProject ? (
          <p className="text-sm text-muted-foreground">
            Showing alert rules for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
          </p>
        ) : (
          <div />
        )}
        {canCreate && selectedProject && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Alert Rule
          </Button>
        )}
      </div>

      {!selectedProject && (
        <div className="p-8 text-center border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">Please select a project to view alert rules.</p>
        </div>
      )}

      {selectedProject && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{rule.name}</div>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {rule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getMetricSourceLabel(rule.metric_source)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1">
                      <span>{rule.aggregation_function}({rule.aggregation_window})</span>
                      <span className="text-muted-foreground">
                        {rule.condition.replace("_", " ")} {rule.threshold_config.value}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityColor(rule.severity) as any}>
                      {rule.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(rule)}
                      className="h-auto p-0"
                    >
                      {rule.active ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          <Power className="mr-1 h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <PowerOff className="mr-1 h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(rule.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No alert rules found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedProject && (
        <AlertRuleModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          projectId={selectedProject.id}
          onSaved={handleSaved}
          editingRule={editingRule}
        />
      )}
    </div>
  );
}
