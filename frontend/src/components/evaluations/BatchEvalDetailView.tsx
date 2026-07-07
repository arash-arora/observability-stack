"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Minus } from "lucide-react";

interface EvalResult {
  id: string;
  trace_id?: string;
  metric_id: string;
  score: number | null;
  passed: boolean | null;
  reason?: string;
  status?: string;
  input?: string;
  output?: string;
}

interface BatchEvalDetailViewProps {
  results: EvalResult[];
  batchTitle?: string;
}

export default function BatchEvalDetailView({ results, batchTitle }: BatchEvalDetailViewProps) {
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  // Group results by trace_id
  const grouped = useMemo(() => {
    const map = new Map<string, EvalResult[]>();
    for (const r of results) {
      const key = r.trace_id || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [results]);

  const allMetrics = useMemo(() => {
    const s = new Set<string>();
    results.forEach((r) => s.add(r.metric_id));
    return Array.from(s);
  }, [results]);

  // Aggregate stats
  const total = results.length;
  const passed = results.filter((r) => r.passed === true).length;
  const failed = results.filter((r) => r.passed === false).length;
  const avgScore =
    total > 0
      ? results.reduce((acc, r) => acc + (r.score ?? 0), 0) / results.filter((r) => r.score !== null).length
      : 0;
  const traceCount = grouped.size;

  const toggleTrace = (traceId: string) => {
    setExpandedTraces((prev) => {
      const next = new Set(prev);
      if (next.has(traceId)) next.delete(traceId);
      else next.add(traceId);
      return next;
    });
  };

  const passIcon = (val: boolean | null, status?: string) => {
    if (status === "RUNNING") return <Minus className="h-4 w-4 text-yellow-500 animate-pulse" />;
    if (val === true) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (val === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Traces Evaluated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{traceCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {total > 0 ? Math.round((passed / total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {passed} passed / {failed} failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isNaN(avgScore) ? "-" : avgScore.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-trace breakdown */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Trace ID</TableHead>
              {allMetrics.map((m) => (
                <TableHead key={m} className="text-xs">{m}</TableHead>
              ))}
              <TableHead>Avg Score</TableHead>
              <TableHead>Pass</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(grouped.entries()).map(([traceId, traceResults]) => {
              const isExpanded = expandedTraces.has(traceId);
              const traceAvg =
                traceResults.length > 0
                  ? traceResults.reduce((a, r) => a + (r.score ?? 0), 0) /
                    traceResults.filter((r) => r.score !== null).length
                  : null;
              const tracePass = traceResults.every((r) => r.passed !== false);
              const metricMap = new Map(traceResults.map((r) => [r.metric_id, r]));

              return [
                <TableRow
                  key={traceId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleTrace(traceId)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" title={traceId}>
                    {traceId.substring(0, 16)}...
                  </TableCell>
                  {allMetrics.map((m) => {
                    const r = metricMap.get(m);
                    if (!r) return <TableCell key={m}><Minus className="h-4 w-4 text-muted-foreground" /></TableCell>;
                    return (
                      <TableCell key={m}>
                        <div className="flex items-center gap-1">
                          {passIcon(r.passed, r.status)}
                          <span className="text-xs font-mono">
                            {r.score !== null ? r.score.toFixed(2) : "-"}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="font-mono text-sm font-bold">
                    {traceAvg !== null && !isNaN(traceAvg) ? traceAvg.toFixed(2) : "-"}
                  </TableCell>
                  <TableCell>
                    {tracePass ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">PASSED</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">ISSUES</Badge>
                    )}
                  </TableCell>
                </TableRow>,

                // Expanded detail rows
                isExpanded && (
                  <TableRow key={`${traceId}-detail`} className="bg-muted/30">
                    <TableCell colSpan={allMetrics.length + 4} className="p-0">
                      <div className="px-6 py-4 space-y-3">
                        {/* Input/Output preview */}
                        {traceResults[0]?.input && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Input</p>
                            <p className="text-xs bg-background rounded border px-2 py-1 line-clamp-2">
                              {traceResults[0].input}
                            </p>
                          </div>
                        )}
                        {traceResults[0]?.output && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Output</p>
                            <p className="text-xs bg-background rounded border px-2 py-1 line-clamp-3">
                              {traceResults[0].output}
                            </p>
                          </div>
                        )}
                        {/* Per-metric reasons */}
                        <div className="space-y-2">
                          {traceResults.map((r) => (
                            <div key={r.id} className="flex gap-3 text-xs">
                              <span className="font-semibold w-40 shrink-0">{r.metric_id}</span>
                              <span className="text-muted-foreground">{r.reason || "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              ];
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
