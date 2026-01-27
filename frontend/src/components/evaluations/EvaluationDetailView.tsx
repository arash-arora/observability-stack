"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Play, Activity } from "lucide-react";

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

interface EvaluationDetailViewProps {
  result: EvaluationResult;
  onRerun: () => void;
}

export default function EvaluationDetailView({
  result,
  onRerun
}: EvaluationDetailViewProps) {
  if (!result) return null;

  const getStatusColor = () => {
       if (result.status === "RUNNING") return "bg-yellow-500/10 border-yellow-500/20";
       if (result.passed === true) return "bg-green-500/10 border-green-500/20";
       if (result.passed === false) return "bg-red-500/10 border-red-500/20";
       return "bg-stone-500/10 border-stone-500/20";
  };
  
  const getBadgeVariant = () => {
      if (result.passed === true) return "default";
      if (result.passed === false) return "destructive";
      return "secondary";
  };

  const getBadgeLabel = () => {
      if (result.status === "RUNNING") return "RUNNING";
      if (result.passed === true) return "PASSED";
      if (result.passed === false) return "FAILED";
      return result.status || "UNKNOWN";
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Evaluation Details</h2>
                <p className="text-muted-foreground flex items-center gap-2">
                    {format(new Date(result.created_at), "PPpp")}
                    {result.metadata_json?.agent_name && (
                        <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="inline-flex items-center gap-1 text-primary/80 font-medium">
                                <Activity className="h-3.5 w-3.5" />
                                {result.metadata_json.agent_name}
                            </span>
                        </>
                    )}
                </p>
            </div>
            <Button onClick={onRerun}>
                <Play className="mr-2 h-4 w-4" /> Rerun Evaluation
            </Button>
        </div>

        {/* Status Card */}
        <div className={`p-6 rounded-lg border ${getStatusColor()}`}>
            <div className="flex items-center justify-between mb-4">
                <Badge variant={getBadgeVariant()} className={`text-md px-3 py-1`}>
                    {getBadgeLabel()}
                </Badge>
                <span className="text-4xl font-bold font-mono">
                    {result.score !== null ? result.score.toFixed(3) : "-"}
                </span>
            </div>
            <p className="text-lg text-foreground/90 italic">
                {result.reason || (result.status === "RUNNING" ? "Evaluation in progress..." : "No reason provided.")}
            </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
            {/* Metric Info */}
            <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Metric</h3>
                <div className="p-4 rounded-md bg-muted/50 border font-mono text-sm">
                    {result.metric_id}
                </div>
            </div>

            {/* Input */}
            <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Input</h3>
                <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                    {result.input || "N/A"}
                </pre>
            </div>

            {/* Output */}
            <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Output</h3>
                <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                    {result.output || "N/A"}
                </pre>
            </div>

            {/* Context */}
             <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Context</h3>
                <div className="space-y-2">
                    {result.context && result.context.length > 0 ? (
                        result.context.map((ctx, i) => (
                             <pre key={i} className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap">
                                {ctx}
                             </pre>
                        ))
                    ) : (
                        <div className="text-sm text-muted-foreground">No context provided.</div>
                    )}
                </div>
            </div>

             {/* Expected */}
             {result.expected_output && (
                <div className="col-span-2">
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Expected Output</h3>
                    <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                        {result.expected_output}
                    </pre>
                </div>
             )}
        </div>
    </div>
  );
}
