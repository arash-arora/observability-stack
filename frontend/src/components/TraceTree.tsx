"use client";

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Circle, Clock, AlertCircle, Play, Activity, LayoutList, Layers, Terminal } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  input?: string;
  output?: string;
  children: Node[];
  is_obs?: boolean;
  model?: string;
  usage?: any;
  total_cost?: number;
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

  useEffect(() => {
      api.get('/evaluations/metrics').then(res => setMetrics(res.data)).catch(console.error);
  }, []);

  const openEvalModal = (target: Node | 'trace') => {
      setEvalTarget(target);
      setSelectedMetricId("");
      setEvalInputs({});
      setEvalResult(null);
      setEvalModalOpen(true);
  };

  const selectedMetric = metrics.find(m => m.id === selectedMetricId);

  // Auto-fill inputs if evaluating a specific node
  useEffect(() => {
      if (selectedMetric && evalTarget && evalTarget !== 'trace') {
          const prefill: Record<string, string> = {};
          selectedMetric.inputs.forEach((input: string) => {
              if (input.toLowerCase() === 'input' || input.toLowerCase() === 'query') {
                  prefill[input] = (evalTarget as Node).input || '';
              } else if (input.toLowerCase() === 'output' || input.toLowerCase() === 'response') {
                  prefill[input] = (evalTarget as Node).output || '';
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
      setEvalRunning(true);
      setEvalResult(null);
      try {
          const res = await api.post('/evaluations/run', {
              metric_id: selectedMetricId,
              inputs: {
                  ...evalInputs,
                  trace: traceId,
                  // We can pass trace payload if needed, backend traces use Trace ID for observation data usually
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
    
    // Process Spans
    spans.forEach(span => {
      nodeMap.set(span.span_id, {
        id: span.span_id,
        name: span.name,
        type: 'SPAN',
        start_time: span.start_time,
        end_time: span.end_time,
        duration_ms: span.duration_ms,
        status: span.status_code,
        children: []
      });
    });

    // Process Observations
    observations.forEach(obs => {
      const id = obs.id;
      // Duration might need calc if not provided
      const start = new Date(obs.start_time).getTime();
      const end = new Date(obs.end_time).getTime();
      const duration = end - start;
      
      const parseJson = (val: any) => {
        if (!val) return null;
        if (typeof val === 'object') return val;
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      };

      nodeMap.set(id, {
        id: id,
        name: obs.name || 'Unnamed Observation',
        type: obs.type,
        start_time: obs.start_time,
        end_time: obs.end_time,
        duration_ms: duration,
        error: obs.error,
        input: obs.input,
        output: obs.output,
        children: [],
        is_obs: true,
        model: obs.model,
        usage: parseJson(obs.usage),
        total_cost: obs.total_cost
      });
    });

    const roots: Node[] = [];
    
    // Build Tree
    // Link Spans -> Spans
    spans.forEach(span => {
      const node = nodeMap.get(span.span_id)!;
      if (span.parent_span_id && nodeMap.has(span.parent_span_id)) {
        nodeMap.get(span.parent_span_id)!.children.push(node);
      } else {
        // Only treat as root if it's a root span. 
        // Note: observations might be independent or linked.
        // For mixed tree, it's tricky without explicit links.
        // Assuming pure span tree OR pure observation tree for now if links missing.
        // But let's check if span parent is missing.
        // If parent_span_id is null, it's root.
        if (!span.parent_span_id) roots.push(node);
      }
    });

    // Link Observations -> Observations
    observations.forEach(obs => {
      const node = nodeMap.get(obs.id)!;
      if (obs.parent_observation_id && nodeMap.get(obs.parent_observation_id)) {
        nodeMap.get(obs.parent_observation_id)!.children.push(node);
      } else {
        // If not linked to another observation, is it linked to a span?
        // Current logic might not link obs to spans explicitly via IDs in this list.
        roots.push(node);
      }
    });

    // Sort roots by start time
    return roots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [spans, observations]);

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
    <div className="space-y-4 font-sans">
      <div className="flex justify-between items-center bg-white/40 p-4 border border-black/[0.04] rounded-2xl">
        <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-widest">
          {viewMode === "waterfall" ? "Execution Waterfall" : "Execution Tree"}
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
             <Button onClick={() => openEvalModal('trace')} variant="outline" className="gap-2 shadow-sm" size="sm">
                <Activity size={14} /> Evaluate Trace
             </Button>
          )}
        </div>
      </div>

      <div className="border border-black/[0.04] rounded-2xl overflow-hidden bg-white/70 backdrop-blur-xl shadow-sm relative flex flex-col">
        {/* Waterfall horizontal ruler ticks */}
        {viewMode === "waterfall" && timelineTicks.length > 0 && (
          <div className="relative h-6 border-b border-black/[0.04] bg-neutral-50/20 text-[9px] font-mono text-[#6e6e73] select-none">
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

        <div className="p-3 space-y-0.5 relative flex-1">
          {/* Waterfall grid vertical guidelines */}
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
                onEvaluate={() => openEvalModal(node)} 
                traceDurationStats={traceDurationStats}
                viewMode={viewMode}
              />
            ))}
            {rootNodes.length === 0 && <div className="p-4 text-center text-muted">No data to display</div>}
          </div>
        </div>
      </div>

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
                              {metrics.map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  {selectedMetric && selectedMetric.inputs.length > 0 && (
                      <div className="space-y-3 pt-2">
                          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Required Inputs</Label>
                          {selectedMetric.inputs.map((inputKey: string) => (
                              <div key={inputKey} className="space-y-1.5">
                                  <Label className="font-mono text-xs">{inputKey}</Label>
                                  <Textarea 
                                      className="font-mono text-xs max-h-32" 
                                      value={evalInputs[inputKey] || ''}
                                      onChange={(e) => setEvalInputs({...evalInputs, [inputKey]: e.target.value})}
                                      placeholder={`Enter ${inputKey}...`}
                                  />
                              </div>
                          ))}
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
}

function getTimelineTicks(durationMs: number) {
  const durSec = durationMs / 1000;
  let interval = 0.1; // in seconds
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

function TreeNode({ 
  node, 
  level, 
  onEvaluate, 
  traceDurationStats,
  viewMode,
}: { 
  node: Node; 
  level: number; 
  onEvaluate: () => void; 
  traceDurationStats: any;
  viewMode: "tree" | "waterfall";
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  const isError = node.error || node.status === 'ERROR';

  // Calculations for Gantt timeline
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

  // Metadata pills in tree view
  const metadataBadges = useMemo(() => {
    const badges = [];
    
    // Duration badge
    if (node.duration_ms !== undefined) {
      const durSec = node.duration_ms / 1000;
      badges.push({
        icon: <Clock size={10} className="opacity-70" />,
        text: durSec >= 1 ? `${durSec.toFixed(2)}s` : `${node.duration_ms.toFixed(0)}ms`
      });
    }
    
    // Usage tokens/cost badge
    if (node.usage?.total_tokens) {
      badges.push({
        icon: <Activity size={10} className="opacity-70" />,
        text: `${node.usage.total_tokens} tok`
      });
    }
    
    // Model badge
    if (node.model) {
      badges.push({
        text: node.model,
        isModel: true
      });
    }
    
    return badges;
  }, [node]);

  if (viewMode === "tree") {
    return (
      <div className="border-b border-black/[0.04] last:border-0 bg-white/30 font-sans">
        <div 
          className={`flex items-center justify-between p-3 hover:bg-black/[0.02] cursor-pointer text-xs mb-0.5 transition-all`}
          style={{ paddingLeft: `${level * 14 + 10}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Left Side: Tree Toggle & Names */}
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div className="w-4 h-4 mt-0.5 flex items-center justify-center text-neutral-400 hover:text-[#1d1d1f] transition-colors rounded">
              {hasChildren && (
                expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
              )}
            </div>
            
            <div className={`p-1 rounded-lg mt-0.5 shrink-0 ${
              isError
                ? "text-red-500 bg-red-50"
                : node.is_obs
                ? "text-blue-500 bg-blue-50"
                : "text-emerald-500 bg-emerald-50"
            }`}>
              {node.is_obs ? <Terminal size={12} /> : <Layers size={12} />}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate text-[#1d1d1f] font-mono text-[11px]">{node.name}</span>
              <span className="text-[9px] text-[#6e6e73] font-bold uppercase tracking-wider mt-0.5 self-start">
                  {node.type}
              </span>
              
              {/* Metadata Badges line */}
              {metadataBadges.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap opacity-80">
                  {metadataBadges.map((badge, idx) => (
                    <span 
                      key={idx} 
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
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

          {/* Right Side: Evaluation buttons */}
          <div className="flex items-center gap-4 flex-none font-mono text-[10px]">
              <div className="flex items-center gap-2 text-[#6e6e73]">
                  <button 
                      onClick={(e) => { e.stopPropagation(); onEvaluate(); }}
                      className="hover:text-[#0071e3] transition-colors hover:bg-neutral-100 p-1.5 rounded-lg group flex items-center gap-1 z-10 border border-transparent hover:border-black/[0.04] bg-white shadow-sm cursor-pointer"
                      title="Evaluate Node"
                  >
                      <Activity size={12} className="text-neutral-500 group-hover:text-[#0071e3]" />
                      <span className="text-[9px] font-bold">Eval</span>
                  </button>
                  <span className="opacity-70">{new Date(node.start_time).toLocaleTimeString()}</span>
              </div>
          </div>
        </div>

        {expanded && (
          <>
              {/* Detail View for Inputs/Outputs if available */}
              {(node.input || node.output || node.error) && (
                   <div style={{ marginLeft: `${level * 14 + 34}px` }} className="p-3 mb-2 bg-neutral-50 border border-black/[0.03] rounded-xl text-xs overflow-x-auto max-w-2xl font-mono text-[#6e6e73]">
                      {node.input && (
                          <div className="mb-1.5">
                              <span className="font-bold text-[#1d1d1f]">Input: </span>
                              <pre className="inline text-[#6e6e73] whitespace-pre-wrap">{node.input}</pre>
                          </div>
                      )}
                      {node.output && (
                          <div>
                               <span className="font-bold text-[#1d1d1f]">Output: </span>
                               <pre className="inline text-[#6e6e73] whitespace-pre-wrap">{node.output}</pre>
                          </div>
                      )}
                      {node.error && (
                           <div className="text-red-600 mt-1.5">
                               <span className="font-bold">Error: </span>
                               <pre className="inline text-red-600 whitespace-pre-wrap">{node.error}</pre>
                          </div>
                      )}
                   </div>
              )}
              
              {/* Children */}
              {node.children.map(child => (
                  <TreeNode 
                    key={child.id} 
                    node={child} 
                    level={level + 1} 
                    onEvaluate={onEvaluate} 
                    traceDurationStats={traceDurationStats}
                    viewMode={viewMode}
                  />
              ))}
          </>
        )}
      </div>
    );
  }

  // Waterfall Mode (Image 1 style)
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
        className="group relative flex items-center h-8 rounded-lg cursor-pointer transition-all border border-transparent hover:bg-black/[0.01]"
        style={{ paddingLeft: "70px" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Waterfall capsule timeline track container */}
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

        {/* Action icons hover overlay */}
        <div className="absolute right-2 inset-y-0 flex items-center gap-2 z-30 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={(e) => { e.stopPropagation(); onEvaluate(); }}
                className="text-[#6e6e73] hover:text-[#0071e3] transition-colors hover:bg-neutral-100 p-1.5 rounded-lg border border-black/[0.04] bg-white shadow-sm cursor-pointer flex items-center gap-1"
                title="Evaluate Node"
            >
                <Activity size={12} />
                <span className="text-[9px] font-bold">Eval</span>
            </button>
        </div>
      </div>

      {expanded && (
        <>
            {/* Detail View for Inputs/Outputs if available in waterfall mode too */}
            {(node.input || node.output || node.error) && (
                 <div style={{ marginLeft: `${level * 14 + 34}px` }} className="p-3 mb-2 mt-1 bg-neutral-50 border border-black/[0.03] rounded-xl text-xs overflow-x-auto max-w-2xl font-mono text-[#6e6e73]">
                    {node.input && (
                        <div className="mb-1.5">
                            <span className="font-bold text-[#1d1d1f]">Input: </span>
                            <pre className="inline text-[#6e6e73] whitespace-pre-wrap">{node.input}</pre>
                        </div>
                    )}
                    {node.output && (
                        <div>
                             <span className="font-bold text-[#1d1d1f]">Output: </span>
                             <pre className="inline text-[#6e6e73] whitespace-pre-wrap">{node.output}</pre>
                        </div>
                    )}
                    {node.error && (
                         <div className="text-red-600 mt-1.5">
                             <span className="font-bold">Error: </span>
                             <pre className="inline text-red-600 whitespace-pre-wrap">{node.error}</pre>
                        </div>
                    )}
                 </div>
            )}

            {node.children.map(child => (
                <TreeNode 
                  key={child.id} 
                  node={child} 
                  level={level + 1} 
                  onEvaluate={onEvaluate} 
                  traceDurationStats={traceDurationStats}
                  viewMode={viewMode}
                />
            ))}
        </>
      )}
    </div>
  );
}
