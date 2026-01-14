"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

interface EvaluationDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  result: EvaluationResult;
  onRerun: () => void;
}

export default function EvaluationDetailSheet({
  isOpen,
  onClose,
  result,
  onRerun
}: EvaluationDetailSheetProps) {
  if (!result) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle>Evaluation Details</SheetTitle>
            <Button size="sm" onClick={onRerun}>
                <Play className="mr-2 h-4 w-4" /> Rerun
            </Button>
          </div>
          <SheetDescription>
            {format(new Date(result.created_at), "PPpp")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
            {/* Status Card */}
            <div className={`p-4 rounded-lg border ${result.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                    <Badge variant={result.passed ? "default" : "destructive"} className={result.passed ? "bg-green-500" : ""}>
                        {result.passed ? "PASSED" : "FAILED"}
                    </Badge>
                    <span className="text-2xl font-bold font-mono">{result.score.toFixed(3)}</span>
                </div>
                <p className="text-sm text-foreground/90 italic">
                    {result.reason}
                </p>
            </div>

            {/* Metric Info */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Metric</h3>
                <div className="p-3 rounded bg-muted/50 border font-mono text-sm">
                    {result.metric_id}
                </div>
            </div>

            {/* Input */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Input</h3>
                <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {result.input || "N/A"}
                </pre>
            </div>

            {/* Output */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Output</h3>
                <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {result.output || "N/A"}
                </pre>
            </div>

             {/* Cleanup Context Display */}
             <div>
                <h3 className="text-sm font-semibold mb-2">Context</h3>
                <div className="space-y-2">
                    {result.context && result.context.length > 0 ? (
                        result.context.map((ctx, i) => (
                             <pre key={i} className="p-2 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap">
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
                <div>
                    <h3 className="text-sm font-semibold mb-2">Expected Output</h3>
                    <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                        {result.expected_output}
                    </pre>
                </div>
             )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
