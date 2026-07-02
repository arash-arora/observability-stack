"use client";

import { useState, useMemo, useEffect } from "react";
import EvaluationModal from "./EvaluationModal";
import {
  X,
  ChevronRight,
  ChevronDown,
  Box,
  Layers,
  Clock,
  Copy,
  Terminal,
  Cpu,
  Play,
  FlaskConical,
  Check,
  Bot,
  Wrench,
  LayoutList,
  Activity
} from "lucide-react";

import api from "@/lib/api";
import { extractContent, extractSystemMessage, safeParseJSON } from "@/lib/traceUtils";

interface TraceDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  traceId: string | null;
}

interface Node {
  id: string;
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status?: string;
  error?: string;
  input?: any;
  output?: any;
  attributes?: any;
  model?: string;
  usage?: any;
  children: Node[];
  is_obs?: boolean;
  total_cost?: number;
  application_name?: string;
}

export default function TraceDetailSheet({
  isOpen,
  onClose,
  traceId,
}: TraceDetailSheetProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [data, setData] = useState<{
    spans: any[];
    observations: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullTraceEvalOpen, setIsFullTraceEvalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "waterfall">("tree");

  // Fetch details when traceId changes
  useEffect(() => {
    const fetchDetails = async () => {
      if (!traceId || !isOpen) return;
      try {
        setLoading(true);
        const res = await api.get(`/analytics/traces/${traceId}`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch trace details:", err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && traceId) {
      fetchDetails();
    } else {
      setData(null); // Reset on close
    }
  }, [traceId, isOpen]);

  // Build Tree
  const rootNodes = useMemo(() => {
    if (!data) return [];
    const { spans, observations } = data;
    const nodeMap = new Map<string, Node>();

    // 1. Create Nodes for all Spans
    spans.forEach((span) => {
      nodeMap.set(span.span_id, {
        id: span.span_id,
        name: span.name,
        type: span.kind || "SPAN",
        start_time: span.start_time,
        end_time: span.end_time,
        duration_ms: span.duration_ms,
        status: span.status_code,
        attributes: span.attributes,
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

        // CRITICAL: Merge Span attributes into Obs attributes
        // Span attributes are often cleaner (valid JSON object) than Obs metadata_json (sometimes broken string)
        const obsNode = nodeMap.get(String(obsId));
        if (obsNode) {
            const currentAttrs = (typeof obsNode.attributes === 'object' && obsNode.attributes !== null)
                ? obsNode.attributes
                : {}; // Discard broken string attributes
            
            obsNode.attributes = {
                ...currentAttrs,
                ...span.attributes
            };
            // Propagate application_name if span has it and obs doesn't (or overwrite?)
            if (span.application_name) {
                obsNode.application_name = span.application_name;
            }
        }
      }
    });

    const roots: Node[] = [];
    const processedNodes = new Set<string>();

    // 4. Build Tree using Span Hierarchy (with Replacements)
    spans.forEach((span) => {
      // Determine which node represents this span (itself or its replacement Obs)
      const selfId = spanToObsMap.get(span.span_id) || span.span_id;
      const selfNode = nodeMap.get(selfId);

      if (!selfNode) return; // Should not happen

      processedNodes.add(selfId);

      // Determine Parent Node
      if (span.parent_span_id) {
        // If parent exists, find *its* representative node
        const parentId =
          spanToObsMap.get(span.parent_span_id) || span.parent_span_id;
        const parentNode = nodeMap.get(parentId);

        if (parentNode) {
          // Avoid duplicates if multiple spans map to same structure (unlikely in standardized trace)
          if (!parentNode.children.includes(selfNode)) {
            parentNode.children.push(selfNode);
          }
        } else {
          // Parent missing? Treat as root
          if (!roots.includes(selfNode)) roots.push(selfNode);
        }
      } else {
        // No parent span -> Root
        if (!roots.includes(selfNode)) roots.push(selfNode);
      }
    });

    // 5. Cleanup: Add any Observations that weren't linked via Spans (orphans?)
    // e.g. Observations that might rely on parent_observation_id instead of spans
    observations.forEach((obs) => {
      const obsId = String(obs.id);
      if (!processedNodes.has(obsId)) {
        // This Obs was not used as a replacement for a Span.
        // Try to link it via parent_observation_id
        const node = nodeMap.get(obsId)!;
        const parentId = obs.parent_observation_id
          ? String(obs.parent_observation_id)
          : null;

        if (parentId && nodeMap.has(parentId)) {
          nodeMap.get(parentId)!.children.push(node);
        } else {
          // If not linked, check if it should be root
          if (!roots.includes(node)) roots.push(node);
        }
      }
    });

    const sortNodes = (nodes: Node[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }, [data]);

  const traceDurationStats = useMemo(() => {
    return getTraceDurationStats(data);
  }, [data]);

  const timelineTicks = useMemo(() => {
    if (!traceDurationStats) return [];
    return getTimelineTicks(traceDurationStats.duration);
  }, [traceDurationStats]);

  // Update selection when data loads
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

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end isolate">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Panel */}
      <div className="relative w-[85vw] max-w-6xl h-full bg-background text-foreground shadow-2xl flex flex-col border-l border-border animate-slide-in-from-right">
        {/* Header */}
        <div className="flex-none h-14 border-b border-border flex items-center justify-between px-6 bg-background">
          <div className="flex items-center gap-4">
            <div className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium border border-primary/20 flex items-center gap-1.5">
              <Box size={12} /> Trace
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              {traceId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
               disabled={loading || !data}
               onClick={() => setIsFullTraceEvalOpen(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
                <FlaskConical size={14} />
                Evaluate Trace
            </button>
            <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
                <X size={18} />
            </button>
          </div>
        </div>

        {/* Full Trace Evaluation Modal */}
        <EvaluationModal 
            isOpen={isFullTraceEvalOpen}
            onClose={() => setIsFullTraceEvalOpen(false)}
            initialData={{
                input: "",
                output: "",
                context: "",
                application_name: "", // Extract?
                trace: data,
                workflow_details: extractWorkflowDetails(data),
                isTraceEvaluation: true
            }}
            defaultObserve={true}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane: Tree */}
            <div className="w-[450px] flex-none border-r border-black/[0.04] flex flex-col bg-neutral-50/50">
              <div className="p-3 border-b border-black/[0.04] flex items-center justify-between bg-white/30 h-12 shrink-0">
                <span className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-widest">
                  Trace
                </span>

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
              </div>

              {/* Dynamic Waterfall ruler ticks at the top of the timeline track */}
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

              <div className="flex-1 overflow-y-auto p-3 space-y-0.5 relative">
                {/* Dashed vertical guidelines for Gantt timing */}
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
                  {rootNodes.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      selectedId={selectedNodeId}
                      onSelect={setSelectedNodeId}
                      traceDurationStats={traceDurationStats}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 overflow-y-auto bg-white">
              {selectedNode ? (
                <NodeDetailView node={selectedNode} traceData={data} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#6e6e73]">
                  <Layers size={48} className="opacity-20 mb-4 animate-pulse" />
                  <p className="text-xs font-semibold">Select a waterfall node to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compute trace Duration limit stats
function getTraceDurationStats(data: any) {
  if (!data || (!data.spans?.length && !data.observations?.length)) return null;
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
  
  data.spans?.forEach((s: any) => {
    checkTime(s.start_time);
    checkTime(s.end_time);
  });
  data.observations?.forEach((o: any) => {
    checkTime(o.start_time);
    checkTime(o.end_time);
  });
  
  if (minStart === Infinity || maxEnd === -Infinity) return null;
  return {
    startTime: minStart,
    endTime: maxEnd,
    duration: maxEnd - minStart || 1
  };
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
  // Add fallback first/last ticks if empty
  if (ticks.length === 0) {
    ticks.push({ label: "0s", position: 0 });
    ticks.push({ label: `${(durationMs).toFixed(0)}ms`, position: 100 });
  }
  return ticks;
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  traceDurationStats,
  viewMode,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  traceDurationStats: any;
  viewMode: "tree" | "waterfall";
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isError = node.error || node.status === "ERROR";

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
    if (node.usage?.total_tokens || node.usage?.prompt_tokens) {
      const tokens = node.usage.total_tokens || (node.usage.prompt_tokens + (node.usage.completion_tokens || 0));
      const costText = node.total_cost ? ` / $${node.total_cost.toFixed(4)}` : "";
      badges.push({
        icon: <Activity size={10} className="opacity-70" />,
        text: `${tokens} tok${costText}`
      });
    } else if (node.total_cost) {
      badges.push({
        icon: <Activity size={10} className="opacity-70" />,
        text: `$${node.total_cost.toFixed(4)}`
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
      <div className="select-none relative font-sans">
        <div
          className={`
            group flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer text-xs mb-0.5 transition-all
            ${
              isSelected
                ? "bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]/20"
                : "text-[#1d1d1f] hover:bg-black/[0.02]"
            }
          `}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
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

            <div
              className={`shrink-0 mt-0.5 ${
                isError
                  ? "text-red-500"
                  : node.is_obs
                  ? "text-blue-500"
                  : "text-emerald-500"
              }`}
            >
              {node.is_obs ? <Terminal size={13} /> : <Layers size={13} />}
            </div>

            <div className="flex flex-col min-w-0">
              <span
                className={`truncate font-mono text-[11px] ${
                  isSelected ? "font-bold text-[#0071e3]" : "font-semibold"
                } ${isError ? "text-red-600" : ""}`}
                title={node.name}
              >
                {node.name}
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
        </div>

        {expanded && (
          <div className="relative">
            {hasChildren && (
              <div
                className="absolute bg-black/[0.04] w-px top-0 bottom-2.5"
                style={{ left: `${depth * 14 + 17}px`, zIndex: 0 }}
              />
            )}
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                traceDurationStats={traceDurationStats}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Waterfall Mode (Image 1 style)
  return (
    <div className="select-none relative w-full font-sans">
      <div 
        className="absolute left-0 top-0 h-8 flex items-center z-20 pointer-events-none"
        style={{ width: `${depth * 14 + 20}px` }}
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
        className={`
          group relative flex items-center h-8 rounded-lg cursor-pointer transition-all border border-transparent
          ${
            isSelected
              ? "bg-[#0071e3]/5 border-[#0071e3]/10"
              : "hover:bg-black/[0.01]"
          }
        `}
        style={{ paddingLeft: "70px" }}
        onClick={() => onSelect(node.id)}
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
                    <span className="opacity-80 shrink-0 font-semibold">{(node.duration_ms / 1000).toFixed(2)}s</span>
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
                  <span className="text-[#6e6e73] font-semibold opacity-60">{(node.duration_ms / 1000).toFixed(2)}s</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="relative">
          {hasChildren && (
            <div
              className="absolute bg-black/[0.04] w-px top-0 bottom-3"
              style={{ left: `${depth * 14 + 7}px`, zIndex: 0 }}
            />
          )}
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              traceDurationStats={traceDurationStats}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeDetailView({ node, traceData }: { node: Node; traceData: any }) {
  const sections = [
    { id: "preview", label: "Preview" },
    { id: "log", label: "Log View" },
  ];
  const [activeSection, setActiveSection] = useState("preview");
  const [isEvalOpen, setIsEvalOpen] = useState(false);

  // Helper to stringify data for the modal
  const prepareData = (val: any) => {
      if (!val) return "";
      if (typeof val === 'string') return val;
      return JSON.stringify(val, null, 2);
  };

  // Check if evaluation is possible (needs input and output OR trace data)
  const canEvaluate = Boolean(
      (node.input && 
      node.output && 
      (typeof node.input === 'string' ? node.input.trim().length > 0 : Object.keys(node.input).length > 0) &&
      (typeof node.output === 'string' ? node.output.trim().length > 0 : Object.keys(node.output).length > 0)) ||
      (traceData && (traceData.observations?.length > 0 || traceData.spans?.length > 0))
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <EvaluationModal 
        isOpen={isEvalOpen} 
        onClose={() => setIsEvalOpen(false)}
        initialData={{
            input: prepareData(node.input),
            output: prepareData(node.output),
            context: node.attributes?.context,
            application_name: node.application_name,
            trace: {
                trace_id: traceData?.trace_id,
                observations: [node] // Wrap single node as the only observation for specific eval
            },
            workflow_details: extractWorkflowDetails(traceData)
        }}
        defaultObserve={true}
      />

      {/* Node Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold font-mono text-foreground flex items-center gap-2">
                {node.is_obs ? (
                <Terminal className="text-blue-500" />
                ) : (
                <Layers className="text-emerald-500" />
                )}
                {node.name}

                {/* Agent/Tool Badges */}
                {node.type?.toLowerCase() === 'agent' && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[10px] border border-purple-500/20 font-medium uppercase tracking-wide ml-2">
                        <Bot size={12} /> Agent
                    </span>
                )}
                {node.type?.toLowerCase() === 'tool' && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] border border-amber-500/20 font-medium uppercase tracking-wide ml-2">
                        <Wrench size={12} /> Tool
                    </span>
                )}

                <span className="text-xs font-normal text-muted-foreground border border-border px-1.5 py-0.5 rounded ml-2">
                ID: {node.id.slice(0, 8)}
                </span>
            </h2>
            </div>
            
            {canEvaluate && (
                <button
                    onClick={() => setIsEvalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-muted text-foreground border border-border rounded-md text-sm font-medium transition-colors"
                >
                    <FlaskConical size={14} className="text-muted-foreground" />
                    Evaluate Node
                </button>
            )}
        </div>

        {/* Metrics Bar */}
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-foreground">
              {node.duration_ms.toFixed(3)}s
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Tokens</span>
            <span className="text-foreground">
              {node.usage?.total_tokens || 0}
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Cost</span>
            <span className="text-foreground">
              $
              {(
                node.total_cost || (node.usage?.total_tokens || 0) * 0.000002
              ).toFixed(5)}
            </span>
          </div>
          {node.model && (
            <>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <Cpu size={14} className="text-muted-foreground" />
                <span className="text-blue-500">{node.model}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === s.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        <DataSection title="System Message" data={extractSystemMessage(node.input)} />
        <DataSection title="Input" data={node.input} />
        <DataSection title="Output" data={node.output} isOutput />
        <DataSection
          title="Metadata"
          data={{
            ...node.attributes,
            start_time: node.start_time,
            end_time: node.end_time,
            status: node.status,
          }}
        />
      </div>
    </div>
  );
}

// Extracted Helper
function extractWorkflowDetails(traceData: any) {
    if (!traceData) return { agents: [], tools: [] };

    // Extract Agents and Tools from the FULL trace data to provide context
    const agentsMap = new Map<string, string>(); // Name -> Description
    const toolsMap = new Map<string, string>();   // Name -> Description
    
    const processEntity = (name: string, desc?: string, map?: Map<string, string>) => {
        if (!name) return;
        const existing = map?.get(name);
        const newDesc = desc || existing || "";
        map?.set(name, newDesc);
    };

    const scan = (items: any[]) => {
        items?.forEach(item => {
            const type = (item.type || item.kind || "").toLowerCase();
            const attrs = item.attributes || {};
            
            // 1. Check for bulk lists (candidate_agents, tools)
            if (attrs.candidate_agents) {
                try {
                    const list = typeof attrs.candidate_agents === 'string' 
                        ? JSON.parse(attrs.candidate_agents) 
                        : attrs.candidate_agents;
                    if (Array.isArray(list)) {
                        list.forEach((a: any) => processEntity(a.name, a.description, agentsMap));
                    }
                } catch (e) {}
            }
            if (attrs.tools) {
                try {
                    const list = typeof attrs.tools === 'string' 
                        ? JSON.parse(attrs.tools) 
                        : attrs.tools;
                    if (Array.isArray(list)) {
                        list.forEach((t: any) => processEntity(t.name, t.description, toolsMap));
                    }
                } catch (e) {}
            }

            // 2. Check individual node
            const desc = attrs.description || attrs.docstring;
            if (type === 'agent') processEntity(item.name, desc, agentsMap);
            if (type === 'tool') processEntity(item.name, desc, toolsMap);
            
            if (attrs.agent_name) processEntity(attrs.agent_name, undefined, agentsMap);
            if (attrs.tool_name) processEntity(attrs.tool_name, undefined, toolsMap);
        });
    };

    scan(traceData.spans || []);
    scan(traceData.observations || []);
    
    // Format: "Name: Description" or just "Name"
    const formatList = (map: Map<string, string>) => {
        return Array.from(map.entries()).map(([name, desc]) => {
            return desc ? `${name}: ${desc}` : name;
        });
    };

    return {
        agents: formatList(agentsMap),
        tools: formatList(toolsMap)
    };
}



function DataSection({
  title,
  data,
  isOutput,
  defaultExpanded = true,
}: {
  title: string;
  data: any;
  isOutput?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  if (!data || (typeof data === "object" && Object.keys(data).length === 0))
    return null;

  let parsed = data;
  if (typeof data === 'string') {
      try {
           if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
               parsed = JSON.parse(data);
           }
      } catch (e) {}
  }

  const extracted = extractContent(parsed);

  const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const textToCopy = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      
      try {
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
      } catch (err) {
          // Fallback
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          document.body.appendChild(textArea);
          textArea.select();
          try {
              document.execCommand('copy');
              setCopied(true);
          } catch (e) {
              console.error('Copy failed', e);
          }
          document.body.removeChild(textArea);
      }
      
      setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (content: any) => {
      // If content is an object (and wasn't extracted to a string), pretty print it
      if (typeof content === 'object' && content !== null) {
          return <pre className="whitespace-pre-wrap font-mono text-sm">{JSON.stringify(content, null, 2)}</pre>;
      }
      
      // If content is a string but looks like JSON object/list, try to pretty print it
      if (typeof content === 'string') {
           const trimmed = content.trim();
           if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
               try {
                   const parsed = JSON.parse(content);
                   return <pre className="whitespace-pre-wrap font-mono text-sm">{JSON.stringify(parsed, null, 2)}</pre>;
               } catch (e) {
                   // Not valid JSON, return as string
               }
           }
      }

      return <div className="whitespace-pre-wrap font-mono text-sm">{content}</div>;
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-muted/10">
      <div 
        className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <span className="text-xs font-semibold text-muted-foreground uppercase select-none">
            {title}
            </span>
        </div>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          onClick={handleCopy}
          title="Copy"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied && <span className="text-[10px] text-green-500 font-medium">Copied</span>}
        </button>
      </div>
      
      {expanded && (
        <div
            className={`p-4 overflow-x-auto text-sm animate-in slide-in-from-top-2 duration-200 ${
            isOutput ? "text-foreground" : "text-muted-foreground"
            }`}
        >
            {renderContent(extracted)}
        </div>
      )}
    </div>
  );
}
