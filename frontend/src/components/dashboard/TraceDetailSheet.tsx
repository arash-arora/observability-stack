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
  Wrench
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
                <NodeDetailView node={selectedNode} traceData={data} />
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
