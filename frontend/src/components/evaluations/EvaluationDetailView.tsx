"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Play, Activity, Wrench } from "lucide-react";

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

const METRIC_INPUTS_MAP: Record<string, { input: boolean; output: boolean; context: boolean; expected: boolean }> = {
  Faithfulness: { input: true, output: true, context: true, expected: false },
  FaithfulnessEvaluator: { input: true, output: true, context: true, expected: false },
  AnswerRelevancy: { input: true, output: true, context: false, expected: false },
  AnswerRelevancyEvaluator: { input: true, output: true, context: false, expected: false },
  ContextualPrecision: { input: true, output: true, context: true, expected: false },
  ContextualPrecisionEvaluator: { input: true, output: true, context: true, expected: false },
  ContextualRecall: { input: true, output: false, context: true, expected: true },
  ContextualRecallEvaluator: { input: true, output: false, context: true, expected: true },
  ContextualRelevancy: { input: true, output: false, context: true, expected: false },
  ContextualRelevancyEvaluator: { input: true, output: false, context: true, expected: false },
  Hallucination: { input: true, output: true, context: true, expected: false },
  HallucinationEvaluator: { input: true, output: true, context: true, expected: false },
  Toxicity: { input: false, output: true, context: false, expected: false },
  ToxicityEvaluator: { input: false, output: true, context: false, expected: false },
  Bias: { input: false, output: true, context: false, expected: false },
  BiasEvaluator: { input: false, output: true, context: false, expected: false },
};

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

const isAgenticMetric = (metricId: string): boolean => {
  const m = metricId.toLowerCase();
  return (
    m.includes("toolselection") ||
    m.includes("toolsequence") ||
    m.includes("agentrouting") ||
    m.includes("workflowcompletion") ||
    m.includes("hitl")
  );
};

export default function EvaluationDetailView({
  result,
  onRerun
}: EvaluationDetailViewProps) {
  if (!result) return null;

  const isAgentic = isAgenticMetric(result.metric_id);

  // Dynamic filter for active fields based on the metric map
  const activeFields = METRIC_INPUTS_MAP[result.metric_id] || METRIC_INPUTS_MAP[result.metric_id + "Evaluator"] || { input: true, output: true, context: true, expected: true };

  // Determine visibility of sections
  const showInput = isAgentic || activeFields.input;
  const showOutput = isAgentic || activeFields.output;
  const showContext = !isAgentic && activeFields.context; // Remove context from agentic evaluations
  const showExpected = !isAgentic && activeFields.expected && result.expected_output;

  const displayInputVal = result.input || "N/A";
  const displayOutputVal = result.output || "N/A";
  const workflowDetails = result.metadata_json?.workflow_details;

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
    <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
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

        {/* Metric Name */}
        <div className="border rounded-lg p-4 bg-muted/20">
            <h3 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Evaluation Metric</h3>
            <div className="font-mono text-sm font-bold text-foreground">
                {result.metric_id}
            </div>
        </div>

        {/* > Output (Evaluation Output) */}
        <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Output
            </h2>
            <div className={`p-6 rounded-lg border ${getStatusColor()} space-y-4`}>
                <div className="flex items-center justify-between">
                    <Badge variant={getBadgeVariant()} className="text-md px-3 py-1 font-semibold">
                        {getBadgeLabel()}
                    </Badge>
                    <span className="text-4xl font-bold font-mono text-foreground">
                        {result.score !== null ? result.score.toFixed(3) : "-"}
                    </span>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Feedback & Reason</h4>
                    <p className="text-md text-foreground/90 italic leading-relaxed">
                        {result.reason || (result.status === "RUNNING" ? "Evaluation in progress..." : "No reason provided.")}
                    </p>
                </div>
            </div>
        </div>

        {/* > Input (Inputs given to the metric) */}
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">
                Input
            </h2>
            <div className="grid gap-6 md:grid-cols-2 border rounded-lg p-6 bg-muted/5">
                {/* Node / Agent / LLM / Tool Input */}
                {showInput && (
                    <div className="col-span-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Node / Agent / LLM / Tool Input</h4>
                        <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                            {parseCleanParam(displayInputVal, 'input')}
                        </pre>
                    </div>
                )}

                {/* Node / Agent / LLM / Tool Output */}
                {showOutput && (
                    <div className="col-span-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Node / Agent / LLM / Tool Output</h4>
                        <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                            {parseCleanParam(displayOutputVal, 'output')}
                        </pre>
                    </div>
                )}

                {/* Node / Agent / LLM / Tool Context */}
                {showContext && (
                    <div className="col-span-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Node / Agent / LLM / Tool Context</h4>
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
                )}

                {/* Node / Agent / LLM / Tool Ground Truth */}
                {showExpected && (
                    <div className="col-span-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Node / Agent / LLM / Tool Ground Truth</h4>
                        <pre className="p-4 rounded-md bg-muted/50 border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                            {result.expected_output}
                        </pre>
                    </div>
                )}

                {/* Workflow Details */}
                {workflowDetails && (
                    <div className="col-span-2 space-y-4 pt-6 border-t border-dashed">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Workflow Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {workflowDetails.agents && workflowDetails.agents.length > 0 && (
                                <div className="space-y-3">
                                    <span className="text-xs font-semibold text-muted-foreground block flex items-center gap-1.5">
                                        <Activity className="h-3.5 w-3.5 text-primary" />
                                        Evaluated Agents
                                    </span>
                                    <div className="space-y-2">
                                        {workflowDetails.agents.map((agent: string) => {
                                            const parts = agent.split(":");
                                            const name = parts[0].trim();
                                            const desc = parts.slice(1).join(":").trim();
                                            return (
                                                <div key={agent} className="p-3 rounded-lg border bg-background/50 flex flex-col gap-1 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 hover:bg-primary/5 font-mono text-[11px]">
                                                            {name}
                                                        </Badge>
                                                    </div>
                                                    {desc && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                                                            {desc}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {workflowDetails.tools && workflowDetails.tools.length > 0 && (
                                <div className="space-y-3">
                                    <span className="text-xs font-semibold text-muted-foreground block flex items-center gap-1.5">
                                        <Wrench className="h-3.5 w-3.5 text-secondary" />
                                        Evaluated Tools
                                    </span>
                                    <div className="space-y-2">
                                        {workflowDetails.tools.map((tool: string) => {
                                            const parts = tool.split(":");
                                            const name = parts[0].trim();
                                            const desc = parts.slice(1).join(":").trim();
                                            return (
                                                <div key={tool} className="p-3 rounded-lg border bg-background/50 flex flex-col gap-1 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="border-secondary/30 text-secondary bg-secondary/5 hover:bg-secondary/5 font-mono text-[11px]">
                                                            {name}
                                                        </Badge>
                                                    </div>
                                                    {desc && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                                                            {desc}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
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
