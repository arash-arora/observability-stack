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
import { Play, Activity, Wrench } from "lucide-react";
import Link from "next/link";

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


function parseCleanParam(val: string, paramType: 'input' | 'output'): string {
  if (!val) return 'N/A';

  const valTrimmed = val.trim();
  if (!valTrimmed.startsWith('{') && !valTrimmed.startsWith('[')) {
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
    if (!Array.isArray(msgs)) return '';
    const allStrings = msgs.every(m => typeof m === 'string');
    if (allStrings && msgs.length > 0) {
      return msgs.join('\n\n').trim();
    }
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (typeof m !== 'object' || m === null) continue;
      const role = String(m.role || m.type || '').toLowerCase();
      const content = m.content || m.text || m.message;
      if (content) {
        if (paramType === 'input' && (role.includes('user') || role.includes('human'))) {
          return String(content);
        } else if (paramType === 'output' && (role.includes('ai') || role.includes('assistant') || role.includes('model') || role.includes('output'))) {
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
    return '';
  };

  let extracted = val;

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      const res = extractFromMessages(data);
      if (res) extracted = res;
    } else {
      let found = false;
      const keys = paramType === 'input' ? ['input', 'query', 'question', 'prompt'] : ['output', 'response', 'completion', 'result', 'text'];
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
        if (!found) {
          const stringArgs = data.args.filter((a: any) => typeof a === 'string' && a.trim().length > 0);
          if (stringArgs.length > 0) {
            extracted = stringArgs.join("\n\n");
            found = true;
          }
        }
        if (!found && typeof data.args[0] === 'string') {
          extracted = data.args[0];
          found = true;
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
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
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
      } catch { }
    }
  }

  return extracted;
}


const isAgenticMetric = (metricId: string): boolean => {
  const m = metricId.toLowerCase();
  return (
    m.includes("toolselection") ||
    m.includes("toolsequence") ||
    m.includes("agentrouting") ||
    m.includes("workflowcompletion") ||
    m.includes("hitl") ||
    m.includes("toolinputstructure")
  );
};

export default function EvaluationDetailSheet({
  isOpen,
  onClose,
  result,
  onRerun
}: EvaluationDetailSheetProps) {
  if (!result) return null;
  const isAgentic = isAgenticMetric(result.metric_id);
  const workflowDetails = (result as any).metadata_json?.workflow_details;
  const traceObservations = (result as any).metadata_json?.trace_observations;

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
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <span>{format(new Date(result.created_at), "PPpp")}</span>
            {result.trace_id && !result.trace_id.startsWith("manual_") && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <Link 
                  href={`/dashboard/traces?trace_id=${result.trace_id}`}
                  className="text-primary hover:underline font-mono text-xs font-semibold"
                >
                  View Trace
                </Link>
              </>
            )}
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

            {/* Input & Output */}
            {!isAgentic && (
              <>
                <div>
                    <h3 className="text-sm font-semibold mb-2">Input</h3>
                    <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                        {parseCleanParam(result.input, 'input')}
                    </pre>
                </div>
                <div>
                    <h3 className="text-sm font-semibold mb-2">Output</h3>
                    <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                        {parseCleanParam(result.output, 'output')}
                    </pre>
                </div>
              </>
            )}

            {/* Complete Trace Timeline for Agentic Evals */}
            {isAgentic && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Complete Trace</h3>
                {traceObservations && traceObservations.length > 0 ? (
                  <div className="space-y-4">
                    {traceObservations.map((obs: any, index: number) => {
                      const typeColors: Record<string, string> = {
                        agent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                        chain: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                        tool: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                        llm: "bg-purple-500/10 text-purple-500 border-purple-500/20",
                      };
                      const badgeColor = typeColors[obs.type?.toLowerCase()] || "bg-muted text-muted-foreground border-muted-foreground/20";
                      
                      return (
                        <div key={obs.id || index} className="border rounded-lg bg-background shadow-sm overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center justify-between p-2 bg-muted/20 border-b">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                              <Badge variant="outline" className={badgeColor + " font-semibold capitalize text-[9px]"}>
                                {obs.type || "node"}
                              </Badge>
                              <span className="font-semibold text-xs text-foreground">{obs.name}</span>
                            </div>
                          </div>
                          {/* Content */}
                          <div className="p-2 space-y-2 bg-card text-[11px]">
                            {obs.input && (
                              <div className="space-y-1">
                                <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Input</span>
                                <pre className="p-1.5 rounded bg-muted/40 font-mono text-[10px] whitespace-pre-wrap overflow-x-auto max-h-32 border">
                                  {parseCleanParam(obs.input, 'input')}
                                </pre>
                              </div>
                            )}
                            {obs.output && (
                              <div className="space-y-1">
                                <span className="font-semibold text-muted-foreground block text-[9px] uppercase tracking-wider">Output</span>
                                <pre className="p-1.5 rounded bg-muted/40 font-mono text-[10px] whitespace-pre-wrap overflow-x-auto max-h-32 border">
                                  {parseCleanParam(obs.output, 'output')}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-md border bg-muted/20 text-xs text-muted-foreground">
                    Trace details are not stored for this evaluation run.
                  </div>
                )}
              </div>
            )}

             {/* Cleanup Context Display */}
             {result.context && result.context.length > 0 && !(result.context.length === 1 && result.context[0] === result.input) && (
             <div>
                <h3 className="text-sm font-semibold mb-2">Context</h3>
                <div className="space-y-2">
                    {result.context.map((ctx, i) => (
                         <pre key={i} className="p-2 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap">
                            {ctx}
                         </pre>
                    ))}
                </div>
             </div>
             )}

             {/* Expected */}
             {result.expected_output && (
                <div>
                    <h3 className="text-sm font-semibold mb-2">Expected Output</h3>
                    <pre className="p-3 rounded bg-muted/50 border font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                        {result.expected_output}
                    </pre>
                </div>
             )}

             {/* Workflow Details */}
             {workflowDetails && (
               <div className="space-y-4 pt-4 border-t border-dashed">
                 <h3 className="text-sm font-semibold">Workflow Details</h3>
                 <div className="space-y-6">
                   {workflowDetails.agents && workflowDetails.agents.length > 0 && (
                     <div className="space-y-3">
                       <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                         <Activity className="h-3.5 w-3.5 text-primary" />
                         Evaluated Agents
                       </span>
                       <div className="space-y-2">
                         {workflowDetails.agents.map((agent: string) => {
                           const parts = agent.split(":");
                           const name = parts[0].trim();
                           const desc = parts.slice(1).join(":").trim();
                           return (
                             <div key={agent} className="p-3 rounded-lg border bg-muted/20 flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                 <Badge variant="outline" className="border-primary/30 text-primary font-mono text-[10px]">
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
                       <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                         <Wrench className="h-3.5 w-3.5 text-secondary" />
                         Evaluated Tools
                       </span>
                       <div className="space-y-2">
                         {workflowDetails.tools.map((tool: string) => {
                           const parts = tool.split(":");
                           const name = parts[0].trim();
                           const desc = parts.slice(1).join(":").trim();
                           return (
                             <div key={tool} className="p-3 rounded-lg border bg-muted/20 flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                 <Badge variant="outline" className="border-primary/30 text-primary font-mono text-[10px]">
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
      </SheetContent>
    </Sheet>
  );
}
