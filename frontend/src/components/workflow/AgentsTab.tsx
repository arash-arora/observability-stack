"use client";

import { useEffect, useState } from "react";
import { getAgents, createAgent, deleteAgent, getTools, getProviders } from "@/lib/workflow-api";
import { useDashboard } from "@/context/DashboardContext";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Bot, Brain } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function AgentsTab() {
  const { selectedProject } = useDashboard();
  const [agents, setAgents] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    model_config_id: "",
    instruction: "You are a helpful assistant.",
    input_key: "input",
    output_key: "output",
    tool_ids: [] as string[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [getAgents(), getTools()];
      if (selectedProject) {
          promises.push(getProviders(selectedProject.id));
      }
      
      const results = await Promise.all(promises);
      setAgents(results[0]);
      setTools(results[1]);
      if (results[2]) {
          setProviders(results[2]);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProject]); // Refetch if project changes

  const handleCreate = async () => {
    if (!newAgent.model_config_id) {
        alert("Please select a model.");
        return;
    }
    try {
      await createAgent(newAgent);
      setIsOpen(false);
      setNewAgent({
        name: "",
        description: "",
        model_config_id: "",
        instruction: "You are a helpful assistant.",
        input_key: "input",
        output_key: "output",
        tool_ids: [],
      });
      fetchData();
    } catch (error) {
      console.error("Failed to create agent", error);
      alert("Failed to create agent.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await deleteAgent(id);
      fetchData();
    } catch (error) {
      console.error("Failed to delete agent", error);
    }
  };
  
  const toggleTool = (toolId: string) => {
      setNewAgent(prev => {
          const exists = prev.tool_ids.includes(toolId);
          if (exists) {
              return { ...prev, tool_ids: prev.tool_ids.filter(id => id !== toolId) };
          } else {
               return { ...prev, tool_ids: [...prev.tool_ids, toolId] };
          }
      });
  };

  const getProviderName = (id: string) => {
      const p = providers.find(p => p.id === id);
      return p ? `${p.name} (${p.model_name})` : id;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div>
            <h3 className="text-lg font-semibold">Available Agents</h3>
            <p className="text-sm text-muted-foreground">Manage your AI agents.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent with tools and instructions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. support_agent"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="model" className="text-right">
                  Model
                </Label>
                <Select
                    value={newAgent.model_config_id}
                    onValueChange={(value) => setNewAgent({ ...newAgent, model_config_id: value })}
                >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a model from Model Hub" />
                </SelectTrigger>
                <SelectContent>
                    {providers.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.provider}/{p.model_name})
                        </SelectItem>
                    ))}
                    {providers.length === 0 && <SelectItem value="" disabled>No models found</SelectItem>}
                </SelectContent>
                </Select>
              </div>

               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Desc
                </Label>
                <Input
                  id="description"
                  value={newAgent.description}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, description: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="What is this agent for?"
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="instruction" className="text-right pt-2">
                  Instruction
                </Label>
                <Textarea
                  id="instruction"
                  value={newAgent.instruction}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, instruction: e.target.value })
                  }
                  className="col-span-3 font-mono text-xs"
                  placeholder="System instructions..."
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="input_key" className="text-right">
                  Input Key
                </Label>
                <Input
                  id="input_key"
                  value={newAgent.input_key}
                  onChange={(e) => setNewAgent({ ...newAgent, input_key: e.target.value })}
                  className="col-span-3 font-mono"
                  placeholder="input"
                />
              </div>
              
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="output_key" className="text-right">
                  Output Key
                </Label>
                <Input
                  id="output_key"
                  value={newAgent.output_key}
                  onChange={(e) => setNewAgent({ ...newAgent, output_key: e.target.value })}
                  className="col-span-3 font-mono"
                  placeholder="output"
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">
                  Tools
                </Label>
                <div className="col-span-3 border rounded-md p-2 max-h-[150px] overflow-y-auto space-y-2 bg-muted/20">
                    {tools.length === 0 ? <div className="text-xs text-muted-foreground p-1">No tools available.</div> : 
                        tools.map(tool => (
                             <div key={tool.id} className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    id={`tool-${tool.id}`} 
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={newAgent.tool_ids.includes(tool.id)}
                                    onChange={() => toggleTool(tool.id)}
                                />
                                <label htmlFor={`tool-${tool.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    {tool.name}
                                </label>
                            </div>
                        ))
                    }
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreate}>
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
        {loading ? (
             <div className="col-span-full text-center text-muted-foreground py-10">Loading agents...</div>
        ) : agents.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-10 border border-dashed rounded-lg bg-muted/20">
                No agents found. Create one.
            </div>
        ) : (
             agents.map((agent) => (
                <div key={agent.id} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3 group hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-md text-primary">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold truncate max-w-[150px]" title={agent.name}>{agent.name}</h4>
                                <span className="text-xs text-muted-foreground truncate max-w-[150px] block" title={getProviderName(agent.model_config_id)}>
                                    {getProviderName(agent.model_config_id)}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(agent.id)}>
                            <Trash2 size={16} />
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                        {agent.description || "No description provided."}
                    </p>
                    <div className="flex gap-2 flex-wrap items-center">
                        {agent.tool_ids && agent.tool_ids.length > 0 && (
                            <div className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Brain size={10} />
                                {agent.tool_ids.length} tools
                            </div>
                        )}
                         <div className="text-[10px] text-muted-foreground font-mono ml-auto">
                            {agent.input_key} → {agent.output_key}
                        </div>
                    </div>
                </div>
             ))
        )}
      </div>
    </div>
  );
}
