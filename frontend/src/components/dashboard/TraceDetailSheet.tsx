"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
    X, ChevronRight, ChevronDown, Box, Layers, Clock, 
    AlertCircle, Copy, Terminal, Database, Cpu 
} from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn exists or I'll provide a fallback

import api from '@/lib/api';

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
}

export default function TraceDetailSheet({ isOpen, onClose, traceId }: TraceDetailSheetProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [data, setData] = useState<{ spans: any[], observations: any[] } | null>(null);
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

        // 2. Create Nodes for all Observations
        // And build a map of SpanID -> ObsID replacement
        const spanToObsMap = new Map<string, string>();
        
        const safeJson = (val: any) => {
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                try { return JSON.parse(val); } catch (e) { return val; }
            }
            return val;
        };
    
        observations.forEach(obs => {
          const obsId = String(obs.id);
          nodeMap.set(obsId, {
            id: obsId,
            name: obs.name || 'Generation',
            type: obs.type || 'OBSERVATION',
            start_time: obs.start_time,
            end_time: obs.end_time,
            duration_ms: (new Date(obs.end_time).getTime() - new Date(obs.start_time).getTime()),
            error: obs.error,
            input: safeJson(obs.input),
            output: safeJson(obs.output),
            model: obs.model,
            usage: safeJson(obs.usage),
            children: [],
            is_obs: true
          });
        });

        // 3. Identify Replacements (Span -> Obs)
        spans.forEach(span => {
           const obsId = span.attributes?.['observation_id'];
           if (obsId && nodeMap.has(String(obsId))) {
               spanToObsMap.set(span.span_id, String(obsId));
           }
        });

        const roots: Node[] = [];
        const processedNodes = new Set<string>();

        // 4. Build Tree using Span Hierarchy (with Replacements)
        spans.forEach(span => {
            // Determine which node represents this span (itself or its replacement Obs)
            const selfId = spanToObsMap.get(span.span_id) || span.span_id;
            const selfNode = nodeMap.get(selfId);

            if (!selfNode) return; // Should not happen
            
            processedNodes.add(selfId);

            // Determine Parent Node
            if (span.parent_span_id) {
                // If parent exists, find *its* representative node
                const parentId = spanToObsMap.get(span.parent_span_id) || span.parent_span_id;
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
        observations.forEach(obs => {
            const obsId = String(obs.id);
            if (!processedNodes.has(obsId)) {
                // This Obs was not used as a replacement for a Span.
                // Try to link it via parent_observation_id
                const node = nodeMap.get(obsId)!;
                const parentId = obs.parent_observation_id ? String(obs.parent_observation_id) : null;
                
                if (parentId && nodeMap.has(parentId)) {
                    nodeMap.get(parentId)!.children.push(node);
                } else {
                    // If not linked, check if it should be root
                     if (!roots.includes(node)) roots.push(node);
                }
            }
        });

        const sortNodes = (nodes: Node[]) => {
            nodes.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            nodes.forEach(n => sortNodes(n.children));
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
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
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
            <div className="relative w-[85vw] max-w-6xl h-full bg-[#09090b] text-[#e4e4e7] shadow-2xl flex flex-col border-l border-[#27272a] animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex-none h-14 border-b border-[#27272a] flex items-center justify-between px-6 bg-[#09090b]">
                   <div className="flex items-center gap-4">
                       <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20 flex items-center gap-1.5">
                           <Box size={12}/> Trace
                       </div>
                       <span className="font-mono text-sm text-[#a1a1aa]">{traceId}</span>
                   </div>
                   <button 
                       onClick={onClose}
                       className="p-2 hover:bg-[#27272a] rounded-md text-[#a1a1aa] hover:text-white transition-colors"
                   >
                       <X size={18} />
                   </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-[#a1a1aa] border-t-transparent rounded-full"></div>
                    </div>
                ) : (
                   <div className="flex-1 flex overflow-hidden">
                       {/* Left Pane: Tree */}
                       <div className="w-[350px] flex-none border-r border-[#27272a] flex flex-col bg-[#0c0c0e]">
                            <div className="p-3 border-b border-[#27272a] text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider flex items-center justify-between">
                                <span>Execution Tree</span>
                                <span className="text-[10px] bg-[#27272a] px-1.5 rounded">{rootNodes.length} roots</span>
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
                       <div className="flex-1 overflow-y-auto bg-[#09090b]">
                            {selectedNode ? <NodeDetailView node={selectedNode} /> : (
                                <div className="h-full flex flex-col items-center justify-center text-[#a1a1aa]">
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

function TreeNode({ node, depth, selectedId, onSelect }: { node: Node, depth: number, selectedId: string | null, onSelect: (id: string) => void }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children.length > 0;
    const isSelected = node.id === selectedId;
    const isError = node.error || node.status === 'ERROR';

    return (
        <div className="select-none relative">
            {/* Visual guide line for hierarchy could go here */}
            <div 
                className={`
                    group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-sm mb-0.5 transition-all
                    ${isSelected ? 'bg-[#27272a] text-white ring-1 ring-[#3f3f46]' : 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]'}
                `}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => {
                    onSelect(node.id);
                }}
            >
                <div 
                    className={`w-4 h-4 flex items-center justify-center rounded hover:bg-[#3f3f46]/50 ${hasChildren ? 'visible' : 'invisible'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>

                <div className={`shrink-0 ${isError ? 'text-red-500' : (node.is_obs ? 'text-blue-400' : 'text-emerald-400')}`}>
                    {node.is_obs ? <Terminal size={14} /> : <Layers size={14} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className={`truncate font-mono text-xs ${isSelected ? 'font-semibold' : ''} ${isError ? 'text-red-400' : ''}`}>
                            {node.name}
                        </span>
                    </div>
                     <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono mt-0.5">
                        <span>{node.duration_ms.toFixed(0)}ms</span>
                        {/* Cost/Tokens could be shown here if available in node */}
                        {node.usage?.total_tokens && <span>{node.usage.total_tokens}tok</span>}
                    </div>
                </div>
            </div>
            
            {expanded && (
                <div className="relative">
                    {/* Vertical line for children */}
                    {hasChildren && (
                        <div 
                            className="absolute bg-[#27272a] w-px top-0 bottom-2"
                            style={{ left: `${depth * 16 + 15}px`, zIndex: 0 }}
                        />
                    )}
                    {node.children.map(child => (
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
        { id: 'preview', label: 'Preview' },
        { id: 'log', label: 'Log View' }
    ];
    const [activeSection, setActiveSection] = useState('preview');

    return (
        <div className="p-6 max-w-4xl mx-auto">
             {/* Node Header */}
             <div className="mb-8">
                 <div className="flex items-center gap-3 mb-4">
                     <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
                         {node.is_obs ? <Terminal className="text-blue-400" /> : <Layers className="text-emerald-400" />}
                         {node.name}
                         <span className="text-xs font-normal text-[#71717a] border border-[#27272a] px-1.5 py-0.5 rounded ml-2">ID: {node.id.slice(0, 8)}</span>
                     </h2>
                 </div>
                 
                 {/* Metrics Bar */}
                 <div className="flex items-center gap-4 text-xs font-mono text-[#a1a1aa] bg-[#27272a]/30 p-3 rounded-lg border border-[#27272a]">
                     <div className="flex items-center gap-1.5">
                         <Clock size={14} className="text-[#71717a]" />
                         <span className="text-white">{node.duration_ms.toFixed(3)}s</span>
                     </div>
                     <div className="w-px h-4 bg-[#3f3f46]" />
                     <div className="flex items-center gap-1.5">
                         <span className="text-[#71717a]">Tokens</span>
                         <span className="text-white">{node.usage?.total_tokens || 0}</span>
                     </div>
                     <div className="w-px h-4 bg-[#3f3f46]" />
                     <div className="flex items-center gap-1.5">
                         <span className="text-[#71717a]">Cost</span>
                         <span className="text-white">$0.00000</span>
                     </div>
                     {node.model && (
                         <>
                             <div className="w-px h-4 bg-[#3f3f46]" />
                             <div className="flex items-center gap-1.5">
                                 <Cpu size={14} className="text-[#71717a]" />
                                 <span className="text-blue-400">{node.model}</span>
                             </div>
                         </>
                     )}
                 </div>
             </div>

             {/* Tab Switcher */}
             <div className="flex border-b border-[#27272a] mb-6">
                 {sections.map(s => (
                     <button 
                        key={s.id}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeSection === s.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
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
                 <DataSection title="Metadata" data={{
                     ...node.attributes,
                     start_time: node.start_time,
                     end_time: node.end_time,
                     status: node.status,
                 }} />
             </div>
        </div>
    );
}

function DataSection({ title, data, isOutput }: { title: string, data: any, isOutput?: boolean }) {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return null;

    const isString = typeof data === 'string';
    const content = isString ? data : JSON.stringify(data, null, 2);

    return (
        <div className="rounded-lg border border-[#27272a] overflow-hidden bg-[#0c0c0e]">
            <div className="px-4 py-2 bg-[#27272a]/50 border-b border-[#27272a] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#a1a1aa] uppercase">{title}</span>
                <button className="text-[#71717a] hover:text-white transition-colors" title="Copy">
                    <Copy size={12} />
                </button>
            </div>
            <div className={`p-4 overflow-x-auto text-sm font-mono ${isOutput ? 'text-emerald-400' : 'text-[#e4e4e7]'}`}>
                <pre>{content}</pre>
            </div>
        </div>
    );
}
