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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Key, Loader2, Edit2, Globe, Lock } from "lucide-react";
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
  const [isPublic, setIsPublic] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Azure specific
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [deploymentName, setDeploymentName] = useState("");

  // AWS Bedrock specific
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");

  // GCP Vertex AI specific
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpLocation, setGcpLocation] = useState("us-central1");
  const [gcpCredentials, setGcpCredentials] = useState("");

  // HuggingFace specific
  const [hfInferenceEndpoint, setHfInferenceEndpoint] = useState("");

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
          project_id: selectedProject.id,
          is_public: isPublic
      };

      if (providerType === "azure") {
          payload.base_url = azureEndpoint;
          payload.api_version = apiVersion;
          payload.deployment_name = deploymentName;
      } else if (providerType === "bedrock") {
          payload.provider_config = {
              aws_region: awsRegion,
              aws_access_key_id: awsAccessKeyId,
              aws_secret_access_key: awsSecretAccessKey
          };
      } else if (providerType === "vertexai") {
          payload.provider_config = {
              gcp_project_id: gcpProjectId,
              gcp_location: gcpLocation,
              gcp_credentials: gcpCredentials
          };
      } else if (providerType === "huggingface") {
          payload.provider_config = {
              inference_endpoint: hfInferenceEndpoint
          };
      }
      
      if (editingId) {
          await api.patch(`/management/providers/${editingId}`, payload);
      } else {
          await api.post("/management/providers", payload);
      }
      
      await fetchProviders();
      setIsDialogOpen(false);
      resetForm();
    } catch (e) {
      console.error("Failed to save provider", e);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleEdit = (provider: any) => {
      setEditingId(provider.id);
      setName(provider.name);
      setProviderType(provider.provider);
      setModelName(provider.model_name || "");
      setApiKey(provider.api_key);
      setIsPublic(provider.is_public);

      if (provider.provider === "azure") {
          setAzureEndpoint(provider.base_url || "");
          setApiVersion(provider.api_version || "");
          setDeploymentName(provider.deployment_name || "");
      } else if (provider.provider === "bedrock") {
          const config = provider.provider_config || {};
          setAwsRegion(config.aws_region || "us-east-1");
          setAwsAccessKeyId(config.aws_access_key_id || "");
          setAwsSecretAccessKey(config.aws_secret_access_key || "");
      } else if (provider.provider === "vertexai") {
          const config = provider.provider_config || {};
          setGcpProjectId(config.gcp_project_id || "");
          setGcpLocation(config.gcp_location || "us-central1");
          setGcpCredentials(config.gcp_credentials || "");
      } else if (provider.provider === "huggingface") {
          const config = provider.provider_config || {};
          setHfInferenceEndpoint(config.inference_endpoint || "");
      }

      setIsDialogOpen(true);
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
      setEditingId(null);
      setName("");
      setProviderType("openai");
      setModelName("");
      setApiKey("");
      setIsPublic(false);
      setAzureEndpoint("");
      setApiVersion("");
      setDeploymentName("");
      setAwsRegion("us-east-1");
      setAwsAccessKeyId("");
      setAwsSecretAccessKey("");
      setGcpProjectId("");
      setGcpLocation("us-central1");
      setGcpCredentials("");
      setHfInferenceEndpoint("");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
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
              <TableHead>Visibility</TableHead>
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
                <TableCell>
                    {p.is_public ? (
                        <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                            <Globe className="w-3 h-3 mr-1" />
                            Public
                        </div>
                    ) : (
                        <div className="flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                            <Lock className="w-3 h-3 mr-1" />
                            Private
                        </div>
                    )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="hover:bg-slate-100 mr-1">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </Button>
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
            <DialogTitle>{editingId ? "Edit Model" : "Register New Model"}</DialogTitle>
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
                        <SelectItem value="bedrock">AWS Bedrock</SelectItem>
                        <SelectItem value="vertexai">GCP Vertex AI</SelectItem>
                        <SelectItem value="huggingface">HuggingFace</SelectItem>
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

            {providerType === "bedrock" && (
                <>
                    <div className="space-y-2">
                        <Label>Model ID</Label>
                        <Input
                            placeholder="anthropic.claude-3-sonnet-20240229-v1:0"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>AWS Region</Label>
                        <Select value={awsRegion} onValueChange={setAwsRegion}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                                <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                                <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>AWS Access Key ID</Label>
                        <Input
                            placeholder="AKIA..."
                            value={awsAccessKeyId}
                            onChange={(e) => setAwsAccessKeyId(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>AWS Secret Access Key</Label>
                        <Input
                            type="password"
                            placeholder="..."
                            value={awsSecretAccessKey}
                            onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                        />
                    </div>
                </>
            )}

            {providerType === "vertexai" && (
                <>
                    <div className="space-y-2">
                        <Label>Model Name</Label>
                        <Input
                            placeholder="gemini-pro"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>GCP Project ID</Label>
                        <Input
                            placeholder="my-project-123456"
                            value={gcpProjectId}
                            onChange={(e) => setGcpProjectId(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>GCP Location</Label>
                        <Select value={gcpLocation} onValueChange={setGcpLocation}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="us-central1">us-central1</SelectItem>
                                <SelectItem value="us-east1">us-east1</SelectItem>
                                <SelectItem value="europe-west1">europe-west1</SelectItem>
                                <SelectItem value="asia-southeast1">asia-southeast1</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Service Account JSON</Label>
                        <textarea
                            placeholder='{"type": "service_account", "project_id": "...", ...}'
                            value={gcpCredentials}
                            onChange={(e) => setGcpCredentials(e.target.value)}
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                        />
                    </div>
                </>
            )}

            {providerType === "huggingface" && (
                <>
                    <div className="space-y-2">
                        <Label>Model Name</Label>
                        <Input
                            placeholder="meta-llama/Llama-2-7b-chat-hf"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Inference Endpoint (Optional)</Label>
                        <Input
                            placeholder="https://api-inference.huggingface.co/models/..."
                            value={hfInferenceEndpoint}
                            onChange={(e) => setHfInferenceEndpoint(e.target.value)}
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

            <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                <div className="space-y-0.5">
                    <Label className="text-base">Make Public</Label>
                    <div className="text-xs text-muted-foreground">
                        Allow everyone in this project to use this model
                    </div>
                </div>
                <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={dialogLoading}>
                {dialogLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
