"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
    ChevronRight, ChevronDown, ChevronLeft, Clock, AlertCircle, PlayCircle, 
    Activity, LayoutList, Layers, Terminal, Sparkles, Bot, User, 
    Copy, Check, Wrench, FileJson, FileText, FlaskConical, RotateCcw, Cpu
} from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Node {
  id: string;
  name: string;
  type?: string;
  start_time: string;
  end_time: string;
  duration_ms?: number; 
  status?: string;
  error?: string;
  input?: any;
  output?: any;
  children: Node[];
  is_obs?: boolean;
  model?: string;
  usage?: any;
  total_cost?: number;
  attempts?: Node[];
  attributes?: any;
  events?: any[];
  application_name?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'ai' | 'other';
  content: string;
}

// Copy to Clipboard Utility
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg border border-black/[0.04] bg-white hover:bg-neutral-50 text-neutral-500 hover:text-neutral-700 transition-colors shadow-sm cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

// Safe parse JSON helper
function safeParseJSON(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

// Custom Markdown inline code, bold, and block formatter
function formatMarkdown(text: string) {
  if (!text) return "";
  // Escape HTML
  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Format code blocks: ```lang ... ```
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="bg-black/90 text-neutral-200 p-3.5 rounded-xl font-mono text-xs my-2.5 overflow-x-auto whitespace-pre-wrap">$1</pre>');
  
  // Format inline code: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-black/[0.04] px-1.5 py-0.5 rounded font-mono text-xs text-red-500">$1</code>');
  
  // Format bold: **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Format newlines
  formatted = formatted.replace(/\n/g, "<br />");
  
  return <div dangerouslySetInnerHTML={{ __html: formatted }} className="leading-relaxed text-xs text-[#1d1d1f]" />;
}

// Helper to extract nested chat list recursively
function parseMessages(val: any, forceInputMapping?: boolean, hideSystem?: boolean, outputFinalOnly?: boolean): ChatMessage[] {
  if (!val) return [];

  // 1. If string, check if JSON
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseMessages(parsed, forceInputMapping, hideSystem, outputFinalOnly);
      } catch {
        // Fallback
      }
    }
    return [{ role: forceInputMapping ? 'user' : 'user', content: val }];
  }

  // 2. If array, process elements recursively and flatten
  if (Array.isArray(val)) {
    if (outputFinalOnly) {
      for (let i = val.length - 1; i >= 0; i--) {
        const item = val[i];
        const single = parseSingleMessage(item, forceInputMapping);
        if (!single) continue;
        if (single.role === 'system' && hideSystem) continue;
        if (single.role === 'ai' && single.content && single.content.trim() !== '') {
          return [single];
        }
      }

      for (let i = val.length - 1; i >= 0; i--) {
        const fallback = parseMessages(val[i], forceInputMapping, hideSystem, outputFinalOnly);
        if (fallback.length > 0) return [fallback[fallback.length - 1]];
      }
      return [];
    }

    const flat: ChatMessage[] = [];
    val.forEach(item => {
      const parsed = parseMessages(item, forceInputMapping, hideSystem, outputFinalOnly);
      flat.push(...parsed);
    });
    return flat;
  }

  // 3. If object
  if (typeof val === 'object' && val !== null) {
    if (val.choices && Array.isArray(val.choices)) {
      const choicesMsgs: ChatMessage[] = [];
      val.choices.forEach((choice: any) => {
        if (choice.message) {
          choicesMsgs.push(...parseMessages(choice.message, forceInputMapping, hideSystem, outputFinalOnly));
        } else if (choice.text) {
          choicesMsgs.push({ role: forceInputMapping ? 'user' : 'ai', content: choice.text });
        }
      });
      return choicesMsgs;
    }

    if (val.contents && Array.isArray(val.contents)) {
      return parseMessages(val.contents, forceInputMapping, hideSystem, outputFinalOnly);
    }

    if (val.candidates && Array.isArray(val.candidates)) {
      const candidateMsgs: ChatMessage[] = [];
      val.candidates.forEach((cand: any) => {
        if (cand.content) {
          candidateMsgs.push(...parseMessages(cand.content, forceInputMapping, hideSystem, outputFinalOnly));
        }
      });
      return candidateMsgs;
    }

    if (val.parts && Array.isArray(val.parts)) {
      const textParts = val.parts.map((p: any) => {
        if (typeof p === 'string') return p;
        return p.text || p.content || JSON.stringify(p);
      }).join("\n").trim();
      const roleStr = String(val.role || 'other').toLowerCase();
      let role: 'system' | 'user' | 'ai' | 'other' = 'other';
      if (roleStr.includes('system')) role = 'system';
      else if (roleStr.includes('user') || roleStr.includes('human')) role = 'user';
      else if (roleStr.includes('model') || roleStr.includes('ai') || roleStr.includes('assistant')) role = 'ai';
      return [{ role, content: textParts }];
    }

    if (val.kwargs && val.kwargs.content !== undefined) {
      const idList = Array.isArray(val.id) ? val.id : [];
      const className = idList[idList.length - 1] || '';
      let role: 'system' | 'user' | 'ai' | 'other' = 'other';
      if (className.includes('System')) role = 'system';
      else if (className.includes('Human') || className.includes('User')) role = 'user';
      else if (className.includes('AI') || className.includes('Assistant')) role = 'ai';
      else role = forceInputMapping ? 'user' : 'ai';
      
      const content = val.kwargs.content;
      return [{ role, content: typeof content === 'string' ? content : JSON.stringify(content) }];
    }

    if (val.generations && Array.isArray(val.generations)) {
      const genMsgs: ChatMessage[] = [];
      val.generations.forEach((gen: any) => {
        if (gen.text) {
          genMsgs.push({ role: forceInputMapping ? 'user' : 'ai', content: gen.text });
        }
      });
      return genMsgs;
    }

    if (val.response && typeof val.response === 'string') {
      return [{ role: forceInputMapping ? 'user' : 'ai', content: val.response }];
    }

    if (val.content !== undefined || val.text !== undefined || val.role !== undefined || val.type !== undefined) {
      const single = parseSingleMessage(val, forceInputMapping);
      if (single && single.role === 'system' && hideSystem) {
        return [];
      }
      return single ? [single] : [];
    }

    if (val.messages && Array.isArray(val.messages)) {
      return parseMessages(val.messages, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.kwargs?.messages && Array.isArray(val.kwargs.messages)) {
      return parseMessages(val.kwargs.messages, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.kwargs?.prompt) {
      return parseMessages(val.kwargs.prompt, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.prompt) {
      return parseMessages(val.prompt, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.input) {
      return parseMessages(val.input, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.output) {
      return parseMessages(val.output, forceInputMapping, hideSystem, outputFinalOnly);
    }
    if (val.args && Array.isArray(val.args) && val.args.length > 0) {
      return parseMessages(val.args, forceInputMapping, hideSystem, outputFinalOnly);
    }
  }

  return [];
}

/**
 * Converts Python-repr strings (single quotes, True/False/None) to valid JSON then parses.
 * Falls back to the raw value on failure.
 */
function parsePythonLikeValue(raw: any): any {
  if (typeof raw !== 'string') return raw;
  try {
    // First attempt: standard JSON
    return JSON.parse(raw);
  } catch { /* not valid JSON */ }
  try {
    // Convert Python repr → JSON:
    //  single quotes → double quotes (but not apostrophes inside words)
    //  True/False/None → true/false/null
    const jsonStr = raw
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    return JSON.parse(jsonStr);
  } catch { /* still not parseable */ }
  return raw;
}

function parseSingleMessage(m: any, forceInputMapping?: boolean): ChatMessage | null {
  if (!m) return null;
  if (typeof m === 'string') return { role: forceInputMapping ? 'user' : 'other', content: m };
  
  const roleStr = String(m.role || m.type || 'other').toLowerCase();
  let role: 'system' | 'user' | 'ai' | 'other' = 'other';
  
  if (roleStr.includes('system')) {
    role = 'system';
  } else if (roleStr.includes('user') || roleStr.includes('human')) {
    role = 'user';
  } else if (roleStr.includes('ai') || roleStr.includes('assistant') || roleStr.includes('model') || roleStr.includes('output')) {
    role = forceInputMapping ? 'user' : 'ai';
  } else {
    role = forceInputMapping ? 'user' : 'other';
  }
  
  let content = "";
  if (m.content !== undefined && m.content !== null) {
    if (Array.isArray(m.content)) {
      content = m.content.map((block: any) => {
        if (typeof block === 'string') return block;
        return block.text || block.content || JSON.stringify(block);
      }).join("\n");
    } else if (typeof m.content === 'object') {
      content = m.content.text || m.content.content || JSON.stringify(m.content);
    } else {
      content = String(m.content);
    }
  } else {
    content = m.text || m.message || (typeof m === 'object' ? JSON.stringify(m) : String(m));
  }

  // Parse LLM tool calls — handle both native arrays and Python-serialized strings
  let rawToolCalls = m.tool_calls
    ?? m.additional_kwargs?.tool_calls
    ?? m.kwargs?.tool_calls
    ?? m.kwargs?.additional_kwargs?.tool_calls;
  // If it came back as a string (Python repr or JSON string of an array), parse it
  if (typeof rawToolCalls === 'string') {
    rawToolCalls = parsePythonLikeValue(rawToolCalls);
  }
  const toolCalls: any[] = Array.isArray(rawToolCalls) ? rawToolCalls : [];
  if (toolCalls.length > 0) {
    const callsList = toolCalls.map((tc: any) => {
      const name = tc.name || tc.function?.name || 'unknown_tool';
      let args = tc.args ?? tc.function?.arguments ?? {};
      if (typeof args === 'string') {
        args = parsePythonLikeValue(args);
      }
      const argsStr = (typeof args === 'object' && args !== null)
        ? JSON.stringify(args, null, 2)
        : String(args);
      return `🔧 **Calls Tool:** \`${name}\`\n**Arguments:**\n\`\`\`json\n${argsStr}\n\`\`\``;
    }).join('\n\n');
    if (callsList) {
      content = typeof content === 'string' && content.trim() ? `${content}\n\n${callsList}` : callsList;
    }
  }

  return { role, content };
}

function groupRetries(nodes: Node[]): Node[] {
  const nameGroups = new Map<string, Node[]>();
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children = groupRetries(node.children);
    }
    
    if (!nameGroups.has(node.name)) {
      nameGroups.set(node.name, []);
    }
    nameGroups.get(node.name)!.push(node);
  });

  const result: Node[] = [];

  nameGroups.forEach((group) => {
    const hasRetry = group.some(n => {
      const attempt = n.attributes?.attempt ? Number(n.attributes.attempt) : 1;
      return n.attributes?.is_retry || attempt > 1;
    });

    if (hasRetry && group.length > 1) {
      group.sort((a, b) => {
        const aAttempt = a.attributes?.attempt ? Number(a.attributes.attempt) : 1;
        const bAttempt = b.attributes?.attempt ? Number(b.attributes.attempt) : 1;
        return aAttempt - bAttempt;
      });

      const primary = group[0];
      primary.attempts = group;
      result.push(primary);
    } else {
      result.push(...group);
    }
  });

  return result.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export default function TraceTree({ spans, observations, traceId }: { spans: any[], observations: any[], traceId?: string }) {
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalTarget, setEvalTarget] = useState<Node | 'trace' | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState<string>("");
  const [evalInputs, setEvalInputs] = useState<Record<string, string>>({});
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'waterfall'>('tree');
  
  // Selected Node State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const summarizeMetric = (metric: any) => ({
    id: metric?.id,
    name: metric?.name,
    type: metric?.type,
    tags: metric?.tags,
    inputs: metric?.inputs,
  });

  useEffect(() => {
      api.get('/evaluations/metrics')
        .then(res => {
          const payload = Array.isArray(res.data) ? res.data : [];
          console.log('[TraceTree] /evaluations/metrics response', {
            total: payload.length,
            metrics: payload.map(summarizeMetric),
          });
          setMetrics(payload);
        })
        .catch((error) => {
          console.error('[TraceTree] failed to fetch /evaluations/metrics', error);
        });
  }, []);

  const openEvalModal = (target: Node | 'trace') => {
      console.log('[TraceTree] openEvalModal', {
        targetType: target === 'trace' ? 'trace' : 'node',
        targetId: target === 'trace' ? 'trace' : target.id,
        targetName: target === 'trace' ? 'Trace' : target.name,
      });
      setEvalTarget(target);
      setSelectedMetricId("");
      setEvalInputs({});
      setEvalResult(null);
      setEvalModalOpen(true);
  };

  const evalTargetKind = useMemo<'none' | 'trace' | 'node'>(() => {
    if (evalTarget === null) return 'none';
    return evalTarget === 'trace' ? 'trace' : 'node';
  }, [evalTarget]);

  const normalizeMetricType = (metric: any): string => {
    return String(metric?.type ?? '').trim().toLowerCase();
  };

  const isAgentMetric = (metric: any): boolean => {
    const metricType = normalizeMetricType(metric);
    return metricType === 'agents' || metricType === 'agent' || metricType.includes('agent');
  };

  const filteredEvalMetrics = useMemo(() => {
    if (evalTargetKind === 'trace') {
      // Trace evaluation: show only agentic metrics.
      return metrics.filter((metric: any) => isAgentMetric(metric));
    }

    if (evalTargetKind === 'node') {
      // Node evaluation: show only non-agentic metrics.
      return metrics.filter((metric: any) => !isAgentMetric(metric));
    }

    return [];
  }, [metrics, evalTargetKind]);

  useEffect(() => {
    if (!evalModalOpen) return;
    console.log('[TraceTree] modal filter state', {
      evalTargetKind,
      selectedMetricId,
      rawMetricsCount: metrics.length,
      rawMetricTypes: metrics.map((m: any) => ({
        id: m?.id,
        name: m?.name,
        type: String(m?.type ?? ''),
      })),
      filteredCount: filteredEvalMetrics.length,
      filteredMetrics: filteredEvalMetrics.map((m: any) => summarizeMetric(m)),
    });
  }, [evalModalOpen, evalTargetKind, selectedMetricId, metrics, filteredEvalMetrics]);

  const selectedMetric = filteredEvalMetrics.find(m => m.id === selectedMetricId);

    useEffect(() => {
      if (!selectedMetricId) return;
      const stillAvailable = filteredEvalMetrics.some((m: any) => m.id === selectedMetricId);
      if (!stillAvailable) {
        setSelectedMetricId("");
      }
    }, [filteredEvalMetrics, selectedMetricId]);

  // Helper to stringify data for the modal using robust parseMessages
  const prepareData = (val: any, isInput: boolean = true) => {
      if (!val) return "";
      const parsed = parseMessages(val, isInput);
      if (parsed && parsed.length > 0) {
          return parsed.map(msg => msg.content).join("\n\n").trim();
      }
      if (typeof val === 'string') {
          try {
              const parsedJson = JSON.parse(val);
              const reParsed = parseMessages(parsedJson, isInput);
              if (reParsed && reParsed.length > 0) {
                  return reParsed.map(msg => msg.content).join("\n\n").trim();
              }
          } catch {
              // Not JSON
          }
          return val;
      }
      return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
  };

  // Auto-fill inputs if evaluating a specific node
  useEffect(() => {
      if (selectedMetric && evalTarget && evalTarget !== 'trace') {
          const prefill: Record<string, string> = {};
          selectedMetric.inputs.forEach((input: string) => {
              if (input.toLowerCase() === 'input' || input.toLowerCase() === 'query') {
                  prefill[input] = prepareData((evalTarget as Node).input, true);
              } else if (input.toLowerCase() === 'output' || input.toLowerCase() === 'response') {
                  prefill[input] = prepareData((evalTarget as Node).output, false);
              } else {
                  prefill[input] = '';
              }
          });
          setEvalInputs(prefill);
      } else if (selectedMetric) {
          const prefill: Record<string, string> = {};
          selectedMetric.inputs.forEach((input: string) => { prefill[input] = ''; });
          setEvalInputs(prefill);
      }
  }, [selectedMetricId, evalTarget]);

  const handleRunEval = async () => {
      if (!selectedMetricId) return;

      // Validate required inputs based on metric requirements
      const METRIC_REQUIRED_INPUTS: Record<string, string[]> = {
          'FaithfulnessEvaluator': ['input', 'output', 'context'],
          'ContextualPrecisionEvaluator': ['input', 'output', 'context'],
          'ContextualRecallEvaluator': ['input', 'context', 'expected'],
          'ContextualRelevancyEvaluator': ['input', 'context'],
          'HallucinationEvaluator': ['input', 'output', 'context'],
          'TaskCompletionEvaluator': ['input', 'output', 'expected'],
          'ToolCorrectnessEvaluator': ['input', 'output', 'expected'],
      };

      const requiredFields = METRIC_REQUIRED_INPUTS[selectedMetricId] || [];
      const missingRequired: string[] = [];

      requiredFields.forEach(fieldName => {
          const matchingInput = selectedMetric?.inputs.find((inp: string) =>
              inp.toLowerCase() === fieldName.toLowerCase()
          );
          if (matchingInput && !evalInputs[matchingInput]?.trim()) {
              missingRequired.push(fieldName);
          }
      });

      if (missingRequired.length > 0) {
          setEvalResult({
              passed: false,
              score: 0,
              reason: `⚠️ Missing required inputs: ${missingRequired.join(', ')}. Please provide all required data for accurate evaluation.`
          });
          setEvalRunning(false);
          return;
      }

      setEvalRunning(true);
      setEvalResult(null);
      try {
          const res = await api.post('/evaluations/run', {
              metric_id: selectedMetricId,
              trace_id: traceId,
              inputs: {
                  ...evalInputs,
                  trace: traceId,
              }
          });
          setEvalResult(res.data);
      } catch (e: any) {
          console.error(e);
          setEvalResult({ passed: false, score: 0, reason: e.response?.data?.detail || e.message });
      } finally {
          setEvalRunning(false);
      }
  };

  const rootNodes = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    
    // 1. Create Nodes for all Spans
    spans.forEach((span) => {
      let spanError = undefined;
      if (span.status_code === "ERROR") {
        if (span.status_message) {
          spanError = span.status_message;
        }
        const exceptionEvent = span.events?.find((e: any) => e.name === "exception");
        if (exceptionEvent && exceptionEvent.attributes) {
          const type = exceptionEvent.attributes["exception.type"] || "Error";
          const msg = exceptionEvent.attributes["exception.message"] || "";
          const stack = exceptionEvent.attributes["exception.stacktrace"] || "";
          spanError = stack || `${type}: ${msg}`;
        }
      }

      nodeMap.set(span.span_id, {
        id: span.span_id,
        name: span.name,
        type: span.kind || "SPAN",
        start_time: span.start_time,
        end_time: span.end_time,
        duration_ms: span.duration_ms,
        status: span.status_code,
        attributes: span.attributes,
        events: span.events || [],
        error: spanError,
        children: [],
        application_name: span.application_name
      });
    });

    // 2. Create Nodes for all Observations
    // And build a map of SpanID -> ObsID replacement
    const spanToObsMap = new Map<string, string>();

    observations.forEach((obs) => {
      const obsId = String(obs.id);
      nodeMap.set(obsId, {
        id: obsId,
        name: obs.name || "Generation",
        type: obs.type || "OBSERVATION",
        start_time: obs.start_time,
        end_time: obs.end_time,
        duration_ms:
          new Date(obs.end_time).getTime() - new Date(obs.start_time).getTime(),
        error: obs.error,
        input: safeParseJSON(obs.input),
        output: safeParseJSON(obs.output),
        model: obs.model,
        usage: safeParseJSON(obs.usage),
        attributes: safeParseJSON(obs.metadata_json),
        children: [],
        is_obs: true,
        total_cost: obs.total_cost,
      });
    });

    // 3. Identify Replacements (Span -> Obs) and Merge Attributes
    spans.forEach((span) => {
      const obsId = span.attributes?.["observation_id"];
      if (obsId && nodeMap.has(String(obsId))) {
        spanToObsMap.set(span.span_id, String(obsId));

        // Merge Span attributes into Obs attributes
        const obsNode = nodeMap.get(String(obsId));
        if (obsNode) {
            const currentAttrs = (typeof obsNode.attributes === 'object' && obsNode.attributes !== null)
                ? obsNode.attributes
                : {};
            
            obsNode.attributes = {
                ...currentAttrs,
                ...span.attributes
            };
            if (span.application_name) {
                obsNode.application_name = span.application_name;
            }
            if (span.status_code) {
                obsNode.status = span.status_code;
            }
            
            let extractedError = undefined;
            const exceptionEvent = span.events?.find((e: any) => e.name === "exception");
            if (exceptionEvent && exceptionEvent.attributes) {
                const type = exceptionEvent.attributes["exception.type"] || "Error";
                const msg = exceptionEvent.attributes["exception.message"] || "";
                const stack = exceptionEvent.attributes["exception.stacktrace"] || "";
                extractedError = stack || `${type}: ${msg}`;
            }
            if (!extractedError && span.status_message) {
                extractedError = span.status_message;
            }
            if (!extractedError) {
                extractedError = obsNode.error;
            }
            if (extractedError) {
                obsNode.error = extractedError;
            }
        }
      }
    });

    const roots: Node[] = [];
    const processedNodes = new Set<string>();

    // 4. Build Tree using Span Hierarchy (with Replacements)
    spans.forEach((span) => {
      const selfId = spanToObsMap.get(span.span_id) || span.span_id;
      const selfNode = nodeMap.get(selfId);

      if (!selfNode) return;

      processedNodes.add(selfId);

      if (span.parent_span_id) {
        const parentId =
          spanToObsMap.get(span.parent_span_id) || span.parent_span_id;
        const parentNode = nodeMap.get(parentId);

        if (parentNode) {
          if (!parentNode.children.includes(selfNode)) {
            parentNode.children.push(selfNode);
          }
        } else {
          if (!roots.includes(selfNode)) roots.push(selfNode);
        }
      } else {
        if (!roots.includes(selfNode)) roots.push(selfNode);
      }
    });

    // 5. Cleanup: Add any Observations that weren't linked via Spans
    observations.forEach((obs) => {
      const obsId = String(obs.id);
      if (!processedNodes.has(obsId)) {
        const node = nodeMap.get(obsId)!;
        const parentId = obs.parent_observation_id
          ? String(obs.parent_observation_id)
          : null;

        if (parentId && nodeMap.has(parentId)) {
          nodeMap.get(parentId)!.children.push(node);
        } else {
          if (!roots.includes(node)) roots.push(node);
        }
      }
    });

    const aggregateNode = (node: Node) => {
      node.children.forEach(child => aggregateNode(child));
      
      if (node.children && node.children.length > 0) {
        const totalDuration = node.children.reduce((sum, c) => sum + (c.duration_ms || 0), 0);
        const totalTokens = node.children.reduce((sum, c) => sum + (c.usage?.total_tokens || 0), 0);
        const totalCost = node.children.reduce((sum, c) => {
          const cCost = (c.total_cost !== undefined && c.total_cost !== null && Number(c.total_cost) > 0)
            ? Number(c.total_cost)
            : ((c.usage?.total_tokens || 0) * 0.000002);
          return sum + cCost;
        }, 0);
        
        node.duration_ms = totalDuration;
        if (!node.usage) {
          node.usage = { total_tokens: totalTokens };
        } else {
          node.usage.total_tokens = totalTokens;
        }
        node.total_cost = totalCost;
      }
    };

    roots.forEach(root => aggregateNode(root));

    const sortedRoots = roots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    return groupRetries(sortedRoots);
  }, [spans, observations]);

  // Set default selection to first root node
  useEffect(() => {
    if (rootNodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(rootNodes[0].id);
    }
  }, [rootNodes, selectedNodeId]);

  const selectedNode = useMemo(() => {
    const findNode = (nodes: Node[]): Node | undefined => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
    };
    return findNode(rootNodes);
  }, [rootNodes, selectedNodeId]);

  const traceDurationStats = useMemo(() => {
    if ((!spans || !spans.length) && (!observations || !observations.length)) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    
    const checkTime = (timeStr: string) => {
      if (!timeStr) return;
      const ms = new Date(timeStr).getTime();
      if (!isNaN(ms)) {
        if (ms < minStart) minStart = ms;
        if (ms > maxEnd) maxEnd = ms;
      }
    };
    
    spans?.forEach(s => {
      checkTime(s.start_time);
      checkTime(s.end_time);
    });
    observations?.forEach(o => {
      checkTime(o.start_time);
      checkTime(o.end_time);
    });
    
    if (minStart === Infinity || maxEnd === -Infinity) return null;
    return {
      startTime: minStart,
      endTime: maxEnd,
      duration: maxEnd - minStart || 1
    };
  }, [spans, observations]);

  const timelineTicks = useMemo(() => {
    if (!traceDurationStats) return [];
    return getTimelineTicks(traceDurationStats.duration);
  }, [traceDurationStats]);

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] border border-black/[0.04] rounded-3xl overflow-hidden bg-white/70 backdrop-blur-xl shadow-sm relative mt-2">
      {/* Top Header Control bar */}
      <div className="flex justify-between items-center bg-neutral-50/50 p-4 border-b border-black/[0.04] shrink-0 h-14">
        <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-[#0071e3]" />
          Trace execution flow
        </span>
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-black/[0.02] shrink-0">
            <button
              onClick={() => setViewMode("tree")}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === "tree" ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
              }`}
              title="Tree View"
            >
              <LayoutList size={13} />
            </button>
            <button
              onClick={() => setViewMode("waterfall")}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "waterfall" ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
              }`}
              title="Waterfall View"
            >
              Waterfall
            </button>
          </div>

          {traceId && (
             <Button onClick={() => openEvalModal('trace')} variant="outline" className="gap-2 shadow-sm text-xs font-bold rounded-xl h-8 cursor-pointer" size="sm">
                <FlaskConical size={13} /> Evaluate Trace
             </Button>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Trace Tree Selector */}
        <div className="w-[420px] flex-none border-r border-black/[0.04] flex flex-col bg-neutral-50/30">
          {/* Waterfall horizontal ticks if in waterfall view mode */}
          {viewMode === "waterfall" && timelineTicks.length > 0 && (
            <div className="relative h-6 border-b border-black/[0.04] bg-neutral-50/20 text-[9px] font-mono text-[#6e6e73] select-none shrink-0">
              {timelineTicks.map((t, idx) => (
                <div 
                  key={idx} 
                  className="absolute top-1 transform -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `calc(70px + (100% - 80px) * ${t.position / 100})` }}
                >
                  <span>{t.label}</span>
                  <div className="w-px h-1 bg-black/[0.08] mt-0.5" />
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5 relative">
            {/* Waterfall guidelines background */}
            {viewMode === "waterfall" && (
              <div className="absolute inset-y-0 pointer-events-none z-0" style={{ left: "70px", right: "10px" }}>
                {timelineTicks.map((t, idx) => (
                  <div 
                    key={idx}
                    className="absolute inset-y-0 w-px border-l border-dashed border-black/[0.04]"
                    style={{ left: `${t.position}%` }}
                  />
                ))}
              </div>
            )}

            <div className="relative z-10">
              {rootNodes.map(node => (
                <TreeNode 
                  key={node.id} 
                  node={node} 
                  level={0} 
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                  onEvaluate={() => openEvalModal(node)} 
                  traceDurationStats={traceDurationStats}
                  viewMode={viewMode}
                />
              ))}
              {rootNodes.length === 0 && <div className="p-8 text-center text-[#6e6e73] text-xs">No execution logs logged.</div>}
            </div>
          </div>
        </div>

        {/* Right Column: Node Details panel */}
        <div className="flex-1 overflow-y-auto bg-white flex flex-col">
          {selectedNode ? (
            <NodeDetailView 
              node={selectedNode} 
              isRootNode={rootNodes.some(r => r.id === selectedNode.id)}
              onEvaluate={() => openEvaluateNode(selectedNode)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#6e6e73] p-8">
              <Layers size={36} className="opacity-20 mb-3 animate-pulse" />
              <p className="text-xs font-semibold">Select a tree span node to view arguments.</p>
            </div>
          )}
        </div>
      </div>

      {/* Evaluate Dialog Modal */}
      <Dialog open={evalModalOpen} onOpenChange={setEvalModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                  <DialogTitle>Evaluate {evalTarget === 'trace' ? 'Trace' : 'Node'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Metric</Label>
                      <Select value={selectedMetricId} onValueChange={setSelectedMetricId}>
                          <SelectTrigger>
                              <SelectValue placeholder="Select a metric to evaluate..." />
                          </SelectTrigger>
                          <SelectContent>
                              {filteredEvalMetrics.map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  {selectedMetric && selectedMetric.inputs.length > 0 && (
                      <div className="space-y-3 pt-2">
                          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Evaluation Inputs</Label>
                          {selectedMetric.inputs.map((inputKey: string) => {
                              const METRIC_REQUIRED_INPUTS: Record<string, string[]> = {
                                  'FaithfulnessEvaluator': ['input', 'output', 'context'],
                                  'ContextualPrecisionEvaluator': ['input', 'output', 'context'],
                                  'ContextualRecallEvaluator': ['input', 'context', 'expected'],
                                  'ContextualRelevancyEvaluator': ['input', 'context'],
                                  'HallucinationEvaluator': ['input', 'output', 'context'],
                                  'TaskCompletionEvaluator': ['input', 'output', 'expected'],
                                  'ToolCorrectnessEvaluator': ['input', 'output', 'expected'],
                              };
                              const required = METRIC_REQUIRED_INPUTS[selectedMetricId] || [];
                              const isRequired = required.some(r => r.toLowerCase() === inputKey.toLowerCase());
                              return (
                                  <div key={inputKey} className="space-y-1.5">
                                      <Label className="font-mono text-xs flex items-center gap-2">
                                          {inputKey}
                                          {isRequired ? (
                                              <span className="text-red-500 font-bold">*</span>
                                          ) : (
                                              <span className="text-muted-foreground text-[10px]">(optional)</span>
                                          )}
                                      </Label>
                                      <Textarea
                                          className="font-mono text-xs max-h-32"
                                          value={evalInputs[inputKey] || ''}
                                          onChange={(e) => setEvalInputs({...evalInputs, [inputKey]: e.target.value})}
                                          placeholder={`Enter ${inputKey}...`}
                                      />
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {evalResult && (
                      <div className="mt-6 p-4 bg-muted/30 rounded-md border text-sm">
                          <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold">Score:</span>
                              <div className={`px-2 py-0.5 rounded text-xs font-bold text-white ${evalResult.passed ? 'bg-green-500' : 'bg-destructive'}`}>
                                  {Math.round(evalResult.score * 100)}%
                              </div>
                          </div>
                          <p className="text-muted-foreground mt-2">{evalResult.reason}</p>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setEvalModalOpen(false)}>Close</Button>
                  <Button onClick={handleRunEval} disabled={!selectedMetricId || evalRunning}>
                      {evalRunning ? 'Evaluating...' : 'Run Evaluation'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );

  function openEvaluateNode(targetNode: Node) {
    openEvalModal(targetNode);
  }
}

function getTimelineTicks(durationMs: number) {
  const durSec = durationMs / 1000;
  let interval = 0.1; 
  if (durSec > 10) interval = 5;
  else if (durSec > 5) interval = 2;
  else if (durSec > 2) interval = 1;
  else if (durSec > 1) interval = 0.5;
  else if (durSec > 0.5) interval = 0.25;
  else if (durSec > 0.2) interval = 0.1;
  else interval = 0.05;
  
  const ticks = [];
  let current = interval;
  while (current < durSec) {
    ticks.push({
      label: current >= 1 ? `${current.toFixed(1)}s` : `${(current * 1000).toFixed(0)}ms`,
      position: (current / durSec) * 100
    });
    current += interval;
  }
  if (ticks.length === 0) {
    ticks.push({ label: "0s", position: 0 });
    ticks.push({ label: `${(durationMs).toFixed(0)}ms`, position: 100 });
  }
  return ticks;
}

// Interactive Tree Node list component
function TreeNode({ 
  node, 
  level, 
  onEvaluate, 
  traceDurationStats,
  viewMode,
  selectedId,
  onSelect
}: { 
  node: Node; 
  level: number; 
  onEvaluate: () => void; 
  traceDurationStats: any;
  viewMode: "tree" | "waterfall";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  
  const finalAttemptNode = node.attempts && node.attempts.length > 0
    ? node.attempts[node.attempts.length - 1]
    : node;
  const isError = finalAttemptNode.error || finalAttemptNode.status === 'ERROR';

  const barStyle = useMemo(() => {
    if (!traceDurationStats) return null;
    const start = new Date(node.start_time).getTime();
    const end = new Date(node.end_time).getTime();
    const offset = ((start - traceDurationStats.startTime) / traceDurationStats.duration) * 100;
    const width = Math.max(((end - start) / traceDurationStats.duration) * 100, 1.5);
    return {
      left: `${Math.max(0, Math.min(offset, 98.5))}%`,
      width: `${Math.min(width, 100 - offset)}%`,
      rawWidth: width
    };
  }, [node.start_time, node.end_time, traceDurationStats]);

  const isWide = barStyle && barStyle.rawWidth >= 30;

  const metadataBadges = useMemo(() => {
    const badges = [];
    if (node.duration_ms !== undefined) {
      const durSec = node.duration_ms / 1000;
      badges.push({
        icon: <Clock size={10} className="opacity-70" />,
        text: durSec >= 1 ? `${durSec.toFixed(2)}s` : `${node.duration_ms.toFixed(0)}ms`
      });
    }
    if (node.usage?.total_tokens) {
      badges.push({
        text: `${node.usage.total_tokens} tokens`
      });
    }
    if (node.total_cost !== undefined && node.total_cost !== null && Number(node.total_cost) > 0) {
      badges.push({
        text: `$${Number(node.total_cost).toFixed(5)}`
      });
    }
    if (node.model) {
      badges.push({
        text: node.model,
        isModel: true
      });
    }
    // Retry/attempt badge
    if (node.attributes?.attempt && Number(node.attributes.attempt) > 1) {
      badges.push({
        icon: <RotateCcw size={10} className="text-amber-500" />,
        text: `Attempt #${node.attributes.attempt}`,
        isRetry: true
      });
    }
    return badges;
  }, [node]);

  if (viewMode === "tree") {
    return (
      <div className="select-none relative font-sans border-b border-black/[0.02] last:border-0">
        <div
          className={`flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer text-xs mb-0.5 transition-all ${
            isSelected
              ? "bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]/20"
              : "text-[#1d1d1f] hover:bg-black/[0.02]"
          }`}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          onClick={() => onSelect(node.id)}
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div
              className={`w-4 h-4 mt-0.5 flex items-center justify-center rounded hover:bg-black/[0.04] transition-colors ${
                hasChildren ? "visible cursor-pointer" : "invisible"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </div>

            <div className={`shrink-0 mt-0.5 ${
              isError ? "text-red-500" : node.is_obs ? "text-blue-500" : "text-emerald-500"
            }`}>
              {node.is_obs ? <Terminal size={12} /> : <Layers size={12} />}
            </div>

            <div className="flex flex-col min-w-0">
              <span className={`truncate font-mono text-[11px] ${
                isSelected ? "font-bold text-[#0071e3]" : "font-semibold"
              } ${isError ? "text-red-600" : ""}`} title={node.name}>
                {node.name}
              </span>
              
              {metadataBadges.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap opacity-80">
                  {metadataBadges.map((badge, idx) => (
                    <span 
                      key={idx} 
                      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono font-bold leading-none ${
                        badge.isModel 
                          ? "bg-black/[0.04] text-[#6e6e73] border border-black/[0.02]"
                          : "bg-black/[0.02] text-[#6e6e73]"
                      }`}
                    >
                      {badge.icon}
                      {badge.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {expanded && hasChildren && (
          <div className="relative">
            <div
              className="absolute bg-black/[0.03] w-px top-0 bottom-2.5"
              style={{ left: `${level * 14 + 17}px`, zIndex: 0 }}
            />
            {node.children.map(child => (
              <TreeNode 
                key={child.id} 
                node={child} 
                level={level + 1} 
                selectedId={selectedId}
                onSelect={onSelect}
                onEvaluate={onEvaluate} 
                traceDurationStats={traceDurationStats}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Waterfall Gantt chart row
  return (
    <div className="select-none relative w-full font-sans border-b border-black/[0.02]">
      <div 
        className="absolute left-0 top-0 h-8 flex items-center z-20 pointer-events-none"
        style={{ width: `${level * 14 + 20}px` }}
      >
        <div
          className={`w-4 h-4 flex items-center justify-center rounded hover:bg-black/[0.04] transition-colors pointer-events-auto ${
            hasChildren ? "visible cursor-pointer" : "invisible"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronDown size={11} className="text-[#6e6e73]" /> : <ChevronRight size={11} className="text-[#6e6e73]" />}
        </div>
      </div>

      <div
        className={`group relative flex items-center h-8 rounded-lg cursor-pointer transition-all border border-transparent ${
          isSelected ? "bg-[#0071e3]/5 border-[#0071e3]/10" : "hover:bg-black/[0.01]"
        }`}
        style={{ paddingLeft: "70px" }}
        onClick={() => onSelect(node.id)}
      >
        <div className="relative flex-1 h-6">
          {barStyle && (
            <>
              <div 
                className={`absolute inset-y-0 rounded-md flex items-center px-2 text-[10px] text-white font-mono select-none overflow-hidden transition-all duration-150 shadow-sm ${
                  isError 
                    ? "bg-[#ff3b30]" 
                    : node.type?.toLowerCase() === 'agent' 
                    ? "bg-[#5856d6]"
                    : node.type?.toLowerCase() === 'tool' 
                    ? "bg-[#ff9500]"
                    : node.is_obs
                    ? "bg-[#0a84ff]"
                    : "bg-[#34c759]"
                }`}
                style={{ left: barStyle.left, width: barStyle.width }}
              >
                {isWide && (
                  <div className="flex items-center gap-1.5 truncate">
                    {node.is_obs ? <Terminal size={11} /> : <Layers size={11} />}
                    <span className="font-bold truncate">{node.name}</span>
                    <span className="opacity-80 shrink-0 font-semibold">{((node.duration_ms || 0) / 1000).toFixed(2)}s</span>
                  </div>
                )}
              </div>

              {!isWide && (
                <div 
                  className="absolute inset-y-0 flex items-center gap-1.5 text-[10px] font-mono text-[#1d1d1f] whitespace-nowrap pl-2"
                  style={{ left: `calc(${barStyle.left} + ${barStyle.width})` }}
                >
                  {node.is_obs ? <Terminal size={11} className="text-[#0a84ff]" /> : <Layers size={11} className="text-[#34c759]" />}
                  <span className="font-bold truncate">{node.name}</span>
                  <span className="text-[#6e6e73] font-semibold opacity-60 font-mono">{((node.duration_ms || 0) / 1000).toFixed(2)}s</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          <div
            className="absolute bg-black/[0.03] w-px top-0 bottom-2"
            style={{ left: `${level * 14 + 7}px`, zIndex: 0 }}
          />
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              selectedId={selectedId}
              onSelect={onSelect}
              onEvaluate={onEvaluate} 
              traceDurationStats={traceDurationStats}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Right panel: Detailed parameters, parsed input prompt lists and response text bubbles
function NodeDetailView({ 
  node, 
  isRootNode, 
  onEvaluate 
}: { 
  node: Node; 
  isRootNode: boolean; 
  onEvaluate: () => void;
}) {
  const [inputFormat, setInputFormat] = useState<'markdown' | 'json' | 'raw'>('markdown');
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'json' | 'raw'>('markdown');
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState(0);

  useEffect(() => {
    if (node.attempts && node.attempts.length > 0) {
      setSelectedAttemptIdx(node.attempts.length - 1);
    } else {
      setSelectedAttemptIdx(0);
    }
  }, [node]);

  const activeNode = useMemo(() => {
    if (node.attempts && node.attempts.length > 0 && selectedAttemptIdx < node.attempts.length) {
      return node.attempts[selectedAttemptIdx];
    }
    return node;
  }, [node, selectedAttemptIdx]);

  const totalAttempts = node.attempts?.length || 1;
  const currentAttempt = node.attempts ? (selectedAttemptIdx + 1) : (activeNode.attributes?.attempt || 1);

  // For agent nodes: input comes from first child, output from last child
  const isAgentNode = activeNode.type?.toLowerCase() === 'agent';

  const hasMeaningfulPayload = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed !== '' && trimmed !== '{}' && trimmed !== '{"args":[],"kwargs":{}}';
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  };

  const extractFinalAssistantMessage = (raw: any): any => {
    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== 'object') return raw;

    const messages = Array.isArray((parsed as any).messages) ? (parsed as any).messages : null;
    if (!messages || messages.length === 0) return raw;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') continue;
      const role = String((msg as any).role || (msg as any).type || '').toLowerCase();
      const content = (msg as any).content;
      const isAssistant = role.includes('ai') || role.includes('assistant') || role.includes('model') || role.includes('output');
      if (isAssistant && content !== undefined && content !== null && String(content).trim() !== '') {
        return content;
      }
    }

    // Fallback: return the last message content if no assistant role was found.
    const last = messages[messages.length - 1];
    if (last && typeof last === 'object' && (last as any).content !== undefined && (last as any).content !== null) {
      return (last as any).content;
    }

    return raw;
  };

  const normalizeTerminalOutput = (raw: any): any => {
    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== 'object') {
      return raw;
    }

    const msgTail = extractFinalAssistantMessage(parsed);
    if (msgTail !== parsed) {
      return msgTail;
    }

    // Prefer concise terminal fields when present.
    if (typeof (parsed as any).report === 'string' && (parsed as any).report.trim() !== '') {
      return (parsed as any).report;
    }
    if (typeof (parsed as any).answer === 'string' && (parsed as any).answer.trim() !== '') {
      return (parsed as any).answer;
    }
    if (typeof (parsed as any).output === 'string' && (parsed as any).output.trim() !== '') {
      return (parsed as any).output;
    }

    return raw;
  };

  // Find first child input (skip self — look directly at children in order)
  const getFirstChildInput = (n: Node): any => {
    if (n.children && n.children.length > 0) {
      for (const child of n.children) {
        // Walk deeper into this child's subtree
        const subInput = getFirstChildInput(child);
        if (subInput) return subInput;

        if (hasMeaningfulPayload(child.input)) {
          return child.input;
        }
      }
    }
    return null;
  };

  // Find last child output (skip self — look directly at children in reverse)
  const getLastChildOutput = (n: Node): any => {
    if (n.children && n.children.length > 0) {
      for (let i = n.children.length - 1; i >= 0; i--) {
        const child = n.children[i];
        // Walk deeper into this child's subtree
        const res = getLastChildOutput(child);
        if (res) return res;

        if (hasMeaningfulPayload(child.output)) {
          return child.output;
        }
      }
    }
    return null;
  };

  const hasNoInput = !activeNode.input || (typeof activeNode.input === 'object' && Object.keys(activeNode.input).length === 0) || activeNode.input === '{"args":[],"kwargs":{}}' || activeNode.input === '{}';
  const hasNoOutput = !activeNode.output || (typeof activeNode.output === 'object' && Object.keys(activeNode.output).length === 0) || activeNode.output === '{}';
  const hasChildren = activeNode.children && activeNode.children.length > 0;
  const shouldOverride = isAgentNode || isRootNode || (hasNoInput && hasNoOutput && hasChildren);

  const displayInput = useMemo(() => {
    if (shouldOverride) return getFirstChildInput(activeNode) ?? activeNode.input;
    return activeNode.input;
  }, [activeNode, shouldOverride]);

  const displayOutput = useMemo(() => {
    if (shouldOverride) return getLastChildOutput(activeNode) ?? normalizeTerminalOutput(activeNode.output);
    return normalizeTerminalOutput(activeNode.output);
  }, [activeNode, shouldOverride]);

  const contentFormatSelector = (
    currentFormat: 'markdown' | 'json' | 'raw', 
    setFormat: (f: 'markdown' | 'json' | 'raw') => void
  ) => (
    <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-black/[0.02]">
      <button
        onClick={() => setFormat('markdown')}
        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
          currentFormat === 'markdown' ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
        }`}
      >
        Markdown
      </button>
      <button
        onClick={() => setFormat('json')}
        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
          currentFormat === 'json' ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
        }`}
      >
        <FileJson size={9} />
        JSON
      </button>
      <button
        onClick={() => setFormat('raw')}
        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
          currentFormat === 'raw' ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73] hover:text-[#1d1d1f]"
        }`}
      >
        <FileText size={9} />
        Raw
      </button>
    </div>
  );
  const renderContentBox = (content: any, format: 'markdown' | 'json' | 'raw', isInput?: boolean, hideSystem?: boolean) => {
    if (!content) return <div className="text-neutral-400 italic text-[11px] p-2 bg-neutral-50/50 rounded-xl">Empty payload</div>;
    
    const rawString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    if (format === 'json') {
      try {
        const obj = typeof content === 'string' ? JSON.parse(content) : content;
        return (
          <pre className="font-mono text-[11px] bg-black/95 text-neutral-300 p-3.5 rounded-2xl overflow-x-auto select-all leading-normal">
            {JSON.stringify(obj, null, 2)}
          </pre>
        );
      } catch {
        return (
          <pre className="font-mono text-[11px] bg-black/95 text-neutral-300 p-3.5 rounded-2xl overflow-x-auto select-all leading-normal">
            {rawString}
          </pre>
        );
      }
    }

    if (format === 'raw') {
      return (
        <pre className="font-mono text-[11px] bg-neutral-50 border border-black/[0.04] text-[#1d1d1f] p-3.5 rounded-2xl overflow-x-auto select-all leading-normal whitespace-pre-wrap">
          {rawString}
        </pre>
      );
    }

    // Markdown / Role-based prompt bubbles
    const chatMsgs = parseMessages(content, isInput, hideSystem, !isInput);
    const hasChatMessages = chatMsgs.length > 0 && chatMsgs.some(m => m.role === 'system' || m.role === 'user' || m.role === 'ai');

    if (format === 'markdown' && !hasChatMessages) {
      try {
        const obj = typeof content === 'string' ? JSON.parse(content) : content;
        return (
          <pre className="font-mono text-[11px] bg-neutral-50 border border-black/[0.04] text-[#1d1d1f] p-3.5 rounded-2xl overflow-x-auto select-all leading-normal whitespace-pre">
            {JSON.stringify(obj, null, 2)}
          </pre>
        );
      } catch {
        return (
          <pre className="font-mono text-[11px] bg-neutral-50 border border-black/[0.04] text-[#1d1d1f] p-3.5 rounded-2xl overflow-x-auto select-all leading-normal whitespace-pre-wrap">
            {rawString}
          </pre>
        );
      }
    }

    return (
      <div className="space-y-3">
        {chatMsgs.map((msg, index) => {
          const isSystem = msg.role === 'system';
          const isUser = msg.role === 'user';
          const isAI = msg.role === 'ai';

          return (
            <div 
              key={index}
              className={`p-3.5 rounded-2xl border transition-all ${
                isSystem 
                  ? "bg-neutral-50 border-black/[0.03] text-[#6e6e73]" 
                  : isUser
                  ? "bg-[#0071e3]/5 border-[#0071e3]/10 text-[#1d1d1f]"
                  : isAI
                  ? "bg-orange-50/40 border-orange-100 text-[#1d1d1f]"
                  : "bg-neutral-50 border-black/[0.03] text-[#1d1d1f]"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2 font-semibold text-[9px] uppercase tracking-wider">
                {isSystem && (
                  <>
                    <div className="w-5 h-5 rounded-lg bg-neutral-100 flex items-center justify-center border border-black/[0.03] text-neutral-500">
                      <Terminal size={10} />
                    </div>
                    <span>System Prompt</span>
                  </>
                )}
                {isUser && (
                  <>
                    <div className="w-5 h-5 rounded-lg bg-[#0071e3]/10 flex items-center justify-center border border-[#0071e3]/10 text-[#0071e3]">
                      <User size={10} />
                    </div>
                    <span>User Input</span>
                  </>
                )}
                {isAI && (
                  <>
                    <div className="w-5 h-5 rounded-lg bg-orange-100 flex items-center justify-center border border-orange-200 text-orange-600">
                      <Bot size={10} />
                    </div>
                    <span>AI Response</span>
                  </>
                )}
                {!isSystem && !isUser && !isAI && (
                  <>
                    <div className="w-5 h-5 rounded-lg bg-neutral-100 flex items-center justify-center border border-black/[0.03] text-neutral-500">
                      <Layers size={10} />
                    </div>
                    <span>Payload</span>
                  </>
                )}
              </div>
              <div className="text-[11px] leading-relaxed break-words font-sans">
                {formatMarkdown(msg.content)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col justify-start">
      {/* Detail title header */}
      <div className="flex justify-between items-start gap-4 border-b border-black/[0.04] pb-4 shrink-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-[#1d1d1f] font-mono truncate">{activeNode.name}</h2>
            {activeNode.type?.toLowerCase() === 'agent' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[10px] border border-purple-500/20 font-bold uppercase tracking-wide select-none">
                <Bot size={10} /> Agent
              </span>
            )}
            {activeNode.type?.toLowerCase() === 'tool' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] border border-amber-500/20 font-bold uppercase tracking-wide select-none">
                <Wrench size={10} /> Tool
              </span>
            )}
            <span className="px-1.5 py-0.5 bg-black/[0.03] text-[#6e6e73] text-[9px] font-mono border border-black/[0.04] rounded-md shrink-0 select-all">
              ID: {activeNode.id.slice(0, 8)}
            </span>
          </div>
        </div>
        <Button onClick={onEvaluate} variant="outline" className="gap-1.5 shadow-sm text-xs font-bold rounded-xl h-8 cursor-pointer hover:bg-neutral-50 shrink-0" size="sm">
          <FlaskConical size={12} /> Evaluate Node
        </Button>
      </div>

      {/* Attempt / Try switcher */}
      {node.attempts && node.attempts.length > 1 && (
        <div className="flex items-center gap-3 border-b border-black/[0.04] pb-4 shrink-0 select-none">
          <span className="text-[11px] text-[#6e6e73] font-bold uppercase tracking-wider">
            Attempts:
          </span>
          <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl border border-black/[0.03]">
            <button
              disabled={selectedAttemptIdx === 0}
              onClick={() => setSelectedAttemptIdx(prev => prev - 1)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                selectedAttemptIdx === 0
                  ? "opacity-40 cursor-not-allowed bg-transparent border-transparent text-[#6e6e73]"
                  : "bg-white text-[#1d1d1f] border-black/[0.08] hover:bg-neutral-50 shadow-sm"
              }`}
              title="Previous Attempt"
            >
              <ChevronLeft size={14} />
            </button>
            
            <span className="text-xs font-mono font-bold text-[#1d1d1f] px-2 flex items-center gap-1.5">
              <span>{selectedAttemptIdx + 1}</span>
              <span className="text-[#6e6e73] font-normal">/</span>
              <span>{node.attempts.length}</span>
            </span>

            <button
              disabled={selectedAttemptIdx === node.attempts.length - 1}
              onClick={() => setSelectedAttemptIdx(prev => prev + 1)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                selectedAttemptIdx === node.attempts.length - 1
                  ? "opacity-40 cursor-not-allowed bg-transparent border-transparent text-[#6e6e73]"
                  : "bg-white text-[#1d1d1f] border-black/[0.08] hover:bg-neutral-50 shadow-sm"
              }`}
              title="Next Attempt"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Status indication badge for the active attempt */}
          {(() => {
            const currentAttemptNode = node.attempts[selectedAttemptIdx];
            const isError = currentAttemptNode.error || currentAttemptNode.status === 'ERROR';
            return (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                isError 
                  ? "bg-red-50 text-red-600 border-red-200/50" 
                  : "bg-emerald-50 text-emerald-600 border-emerald-200/50"
              }`}>
                {isError ? "Failure ⚠️" : "Success"}
              </span>
            );
          })()}
        </div>
      )}

      {/* Node resource summary statistics parameters */}
      <div className="grid grid-cols-3 gap-4 p-4 border border-black/[0.04] rounded-2xl bg-neutral-50/50 shrink-0 select-all text-xs font-semibold text-[#1d1d1f]">
        <div className="space-y-1">
          <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider block">Duration</span>
          <span className="font-mono">
            {activeNode.duration_ms !== undefined 
              ? (activeNode.duration_ms >= 1000 
                 ? `${(activeNode.duration_ms / 1000).toFixed(3)}s` 
                 : `${activeNode.duration_ms.toFixed(0)}ms`) 
              : "-"}
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider block">Tokens</span>
          <span className="font-mono">{activeNode.usage?.total_tokens ?? 0}</span>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider block">Cost</span>
          <span className="font-mono text-emerald-600">
            {(() => {
              const displayCost = (activeNode.total_cost !== undefined && activeNode.total_cost !== null && Number(activeNode.total_cost) > 0)
                ? Number(activeNode.total_cost)
                : ((activeNode.usage?.total_tokens || 0) * 0.000002);
              return displayCost > 0 ? `$${displayCost.toFixed(5)}` : "$0.00000";
            })()}
          </span>
        </div>
      </div>



      {/* Main Parameters lists */}
      <div className="space-y-5 flex-1 overflow-y-auto pr-1">
        {/* INPUT Section */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span 
              className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-[#1d1d1f] transition-colors select-none"
              onClick={() => setInputCollapsed(!inputCollapsed)}
            >
              {inputCollapsed ? <ChevronRight size={11} className="text-neutral-400" /> : <ChevronDown size={11} className="text-neutral-400" />}
              <Sparkles size={11} className="text-[#0071e3]" />
              Input Parameters
            </span>
            <div className="flex items-center gap-2">
              {contentFormatSelector(inputFormat, setInputFormat)}
              <CopyButton text={typeof displayInput === 'string' ? displayInput : JSON.stringify(displayInput, null, 2)} />
            </div>
          </div>
          {!inputCollapsed && renderContentBox(displayInput, inputFormat, true, isAgentNode)}
        </div>

        {/* OUTPUT Section */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center border-t border-black/[0.04] pt-4 mt-2">
            <span 
              className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-[#1d1d1f] transition-colors select-none"
              onClick={() => setOutputCollapsed(!outputCollapsed)}
            >
              {outputCollapsed ? <ChevronRight size={11} className="text-neutral-400" /> : <ChevronDown size={11} className="text-neutral-400" />}
              <Bot size={11} className="text-orange-500" />
              Output Response
            </span>
            <div className="flex items-center gap-2">
              {contentFormatSelector(outputFormat, setOutputFormat)}
              <CopyButton text={typeof displayOutput === 'string' ? displayOutput : JSON.stringify(displayOutput, null, 2)} />
            </div>
          </div>
          {!outputCollapsed && renderContentBox(displayOutput, outputFormat, false)}
        </div>

        {/* METADATA Section */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center border-t border-black/[0.04] pt-4 mt-2">
            <span className="text-[10px] text-[#6e6e73] font-bold uppercase tracking-wider flex items-center gap-1.5 select-none">
              <Cpu size={11} className="text-[#0071e3]" />
              metadata
            </span>
          </div>
          <div className="p-4 bg-neutral-50/50 border border-black/[0.03] rounded-2xl text-[11px] font-mono divide-y divide-black/[0.03]">
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-[#6e6e73]">time taken:</span>
              <span className="text-[#1d1d1f] font-medium">
                {activeNode.duration_ms !== undefined 
                  ? (activeNode.duration_ms >= 1000 
                     ? `${(activeNode.duration_ms / 1000).toFixed(3)}s` 
                     : `${activeNode.duration_ms.toFixed(0)}ms`) 
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
              <span className="text-[#6e6e73]">attempt:</span>
              <span className="text-[#1d1d1f] font-medium">{currentAttempt}/{totalAttempts}</span>
            </div>
          </div>
        </div>

        {/* Error notification alert if applicable */}
        {activeNode.error && (
          <div className="p-4 bg-red-50 border border-red-200/50 rounded-2xl text-xs font-mono text-red-600 flex items-start gap-2.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500" />
            <div className="space-y-1 min-w-0">
              <span className="font-bold text-red-700 uppercase tracking-wider text-[10px]">Execution Error</span>
              <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-red-600 select-all">{activeNode.error}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
