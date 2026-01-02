"use client";

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Circle, Clock, AlertCircle, Box, Code, Layers } from 'lucide-react';

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
  attributes?: any;
  children: Node[];
  is_obs?: boolean;
}

export default function TraceView({ spans, observations }: { spans: any[], observations: any[] }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Parse nodes (reusing logic but ensuring safety)
  const rootNodes = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    
    // Helper to safely parse JSON if needed, though mostly strings in db
    const safeJson = (val: any) => {
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
    };

    spans.forEach(span => {
      nodeMap.set(span.span_id, {
        id: span.span_id,
        name: span.name,
        type: span.kind || 'SPAN',
        start_time: span.start_time,
        end_time: span.end_time,
        duration_ms: span.duration_ms,
        status: span.status_code,
        attributes: span.attributes,
        children: []
      });
    });

    observations.forEach(obs => {
      const start = new Date(obs.start_time).getTime();
      const end = new Date(obs.end_time).getTime();
      nodeMap.set(obs.id, {
        id: obs.id,
        name: obs.name || 'Generation',
        type: obs.type || 'OBSERVATION',
        start_time: obs.start_time,
        end_time: obs.end_time,
        duration_ms: end - start,
        error: obs.error,
        input: safeJson(obs.input),
        output: safeJson(obs.output),
        children: [],
        is_obs: true
      });
    });

    const roots: Node[] = [];

    // Linkage (Simplified for speed)
    spans.forEach(span => {
      const node = nodeMap.get(span.span_id)!;
      if (span.parent_span_id && nodeMap.has(span.parent_span_id)) {
        nodeMap.get(span.parent_span_id)!.children.push(node);
      } else {
        if (!span.parent_span_id) roots.push(node);
      }
    });

    observations.forEach(obs => {
      const node = nodeMap.get(obs.id)!;
      // Heuristic: If observation has parent that is in map (span or obs), link it.
      // Currently our demo might not strictly link obs->span via parent_id matches in this list logic.
      // But let's check:
      if (obs.parent_observation_id && nodeMap.has(obs.parent_observation_id)) {
         nodeMap.get(obs.parent_observation_id)!.children.push(node);
      } else {
         // Check if trace has a root span and this is a "root" observation? 
         // For now, push to roots if not linked.
         if (!obs.parent_observation_id) roots.push(node);
      }
    });

    // Sort by start time
    const sortNodes = (nodes: Node[]) => {
        nodes.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);
    
    return roots;
  }, [spans, observations]);

  // Initial selection
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

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Left Pane: Tree */}
      <div className="w-1/3 border-r border-[var(--border)] flex flex-col bg-[var(--background-subtle)]">
        <div className="p-3 border-b border-[var(--border)] text-sm font-semibold text-[var(--foreground-muted)]">
            Trace Structure
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            {rootNodes.map(node => (
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
      <div className="flex-1 overflow-y-auto bg-[var(--background)]">
        {selectedNode ? (
            <NodeDetails node={selectedNode} />
        ) : (
            <div className="h-full flex items-center justify-center text-[var(--foreground-muted)]">
                Select a span or observation to view details
            </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({ node, depth, selectedId, onSelect }: { node: Node, depth: number, selectedId: string | null, onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isError = node.error || node.status === 'ERROR';

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors ${
            isSelected ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'hover:bg-[var(--background)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
            onSelect(node.id);
            if (hasChildren && !expanded && !isSelected) setExpanded(true); // Auto expand on click if collapsed
        }}
      >
        <div 
            className="w-4 h-4 flex items-center justify-center hover:text-[var(--foreground)]"
            onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
            }}
        >
          {hasChildren && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </div>
        
        {/* Icon based on type */}
        <div className={`
             ${isError ? 'text-red-500' : (node.is_obs ? 'text-blue-500' : 'text-purple-500')}
        `}>
            {node.is_obs ? <Box size={14} /> : <Layers size={14} />}
        </div>

        <span className={`truncate font-mono text-xs ${isSelected ? 'font-medium' : ''}`}>
            {node.name}
        </span>

        {node.duration_ms !== undefined && (
            <span className="ml-auto text-[10px] text-[var(--foreground-muted)] opacity-70">
                {node.duration_ms.toFixed(0)}ms
            </span>
        )}
      </div>

      {expanded && node.children.map(child => (
        <TreeNode 
            key={child.id} 
            node={child} 
            depth={depth + 1} 
            selectedId={selectedId} 
            onSelect={onSelect} 
        />
      ))}
    </div>
  );
}

function NodeDetails({ node }: { node: Node }) {
    const DetailBlock = ({ title, data, code = false }: any) => {
        if (!data) return null;
        return (
            <div className="mb-6">
                <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    {title}
                </h3>
                <div className={`rounded-md border border-[var(--border)] bg-[var(--background-subtle)] overflow-hidden text-sm ${code ? 'font-mono' : ''}`}>
                    {code ? (
                         <div className="p-3 bg-[#0d1117] overflow-x-auto text-[var(--foreground)]">
                            <pre>{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
                        </div>
                    ) : (
                        <div className="p-3 text-[var(--foreground)]">{data}</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            <header className="mb-6 border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-md ${node.error ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {node.is_obs ? <Box size={20} /> : <Layers size={20} />}
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">{node.name}</h1>
                        <div className="flex items-center gap-3 text-xs text-[var(--foreground-muted)] mt-1 font-mono">
                            <span className="bg-[var(--accent)] px-1.5 py-0.5 rounded">{node.type}</span>
                            <span>ID: {node.id.substring(0,8)}</span>
                            <span className="flex items-center gap-1"><Clock size={12}/> {node.duration_ms?.toFixed(2)}ms</span>
                        </div>
                    </div>
                </div>
                {node.error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm flex items-start gap-2">
                         <AlertCircle size={16} className="mt-0.5 shrink-0" />
                         <div>
                            <div className="font-semibold">Error Status</div>
                            <div className="font-mono text-xs mt-1">{node.error} {node.status}</div>
                         </div>
                    </div>
                )}
            </header>

            <DetailBlock title="Input" data={node.input} code={true} />
            <DetailBlock title="Output" data={node.output} code={true} />
            
            {(node.attributes && Object.keys(node.attributes).length > 0) && (
                <DetailBlock title="Attributes" data={node.attributes} code={true} />
            )}

             <DetailBlock title="Metadata" data={{
                 start_time: node.start_time,
                 end_time: node.end_time,
                 status: node.status,
                 type: node.type
             }} code={true} />
        </div>
    );
}
