"use client";

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Circle, Clock, AlertCircle } from 'lucide-react';

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

export default function TraceTree({ spans, observations }: { spans: any[], observations: any[] }) {
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
    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
      {rootNodes.map(node => (
        <TreeNode key={node.id} node={node} level={0} />
      ))}
      {rootNodes.length === 0 && <div className="p-4 text-center text-muted">No data to display</div>}
    </div>
  );
}

function TreeNode({ node, level }: { node: Node, level: number }) {
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
        
        <div className="ml-auto flex items-center gap-4 text-xs text-muted">
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
                <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
        </>
      )}
    </div>
  );
}
