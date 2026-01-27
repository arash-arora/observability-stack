"use client";

import { useEffect, useState } from "react";
import { getTools, createTool, deleteTool } from "@/lib/workflow-api";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Code2, Plug, Cpu } from "lucide-react";
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

export default function ToolsTab() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    description: "",
    type: "custom",
    configuration: "{}",
  });

  const fetchTools = async () => {
    setLoading(true);
    try {
      const data = await getTools();
      setTools(data);
    } catch (error) {
      console.error("Failed to fetch tools", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleCreate = async () => {
    try {
      await createTool({
        ...newTool,
        configuration: JSON.parse(newTool.configuration),
      });
      setIsOpen(false);
      setNewTool({ name: "", description: "", type: "custom", configuration: "{}" });
      fetchTools();
    } catch (error) {
      console.error("Failed to create tool", error);
      alert("Failed to create tool. Check JSON config format.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tool?")) return;
    try {
      await deleteTool(id);
      fetchTools();
    } catch (error) {
      console.error("Failed to delete tool", error);
    }
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'api': return <Plug className="w-4 h-4" />;
          case 'mcp': return <Cpu className="w-4 h-4" />;
          default: return <Code2 className="w-4 h-4" />;
      }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div>
            <h3 className="text-lg font-semibold">Available Tools</h3>
            <p className="text-sm text-muted-foreground">Manage tools that your agents can use.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Tool</DialogTitle>
              <DialogDescription>
                Add a new tool to your library.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newTool.name}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. calculator_tool"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select
                  value={newTool.type}
                  onValueChange={(value) => setNewTool({ ...newTool, type: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom (Function)</SelectItem>
                    <SelectItem value="api">API Endpoint</SelectItem>
                    <SelectItem value="mcp">MCP Server</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Desc
                </Label>
                <Input
                  id="description"
                  value={newTool.description}
                  onChange={(e) =>
                    setNewTool({ ...newTool, description: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="What does this tool do?"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="config" className="text-right pt-2">
                  Config
                </Label>
                <Textarea
                  id="config"
                  value={newTool.configuration}
                  onChange={(e) =>
                    setNewTool({ ...newTool, configuration: e.target.value })
                  }
                  className="col-span-3 font-mono text-xs"
                  placeholder="{}"
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreate}>
                Create Tool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
        {loading ? (
             <div className="col-span-full text-center text-muted-foreground py-10">Loading tools...</div>
        ) : tools.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-10 border border-dashed rounded-lg bg-muted/20">
                No tools found. Create one to get started.
            </div>
        ) : (
             tools.map((tool) => (
                <div key={tool.id} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3 group hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-md text-primary">
                                {getTypeIcon(tool.type)}
                            </div>
                            <div>
                                <h4 className="font-semibold truncate max-w-[150px]" title={tool.name}>{tool.name}</h4>
                                <span className="text-xs text-muted-foreground uppercase">{tool.type}</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(tool.id)}>
                            <Trash2 size={16} />
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                        {tool.description || "No description provided."}
                    </p>
                    <div className="mt-auto pt-2 border-t text-xs text-muted-foreground font-mono truncate">
                        ID: {tool.id.slice(0, 8)}...
                    </div>
                </div>
             ))
        )}
      </div>
    </div>
  );
}
