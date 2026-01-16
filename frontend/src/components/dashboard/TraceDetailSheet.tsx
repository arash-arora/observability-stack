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
  FlaskConical
} from "lucide-react";

import api from "@/lib/api";

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

    const safeJson = (val: any) => {
      let curr = val;
      if (typeof curr === 'string') {
        try {
           // 1. Unwrap multiple layers of JSON strings (e.g. "\"{\"a\": 1}\"")
           while (typeof curr === 'string') {
             try {
               const parsed = JSON.parse(curr);
               curr = parsed;
             } catch {
               break; // Stop if it's not valid JSON anymore
             }
           }
        } catch (e) {
           // Ignore
        }
      }

      // 2. Handle Python-style dict strings (e.g. "{'a': 1, 'b': None}")
      // This is a fallback if the result is still a string that looks like an object
      if (typeof curr === 'string' && curr.trim().startsWith('{')) {
          try {
             // Replace single quotes just for keys and simple values? 
             // Global replace is risky but effective for simple cases. 
             // Also handle Python constants.
             // We use a regex sequence to try and target keys and structure quoting.
             let fixed = curr
                .replace(/'/g, '"') // Replace all single quotes with double
                .replace(/True/g, 'true')
                .replace(/False/g, 'false')
                .replace(/None/g, 'null');
             
             return JSON.parse(fixed);
          } catch {
              // If fallback fails, just return strict string
              return curr;
          }
      }
      return curr;
    };

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
        input: safeJson(obs.input),
        output: safeJson(obs.output),
        model: obs.model,
        usage: safeJson(obs.usage),
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
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane: Tree */}
            <div className="w-87.5 flex-none border-r border-border flex flex-col bg-muted/10">
              <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Execution Tree</span>
                <span className="text-[10px] bg-muted px-1.5 rounded text-foreground">
                  {rootNodes.length} roots
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {rootNodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedNodeId}
                    onSelect={setSelectedNodeId}
                  />
                ))}
              </div>
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 overflow-y-auto bg-background">
              {selectedNode ? (
                <NodeDetailView node={selectedNode} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Layers size={48} className="opacity-20 mb-4" />
                  <p>Select a node to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isError = node.error || node.status === "ERROR";

  return (
    <div className="select-none relative">
      {/* Visual guide line for hierarchy could go here */}
      <div
        className={`
                    group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-sm mb-0.5 transition-all
                    ${
                      isSelected
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }
                `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node.id);
        }}
      >
        <div
          className={`w-4 h-4 flex items-center justify-center rounded hover:bg-muted/50 ${
            hasChildren ? "visible" : "invisible"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>

        <div
          className={`shrink-0 ${
            isError
              ? "text-destructive"
              : node.is_obs
              ? "text-blue-500"
              : "text-emerald-500"
          }`}
        >
          {node.is_obs ? <Terminal size={14} /> : <Layers size={14} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className={`truncate font-mono text-xs ${
                isSelected ? "font-semibold" : ""
              } ${isError ? "text-destructive" : ""}`}
            >
              {node.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono mt-0.5">
            <span>{node.duration_ms.toFixed(0)}ms</span>
            {/* Cost/Tokens could be shown here if available in node */}
            {node.usage?.total_tokens && (
              <span>{node.usage.total_tokens}tok</span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="relative">
          {/* Vertical line for children */}
          {hasChildren && (
            <div
              className="absolute bg-border w-px top-0 bottom-2"
              style={{ left: `${depth * 16 + 15}px`, zIndex: 0 }}
            />
          )}
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeDetailView({ node }: { node: Node }) {
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

  // Check if evaluation is possible (needs input and output)
  const canEvaluate = Boolean(
      node.input && 
      node.output && 
      (typeof node.input === 'string' ? node.input.trim().length > 0 : Object.keys(node.input).length > 0) &&
      (typeof node.output === 'string' ? node.output.trim().length > 0 : Object.keys(node.output).length > 0)
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
            application_name: node.application_name
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
                <span className="text-xs font-normal text-muted-foreground border border-border px-1.5 py-0.5 rounded ml-2">
                ID: {node.id.slice(0, 8)}
                </span>
            </h2>
            </div>
            
            {canEvaluate && (
                <button
                    onClick={() => setIsEvalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md text-sm font-medium transition-colors"
                >
                    <FlaskConical size={14} />
                    Evaluate
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

function DataSection({
  title,
  data,
  isOutput,
}: {
  title: string;
  data: any;
  isOutput?: boolean;
}) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0))
    return null;

  let parsed = data;
  if (typeof data === 'string') {
      try {
           // Only parse if it looks like an object/array to avoid parsing simple strings
           if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
               parsed = JSON.parse(data);
           }
      } catch (e) {}
  }

  const renderContent = (content: any) => {
      // 1. Array of messages (Chat History)
      if (Array.isArray(content)) {
          // Check if it looks like a message list
          const isMessageList = content.every(item => typeof item === 'object' && item !== null && ('role' in item || 'content' in item));
          
          if (isMessageList) {
              return (
                  <div className="space-y-4">
                      {content.map((msg, i) => (
                          <div key={i} className="flex flex-col gap-1">
                              {msg.role && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 w-fit px-1.5 rounded">
                                      {msg.role}
                                  </span>
                              )}
                              <div className="whitespace-pre-wrap font-mono text-xs opacity-90 pl-1 border-l-2 border-border">
                                  {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || msg, null, 2)}
                              </div>
                          </div>
                      ))}
                  </div>
              );
          }
      }
      
      // 2. Single Object with 'content' or 'text' key (Common Wrappers)
      if (typeof content === 'object' && content !== null) {
          if ('content' in content && typeof content.content === 'string') {
               return <div className="whitespace-pre-wrap font-mono text-sm">{content.content}</div>;
          }
           if ('text' in content && typeof content.text === 'string') {
               return <div className="whitespace-pre-wrap font-mono text-sm">{content.text}</div>;
          }
      }

      // 3. Fallback: Pretty JSON or String
      const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return <pre className="whitespace-pre-wrap font-mono text-sm">{text}</pre>;
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-muted/10">
      <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          {title}
        </span>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Copy"
          onClick={() => navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2))}
        >
          <Copy size={12} />
        </button>
      </div>
      <div
        className={`p-4 overflow-x-auto text-sm ${
          isOutput ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {renderContent(parsed)}
      </div>
    </div>
  );
}
