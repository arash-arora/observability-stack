"use client";

import { useState } from "react";
interface EvaluationResult {
  id: string;
  created_at: string;
  metric_id: string;
  input: string;
  output: string;
  context: string[];
  expected_output: string;
  score: number | null;
  passed: boolean | null;
  reason: string;
  trace_id?: string;
  status?: string;
  metadata_json?: any;
}
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
import { ChevronRight, ChevronDown, Activity, Play } from "lucide-react";
import EvaluationDetailView from "./EvaluationDetailView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EvaluationGroupViewProps {
  results: any[];
  traceDetails?: {
    spans: any[];
    observations: any[];
  };
  onRerun: (result: any) => void;
}

export default function EvaluationGroupView({ results, traceDetails, onRerun }: EvaluationGroupViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(results.length > 0 ? results[0].id : null);

  const selectedResult = results.find(r => r.id === selectedId);

  // Calculate Group Stats
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const passRate = total > 0 ? (passed / total) * 100 : 0;
  const avgScore = total > 0 
    ? results.reduce((acc, r) => acc + (r.score || 0), 0) / total 
    : 0;

  // Extract Agents Info from Trace
  const agentsSpans = traceDetails?.spans.filter((s: any) => s.attributes?.["as_agent"] === true || s.attributes?.["agenloom.as_agent"] === true) || [];
  const agentsObs = traceDetails?.observations.filter((o: any) => o.type === 'agent') || [];
  const toolsInfo = traceDetails?.observations.filter((o: any) => o.type === 'tool') || [];

  const uniqueAgents = Array.from(new Set([
    ...agentsSpans.map((a: any) => a.name),
    ...agentsObs.map((a: any) => a.name)
  ]));
  const uniqueTools = Array.from(new Set(toolsInfo.map((t: any) => t.name)));
  const uniqueModels = Array.from(new Set(traceDetails?.observations.filter((o: any) => o.model).map((o: any) => o.model)));

  return (
    <div className="space-y-6">
      {/* Group Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium">Total Agents/Steps</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{total}</div>
           </CardContent>
        </Card>
        <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
           </CardHeader>
           <CardContent>
             <div className={`text-2xl font-bold ${passRate === 100 ? "text-green-600" : passRate < 50 ? "text-red-600" : "text-yellow-600"}`}>
                {passRate.toFixed(0)}%
             </div>
           </CardContent>
        </Card>
        <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium">Average Score</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{avgScore.toFixed(2)}</div>
           </CardContent>
        </Card>
      </div>
      
      {/* Trace Context Section */}
      {traceDetails && (
          <Card className="bg-muted/5 border-dashed">
              <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Trace Execution Context
                  </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                  <div className="flex flex-wrap gap-8 text-sm">
                      {uniqueAgents.length > 0 && (
                          <div className="space-y-1">
                              <span className="text-muted-foreground block text-xs uppercase tracking-wider font-medium">Agents Involved</span>
                              <div className="flex flex-wrap gap-1.5">
                                  {uniqueAgents.map(a => (
                                      <Badge key={a} variant="outline" className="bg-background">{a}</Badge>
                                  ))}
                              </div>
                          </div>
                      )}
                      {uniqueTools.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-muted-foreground block text-xs uppercase tracking-wider font-medium">Tools Used</span>
                            <div className="flex flex-wrap gap-1.5">
                                {uniqueTools.map(t => (
                                    <Badge key={t} variant="secondary" className="px-2">{t}</Badge>
                                ))}
                            </div>
                        </div>
                      )}
                      {uniqueModels.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-muted-foreground block text-xs uppercase tracking-wider font-medium">Models</span>
                            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                                {uniqueModels.join(", ")}
                            </div>
                        </div>
                      )}
                  </div>
              </CardContent>
          </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar List */}
        <div className="col-span-12 md:col-span-4 border rounded-md h-fit">
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-semibold">Evaluations</h3>
          </div>
          <div className="divide-y">
            {results.map((r) => (
              <div 
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === r.id ? "bg-muted border-l-4 border-l-primary" : "border-l-4 border-l-transparent"}`}
              >
                <div className="flex flex-col gap-1 mb-1">
                    <div className="flex justify-between items-start">
                        <span className="font-semibold text-sm truncate pr-2" title={r.metric_id}>
                            {r.metric_id.replace("Evaluator", "")}
                        </span>
                        <Badge variant={r.passed ? "default" : r.status === "RUNNING" ? "secondary" : "destructive"} className="text-[10px] px-1.5 h-5">
                            {r.status === "RUNNING" ? "RUNNING" : r.passed ? "PASSED" : "FAILED"}
                        </Badge>
                    </div>
                    {r.metadata_json?.agent_name && (
                         <div className="flex items-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal text-muted-foreground bg-muted/50 border-muted-foreground/20 gap-1">
                                <Activity className="h-3 w-3" />
                                {r.metadata_json.agent_name}
                            </Badge>
                         </div>
                    )}
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Score: {r.score !== null ? r.score.toFixed(2) : "-"}</span>
                    <span>{new Date(r.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Detail View */}
        <div className="col-span-12 md:col-span-8">
            {selectedResult ? (
                <div className="border rounded-md p-6">
                    <EvaluationDetailView 
                        result={selectedResult} 
                        onRerun={() => onRerun(selectedResult)} 
                    />
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center border rounded-md text-muted-foreground border-dashed">
                    Select an evaluation to view details
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
