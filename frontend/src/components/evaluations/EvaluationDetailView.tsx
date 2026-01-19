"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Play } from "lucide-react";

interface EvaluationResult {
  id: string;
  created_at: string;
  metric_id: string;
  input: string;
  output: string;
  context: string[];
  expected_output: string;
  score: number;
  passed: boolean;
  reason: string;
  trace_id?: string;
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

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Evaluation Details</h2>
                <p className="text-muted-foreground">
                    {format(new Date(result.created_at), "PPpp")}
                </p>
            </div>
            <Button onClick={onRerun}>
                <Play className="mr-2 h-4 w-4" /> Rerun Evaluation
            </Button>
        </div>

        {/* Status Card */}
        <div className={`p-6 rounded-lg border ${result.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-4">
                <Badge variant={result.passed ? "default" : "destructive"} className={`text-md px-3 py-1 ${result.passed ? "bg-green-500 hover:bg-green-600" : ""}`}>
                    {result.passed ? "PASSED" : "FAILED"}
                </Badge>
                <span className="text-4xl font-bold font-mono">{result.score.toFixed(3)}</span>
            </div>
            <p className="text-lg text-foreground/90 italic">
                {result.reason}
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
