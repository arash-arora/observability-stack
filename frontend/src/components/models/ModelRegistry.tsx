"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Key, Loader2, Edit2 } from "lucide-react";
import api from "@/lib/api";
import { useDashboard } from "@/context/DashboardContext";

export default function ModelRegistry() {
  const { selectedProject } = useDashboard();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState("openai");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  
  // Azure specific
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [deploymentName, setDeploymentName] = useState("");

  const fetchProviders = async () => {
    if (!selectedProject) return;
    try {
      setLoading(true);
      const res = await api.get(`/management/providers?project_id=${selectedProject.id}`);
      setProviders(res.data);
    } catch (e) {
      console.error("Failed to fetch providers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [selectedProject]);

  const handleCreate = async () => {
    if (!selectedProject) return;
    
    try {
      setDialogLoading(true);
      const payload: any = {
          name,
          provider: providerType,
          model_name: modelName,
          api_key: apiKey,
          project_id: selectedProject.id
      };
      
      if (providerType === "azure") {
          payload.base_url = azureEndpoint;
          payload.api_version = apiVersion;
          payload.deployment_name = deploymentName;
          // For Azure, model_name might be optional if stored in deployment, but good to keep
      }
      
      await api.post("/management/providers", payload);
      await fetchProviders();
      setIsDialogOpen(false);
      resetForm();
    } catch (e) {
      console.error("Failed to create provider", e);
      // Could add toast here
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      try {
          await api.delete(`/management/providers/${id}`);
          fetchProviders();
      } catch (e) {
          console.error("Failed to delete provider", e);
      }
  };

  const resetForm = () => {
      setName("");
      setProviderType("openai");
      setModelName("");
      setApiKey("");
      setAzureEndpoint("");
      setApiVersion("");
      setDeploymentName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Registered Models</h3>
        <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Model
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Model / Deployment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 && !loading && (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No models registered yet. Add one to get started.
                    </TableCell>
                </TableRow>
            )}
            
            {providers.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="capitalize">{p.provider === 'langchain' ? 'Langchain (Groq)' : p.provider}</TableCell>
                <TableCell className="font-mono text-xs">
                    {p.provider === 'azure' ? p.deployment_name : p.model_name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Model</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Friendly Name</Label>
                <Input 
                    placeholder="e.g. My Production GPT-4" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            
            <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={providerType} onValueChange={setProviderType}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                        <SelectItem value="langchain">LangChain (Groq)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Dynamic Fields */}
            {providerType === "openai" && (
                <>
                    <div className="space-y-2">
                        <Label>Model Name</Label>
                        <Input 
                            placeholder="gpt-4o" 
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                </>
            )}

            {providerType === "langchain" && (
                <>
                     <div className="space-y-2">
                        <Label>Model Name</Label>
                        <Input 
                            placeholder="llama3-70b-8192" 
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                </>
            )}

            {providerType === "azure" && (
                <>
                    <div className="space-y-2">
                        <Label>Azure Endpoint</Label>
                        <Input 
                            placeholder="https://my-resource.openai.azure.com/" 
                            value={azureEndpoint}
                            onChange={(e) => setAzureEndpoint(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>API Version</Label>
                        <Input 
                            placeholder="2023-05-15" 
                            value={apiVersion}
                            onChange={(e) => setApiVersion(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Deployment Name</Label>
                        <Input 
                            placeholder="my-gpt-4-deployment" 
                            value={deploymentName}
                            onChange={(e) => setDeploymentName(e.target.value)}
                        />
                    </div>
                </>
            )}

            <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                    <Input 
                        type="password"
                        placeholder="sk-..." 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pr-8"
                    />
                    <Key className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={dialogLoading}>
                {dialogLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
