"use client";

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Circle, Clock, AlertCircle, Play, Activity } from 'lucide-react';
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
}

export default function TraceTree({ spans, observations, traceId }: { spans: any[], observations: any[], traceId?: string }) {
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalTarget, setEvalTarget] = useState<Node | 'trace' | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState<string>("");
  const [evalInputs, setEvalInputs] = useState<Record<string, string>>({});
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);

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
        is_obs: true
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

  return (
    <div className="space-y-4">
      {traceId && (
          <div className="flex justify-end fade-in animate-in">
             <Button onClick={() => openEvalModal('trace')} variant="outline" className="gap-2 shadow-sm" size="sm">
                <Activity size={16} /> Evaluate Trace
             </Button>
          </div>
      )}

      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
        {rootNodes.map(node => (
          <TreeNode key={node.id} node={node} level={0} onEvaluate={() => openEvalModal(node)} />
        ))}
        {rootNodes.length === 0 && <div className="p-4 text-center text-muted">No data to display</div>}
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

function TreeNode({ node, level, onEvaluate }: { node: Node, level: number, onEvaluate: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  const isError = node.error || node.status === 'ERROR';

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <div 
        className={`flex items-center gap-2 p-2 hover:bg-[var(--background-subtle)] cursor-pointer text-sm font-mono`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-4 h-4 flex items-center justify-center text-muted">
          {hasChildren && (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <div className={`p-1 rounded ${isError ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {isError ? <AlertCircle size={14} /> : <Circle size={10} />}
        </div>

        <span className="font-semibold">{node.name}</span>
        <span className="text-xs text-muted px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]">
            {node.type}
        </span>
        
        <div className="ml-auto flex items-center justify-end gap-3 text-xs text-muted">
            <button 
                onClick={(e) => { e.stopPropagation(); onEvaluate(); }}
                className="hover:text-primary transition-colors hover:bg-muted p-1 rounded group flex items-center gap-1 z-10"
                title="Evaluate Node"
            >
                <Activity size={14} />
                <span className="hidden group-hover:inline text-[10px] font-semibold">Eval</span>
            </button>
            {node.duration_ms !== undefined && (
                <span className="flex items-center gap-1">
                    <Clock size={12} /> {node.duration_ms.toFixed(2)}ms
                </span>
            )}
            <span>{new Date(node.start_time).toLocaleTimeString()}</span>
        </div>
      </div>

      {expanded && (
        <>
            {/* Detail View for Inputs/Outputs if available */}
            {(node.input || node.output || node.error) && (
                 <div style={{ marginLeft: `${level * 16 + 32}px` }} className="p-2 mb-2 bg-[var(--background-subtle)] rounded text-xs overflow-x-auto">
                    {node.input && (
                        <div className="mb-1">
                            <span className="font-bold text-muted">Input: </span>
                            <pre className="inline">{node.input}</pre>
                        </div>
                    )}
                    {node.output && (
                        <div>
                             <span className="font-bold text-muted">Output: </span>
                             <pre className="inline">{node.output}</pre>
                        </div>
                    )}
                    {node.error && (
                         <div className="text-red-600 mt-1">
                             <span className="font-bold">Error: </span>
                             <pre className="inline">{node.error}</pre>
                        </div>
                    )}
                 </div>
            )}
            
            {/* Children */}
            {node.children.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} onEvaluate={onEvaluate} />
            ))}
        </>
      )}
    </div>
  );
}
