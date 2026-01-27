"use client";

import { useCallback, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'; // Added
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; 

import { Button } from "@/components/ui/button";
import { getAgents, getTools, runWorkflow, exportWorkflow, createWorkflow, updateWorkflow } from '@/lib/workflow-api'; // Added updateWorkflow
import { nodeTypes } from './NodeTypes';
import { Bot, Hammer, Save, Play, Download, Loader2, Globe } from 'lucide-react'; // Added Globe
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios'; // For direct fetch if needed, or use a helper

const initialNodes: Node[] = [
  { id: 'start', type: 'start', position: { x: 50, y: 300 }, data: { label: 'Start' } },
  { id: 'end', type: 'end', position: { x: 800, y: 300 }, data: { label: 'End' } },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

function GraphsTabContent() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  const [agents, setAgents] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runInput, setRunInput] = useState("Hello world");
  const [runResult, setRunResult] = useState("");
  const [running, setRunning] = useState(false);
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportedCode, setExportedCode] = useState("");

  // Save Dialog State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  const searchParams = useSearchParams();
  const urlWorkflowId = searchParams.get('workflowId');

  useEffect(() => {
    const fetchData = async () => {
        const [a, t] = await Promise.all([getAgents(), getTools()]);
        setAgents(a);
        setTools(t);
    }
    fetchData();
  }, []);

  // Load Workflow if ID present in URL
  useEffect(() => {
      if (urlWorkflowId && !workflowId) {
          const loadWorkflow = async () => {
              setLoading(true);
              try {
                  // We need a getWorkflow single item API/Endpoint or fetch list and find. 
                  // Since we didn't export getWorkflowById, let's assumingly fetch directly or search list.
                  // For better perf, let's assume we can fetch via generic GET /workflows/id
                  // TODO: Add getWorkflowById to api.
                  // Improvise: fetch all and find (not ideal but works for MVP) or use direct axios
                  const response = await axios.get(`http://localhost:8000/api/v1/workflows/${urlWorkflowId}`);
                  const wf = response.data;
                  
                  if (wf) {
                      setWorkflowId(wf.id);
                      setWorkflowName(wf.name);
                      setWorkflowDescription(wf.description || "");
                      setIsPublished(wf.is_published);
                      
                      if (wf.graph_data) {
                          setNodes(wf.graph_data.nodes || []);
                          setEdges(wf.graph_data.edges || []);
                      }
                  }
              } catch (e) {
                  console.error("Failed to load workflow", e);
              } finally {
                  setLoading(false);
              }
          };
          loadWorkflow();
      }
  }, [urlWorkflowId, workflowId, setNodes, setEdges]);


  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, metaData: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/metadata', JSON.stringify(metaData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const metadataStr = event.dataTransfer.getData('application/metadata');
      
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const metadata = JSON.parse(metadataStr);

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type: type as string,
        position,
        data: { label: metadata.name, ...metadata },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const handleSaveClick = () => {
      setSaveDialogOpen(true);
  };

  const handleSaveConfirm = async () => {
      if (!workflowName) return;
      
      try {
          const graphData = reactFlowInstance.toObject();
          const payload = {
              name: workflowName,
              description: workflowDescription,
              graph_data: graphData
          };

          if (workflowId) {
             await updateWorkflow(workflowId, payload);
          } else {
             const newWf = await createWorkflow(payload);
             setWorkflowId(newWf.id);
          }
          alert("Workflow saved successfully!"); // Replace with toast later
          setSaveDialogOpen(false);
      } catch (error) {
          console.error("Failed to save workflow", error);
          alert("Failed to save workflow");
      }
  };

  const handlePublish = async () => {
       if (!workflowId) {
           alert("Please save the workflow first.");
           setSaveDialogOpen(true);
           return;
       }
       
       try {
           await updateWorkflow(workflowId, { is_published: true });
           setIsPublished(true);
           alert("Workflow Published!");
       } catch (error) {
           console.error("Failed to publish", error);
       }
  };

  const handleRun = async () => {
      setRunning(true);
      setRunResult("");
      try {
          // 1. Save current state first (ensures we define the graph)
          // For MVP, if we have an ID, we update it. If not, we create a temporary one.
          const graphData = reactFlowInstance.toObject();
          
          let targetId = workflowId;
          if (!targetId) {
             const workflow = await createWorkflow({
                name: `Test Run - ${new Date().toISOString()}`,
                description: "Temporary workflow for testing",
                graph_data: graphData
            });
            targetId = workflow.id;
            // Note: we don't setWorkflowId here to avoid locking the user into a "Test Run" workflow if they haven't saved properly
          } else {
              // Update existing
               await updateWorkflow(targetId, { graph_data: graphData });
          }
          
          if (!targetId) {
              throw new Error("Failed to get workflow ID for execution");
          }

          // 2. Run the workflow
          const result = await runWorkflow(targetId, runInput);
          
          // 3. Display Result
          if (typeof result.result === 'object') {
              setRunResult(JSON.stringify(result.result, null, 2));
          } else {
              setRunResult(String(result.result));
          }

      } catch (e: any) {
          console.error(e);
          setRunResult(`Error: ${e.response?.data?.detail || e.message || "Unknown error"}`);
      } finally {
          setRunning(false);
      }
  };
  
  const handleExport = async () => {
        if (!workflowId) {
            alert("Please save the workflow before exporting code.");
            return;
        }
       try {
          const response = await exportWorkflow(workflowId);
          setExportedCode(response.code);
          setExportDialogOpen(true);
       } catch (e) {
           console.error("Export failed", e);
           alert("Export failed");
       }
  };

  return (
    <div className="flex h-full border rounded-lg overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-muted/20 border-r p-4 flex flex-col gap-6 overflow-y-auto">
         <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2"><Bot size={16}/> Agents</h4>
            <div className="flex flex-col gap-2">
                {agents.map(agent => (
                    <div 
                        key={agent.id}
                        className="p-2 bg-card border rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 text-sm"
                        draggable
                        onDragStart={(event) => onDragStart(event, 'agent', agent)}
                    >
                        {agent.name}
                    </div>
                ))}
                {agents.length === 0 && <div className="text-xs text-muted-foreground">No agents found.</div>}
            </div>
         </div>
         
         <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2"><Hammer size={16}/> Tools</h4>
             <div className="flex flex-col gap-2">
                {tools.map(tool => (
                    <div 
                        key={tool.id}
                        className="p-2 bg-card border rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 text-sm"
                        draggable
                        onDragStart={(event) => onDragStart(event, 'tool', tool)}
                    >
                        {tool.name}
                    </div>
                ))}
                 {tools.length === 0 && <div className="text-xs text-muted-foreground">No tools found.</div>}
            </div>
         </div>
         
         <div className="mt-auto">
             <div className="text-xs text-muted-foreground">
                 Drag and drop items to the canvas.
             </div>
         </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col h-full relative" ref={reactFlowWrapper}>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
             {/* Name Display */}
             {workflowId && <div className="bg-background/80 p-2 rounded border text-sm font-medium items-center flex mr-2">
                 {workflowName}
                 {isPublished && <Globe size={14} className="ml-2 text-green-600" />}
             </div>}

            <Button variant="outline" size="sm" onClick={() => handleExport()}>
                <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSaveClick}>
                <Save className="mr-2 h-4 w-4" /> Save
            </Button>
             <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50" onClick={handlePublish}>
                <Globe className="mr-2 h-4 w-4" /> Publish
            </Button>
            <Button size="sm" onClick={() => setRunDialogOpen(true)}>
                <Play className="mr-2 h-4 w-4" /> Run
            </Button>
        </div>
        
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
        >
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Save Workflow</DialogTitle>
                  <DialogDescription>
                      Enter the details for your workflow.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input 
                        id="name" 
                        value={workflowName} 
                        onChange={(e) => setWorkflowName(e.target.value)} 
                        placeholder="My Workflow"
                      />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="desc">Description</Label>
                      <Textarea 
                        id="desc" 
                        value={workflowDescription} 
                        onChange={(e) => setWorkflowDescription(e.target.value)} 
                        placeholder="What does this workflow do?"
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={handleSaveConfirm}>Save</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Run Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                  <DialogTitle>Run Workflow</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                      <Label htmlFor="input">Input</Label>
                      <Textarea 
                        id="input" 
                        value={runInput} 
                        onChange={(e) => setRunInput(e.target.value)}
                        placeholder="Enter input for the start node..."
                      />
                  </div>
                  {runResult && (
                      <div className="grid gap-2">
                          <Label>Result</Label>
                          <div className="p-2 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                              {runResult}
                          </div>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button onClick={handleRun} disabled={running}>
                      {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {running ? "Running..." : "Execute"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                  <DialogTitle>Export Code</DialogTitle>
              </DialogHeader>
               <div className="p-2 bg-muted rounded-md text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {exportedCode}
               </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GraphsTab() {
  return (
    <ReactFlowProvider>
      <GraphsTabContent />
    </ReactFlowProvider>
  );
}
