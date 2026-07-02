"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AlertRule {
  id?: string;
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
}

interface AlertRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: () => void;
  editingRule?: AlertRule | null;
}

export default function AlertRuleModal({
  isOpen,
  onClose,
  projectId,
  onSaved,
  editingRule,
}: AlertRuleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metricSource, setMetricSource] = useState("SYSTEM_PERFORMANCE");
  const [metricType, setMetricType] = useState("LATENCY_P95");
  const [condition, setCondition] = useState("GREATER_THAN");
  const [thresholdValue, setThresholdValue] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [aggregationWindow, setAggregationWindow] = useState("5m");
  const [aggregationFunction, setAggregationFunction] = useState("AVG");
  const [cooldownMinutes, setCooldownMinutes] = useState("15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setMetricSource(editingRule.metric_source);
      setMetricType(editingRule.metric_filter.metric_type || "LATENCY_P95");
      setCondition(editingRule.condition);
      setThresholdValue(editingRule.threshold_config.value?.toString() || "");
      setSeverity(editingRule.severity);
      setAggregationWindow(editingRule.aggregation_window);
      setAggregationFunction(editingRule.aggregation_function);
      setCooldownMinutes(editingRule.notification_config.cooldown_minutes?.toString() || "15");
    } else {
      // Reset form
      setName("");
      setDescription("");
      setMetricSource("SYSTEM_PERFORMANCE");
      setMetricType("LATENCY_P95");
      setCondition("GREATER_THAN");
      setThresholdValue("");
      setSeverity("MEDIUM");
      setAggregationWindow("5m");
      setAggregationFunction("AVG");
      setCooldownMinutes("15");
    }
    setError("");
  }, [editingRule, isOpen]);

  const handleSubmit = async () => {
    if (!name || !thresholdValue) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);
    setError("");

    const payload: AlertRule = {
      name,
      description: description || undefined,
      project_id: projectId,
      metric_source: metricSource,
      metric_filter: {
        metric_type: metricType,
      },
      threshold_type: "STATIC",
      threshold_config: {
        value: parseFloat(thresholdValue),
      },
      condition,
      severity,
      aggregation_window: aggregationWindow,
      aggregation_function: aggregationFunction,
      notification_config: {
        channels: [],
        cooldown_minutes: parseInt(cooldownMinutes),
      },
      active: true,
    };

    try {
      if (editingRule) {
        await api.put(`/alert-rules/${editingRule.id}`, { ...payload, id: editingRule.id });
      } else {
        await api.post("/alert-rules/", payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save alert rule");
    } finally {
      setLoading(false);
    }
  };

  const metricTypesBySource: Record<string, { value: string; label: string }[]> = {
    SYSTEM_PERFORMANCE: [
      { value: "LATENCY_P50", label: "Latency P50" },
      { value: "LATENCY_P95", label: "Latency P95" },
      { value: "LATENCY_P99", label: "Latency P99" },
      { value: "THROUGHPUT_RPS", label: "Throughput (RPS)" },
      { value: "ERROR_RATE", label: "Error Rate (%)" },
      { value: "TOKEN_RATE", label: "Token Rate" },
      { value: "COST_RATE", label: "Cost Rate" },
    ],
  };

  const metricTypes = metricTypesBySource[metricSource] || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRule ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
          <DialogDescription>
            Configure an automated alert based on metrics and thresholds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              placeholder="High Latency Alert"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Alert when latency exceeds threshold..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metric-source">Metric Source *</Label>
              <Select value={metricSource} onValueChange={setMetricSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM_PERFORMANCE">System Performance</SelectItem>
                  <SelectItem value="DATA_DRIFT">Data Drift</SelectItem>
                  <SelectItem value="MODEL_QUALITY">Model Quality</SelectItem>
                  <SelectItem value="USER_LOGGED">User Evaluations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {metricSource === "SYSTEM_PERFORMANCE" && (
              <div className="space-y-2">
                <Label htmlFor="metric-type">Metric Type *</Label>
                <Select value={metricType} onValueChange={setMetricType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metricTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aggregation-function">Aggregation Function *</Label>
              <Select value={aggregationFunction} onValueChange={setAggregationFunction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVG">Average</SelectItem>
                  <SelectItem value="MAX">Maximum</SelectItem>
                  <SelectItem value="MIN">Minimum</SelectItem>
                  <SelectItem value="P95">P95</SelectItem>
                  <SelectItem value="COUNT">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aggregation-window">Time Window *</Label>
              <Select value={aggregationWindow} onValueChange={setAggregationWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 minute</SelectItem>
                  <SelectItem value="5m">5 minutes</SelectItem>
                  <SelectItem value="15m">15 minutes</SelectItem>
                  <SelectItem value="30m">30 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="1d">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition">Condition *</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GREATER_THAN">Greater Than</SelectItem>
                  <SelectItem value="LESS_THAN">Less Than</SelectItem>
                  <SelectItem value="EQUALS">Equals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold Value *</Label>
              <Input
                id="threshold"
                type="number"
                placeholder="1000"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity *</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                placeholder="15"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : editingRule ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
