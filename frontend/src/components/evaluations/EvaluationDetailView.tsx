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

function parseCleanParam(val: string, paramType: 'input' | 'output'): string {
  if (!val) return "N/A";
  
  const valTrimmed = val.trim();
  if (!valTrimmed.startsWith("{") && !valTrimmed.startsWith("[")) {
    return val;
  }
  
  let data: any;
  try {
    data = JSON.parse(valTrimmed);
  } catch {
    try {
      const jsonStr = valTrimmed
        .replace(/'/g, '"')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null');
      data = JSON.parse(jsonStr);
    } catch {
      return val;
    }
  }

  const extractFromMessages = (msgs: any[]): string => {
    if (!Array.isArray(msgs)) return "";
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (typeof m !== 'object' || m === null) continue;
      const role = String(m.role || m.type || "").toLowerCase();
      const content = m.content || m.text || m.message;
      if (content) {
        if (paramType === 'input' && (role.includes("user") || role.includes("human"))) {
          return String(content);
        } else if (paramType === 'output' && (role.includes("ai") || role.includes("assistant") || role.includes("model") || role.includes("output"))) {
          return String(content);
        }
      }
    }
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (typeof m === 'object' && m !== null) {
        const content = m.content || m.text || m.message;
        if (content) return String(content);
      }
    }
    return "";
  };

  let extracted = val;

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      const res = extractFromMessages(data);
      if (res) extracted = res;
    } else {
      let found = false;
      const keys = paramType === 'input' ? ["input", "query", "question", "prompt"] : ["output", "response", "completion", "result", "text"];
      for (const k of keys) {
        if (data[k]) {
          if (typeof data[k] === 'string') {
            extracted = data[k];
            found = true;
            break;
          }
          if (Array.isArray(data[k])) {
            const res = extractFromMessages(data[k]);
            if (res) {
              extracted = res;
              found = true;
              break;
            }
          }
        }
      }

      if (!found && Array.isArray(data.messages)) {
        const res = extractFromMessages(data.messages);
        if (res) {
          extracted = res;
          found = true;
        }
      }

      if (!found && Array.isArray(data.args) && data.args.length > 0) {
        const firstArg = data.args[0];
        if (typeof firstArg === 'string') {
          extracted = firstArg;
          found = true;
        } else if (Array.isArray(firstArg)) {
          const res = extractFromMessages(firstArg);
          if (res) {
            extracted = res;
            found = true;
          }
        }
        if (!found) {
          for (const arg of data.args) {
            if (Array.isArray(arg)) {
               const res = extractFromMessages(arg);
               if (res) {
                 extracted = res;
                 found = true;
                 break;
               }
            }
          }
        }
      }

      if (!found && data.kwargs && typeof data.kwargs === 'object') {
        const kwargs = data.kwargs;
        for (const k of keys) {
          if (kwargs[k]) {
            if (typeof kwargs[k] === 'string') {
              extracted = kwargs[k];
              found = true;
              break;
            }
            if (Array.isArray(kwargs[k])) {
              const res = extractFromMessages(kwargs[k]);
              if (res) {
                extracted = res;
                found = true;
                break;
              }
            }
          }
        }
        if (!found && Array.isArray(kwargs.messages)) {
          const res = extractFromMessages(kwargs.messages);
          if (res) {
            extracted = res;
            found = true;
          }
        }
      }

      if (!found && paramType === 'output' && Array.isArray(data.choices) && data.choices.length > 0) {
        const firstChoice = data.choices[0];
        if (firstChoice && typeof firstChoice === 'object') {
          const msg = firstChoice.message;
          if (msg && typeof msg === 'object' && msg.content) {
            extracted = String(msg.content);
            found = true;
          }
        }
      }
      
      if (!found && data.content && typeof data.content === 'string') {
        extracted = data.content;
      }
    }
  }

  if (extracted && typeof extracted === 'string') {
     const trimmed = extracted.trim();
     if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
           const nested = JSON.parse(trimmed);
           if (nested && typeof nested === 'object') {
              if (nested.reason && typeof nested.reason === 'string') {
                 return nested.reason;
              }
              if (nested.output && typeof nested.output === 'string') {
                 return nested.output;
              }
              if (nested.response && typeof nested.response === 'string') {
                 return nested.response;
              }
           }
        } catch {}
     }
  }

  return extracted;
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
                    {parseCleanParam(result.input, 'input')}
                </pre>
            </div>

            {/* Output */}
            <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Output</h3>
                <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                    {parseCleanParam(result.output, 'output')}
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

        {/* Evaluator Execution Details */}
        {(result.metadata_json?.evaluator_input || result.metadata_json?.evaluator_output) && (
            <div className="mt-8 pt-8 border-t">
                <h2 className="text-xl font-bold tracking-tight mb-4">Evaluator Execution</h2>
                <div className="grid gap-6 md:grid-cols-2">
                    {result.metadata_json?.evaluator_input && (
                         <div className="col-span-2">
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Evaluator Input (Prompt)</h3>
                            <pre className="p-4 rounded-md bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto">
                                {result.metadata_json.evaluator_input}
                            </pre>
                        </div>
                    )}
                    {result.metadata_json?.evaluator_output && (
                         <div className="col-span-2">
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Evaluator Output (Raw)</h3>
                            <pre className="p-4 rounded-md bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto">
                                {result.metadata_json.evaluator_output}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
