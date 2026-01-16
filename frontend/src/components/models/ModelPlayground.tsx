"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useDashboard } from "@/context/DashboardContext";

export default function ModelPlayground() {
  const { selectedProject } = useDashboard();
  
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProject) {
        fetchProviders();
    }
  }, [selectedProject]);

  const fetchProviders = async () => {
      try {
          const res = await api.get(`/management/providers?project_id=${selectedProject?.id}`);
          setProviders(res.data);
          if (res.data.length > 0) {
              setSelectedProviderId(res.data[0].id);
          }
      } catch (e) {
          console.error("Failed to fetch providers", e);
      }
  };

  const handleRun = async () => {
      if (!selectedProviderId || !input.trim()) return;
      
      setLoading(true);
      setError(null);
      setOutput("");
      
      try {
          const res = await api.post("/management/providers/test", {
              provider_id: selectedProviderId,
              input_text: input
          });
          setOutput(res.data.output);
      } catch (err: any) {
          console.error("Test failed", err);
          setError(err.response?.data?.detail || "Failed to run model test");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Left: Configuration */}
        <div className="lg:col-span-1 border rounded-lg p-4 space-y-6 bg-muted/10 h-full">
            <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Configuration
            </h3>
            
            <div className="space-y-2">
                <Label>Select Model</Label>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose a registered model" />
                    </SelectTrigger>
                    <SelectContent>
                        {providers.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.model_name || p.deployment_name})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {providers.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                        No models found. Register one in the Registry tab.
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label>System Message (Optional)</Label>
                <Textarea 
                    placeholder="You are a helpful assistant..." 
                    className="min-h-[100px] text-xs font-mono resize-none"
                    disabled
                />
                <p className="text-[10px] text-muted-foreground">System message support coming soon.</p>
            </div>
            
            <div className="space-y-2">
                <Label>Parameters</Label>
                <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded p-2 text-xs text-muted-foreground bg-background">
                         Temperature: 0.7
                    </div>
                     <div className="border rounded p-2 text-xs text-muted-foreground bg-background">
                         Max Tokens: 1024
                    </div>
                </div>
            </div>
        </div>

        {/* Right: Interaction */}
        <div className="lg:col-span-2 flex flex-col gap-4 h-full">
            {/* Input Area */}
            <div className="flex-1 border rounded-lg p-4 flex flex-col gap-2 bg-background shadow-sm">
                <Label>User Input</Label>
                <Textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1 font-mono text-sm resize-none border-0 focus-visible:ring-0 p-0"
                />
                
                <div className="flex justify-end pt-2 border-t">
                    <Button onClick={handleRun} disabled={loading || !selectedProviderId || !input.trim()}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Run Request
                    </Button>
                </div>
            </div>

            {/* Output Area */}
            <div className="flex-1 border rounded-lg p-4 flex flex-col gap-2 bg-muted/5">
                <Label>Model Output</Label>
                {error ? (
                    <div className="p-4 rounded border border-red-500/20 bg-red-500/10 text-red-500 text-sm font-mono whitespace-pre-wrap flex-1 overflow-auto">
                        {error}
                    </div>
                ): (
                    <div className="p-4 rounded border border-border bg-background text-foreground text-sm font-mono whitespace-pre-wrap flex-1 overflow-auto">
                        {output || <span className="text-muted-foreground/50 italic">Output will appear here...</span>}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
