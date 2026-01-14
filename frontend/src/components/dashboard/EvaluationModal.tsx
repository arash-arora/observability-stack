import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play } from "lucide-react";
import api from "@/lib/api";

type EvaluationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    input?: string;
    output?: string;
    context?: string | string[];
  };
};

export default function EvaluationModal({
  isOpen,
  onClose,
  initialData,
}: EvaluationModalProps) {
  const [metric, setMetric] = useState("DeepEvalFaithfulnessEvaluator");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [context, setContext] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  
  // Configuration State
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [deploymentName, setDeploymentName] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput(initialData.input || "");
      setOutput(initialData.output || "");
      
      // Handle context: join array if necessary, or use string
      if (Array.isArray(initialData.context)) {
        setContext(initialData.context.join("\n\n"));
      } else {
        setContext(initialData.context || "");
      }
      
      setExpectedOutput("");
      setResult(null);
      setError(null);
      // Reset config defaults if needed, or keep them consistent across runs?
      // Keeping them consistent is usually better UX
    }
  }, [isOpen, initialData]);

  const handleRunEvaluation = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Parse context back to array if needed by backend
      const contextList = context.split("\n\n").filter(c => c.trim().length > 0);

      const inputs: any = {
          input: input,
          output: output,
          context: contextList,
          expected: expectedOutput,
          provider: provider,
          model: model,
          api_key: apiKey,
          persist_result: true,
      };

      if (provider === "azure") {
          inputs.azure_endpoint = azureEndpoint;
          inputs.api_version = apiVersion;
          inputs.deployment_name = deploymentName;
      }

      const payload = {
        metric_id: metric,
        inputs: inputs
      };

      const res = await api.post("/evaluations/run", payload);
      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Evaluation failed to run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run Trace Evaluation</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left Column: Trace Data */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm border-b pb-2">Trace Data</h3>
            <div className="space-y-2">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DeepEvalFaithfulnessEvaluator">Faithfulness</SelectItem>
                  <SelectItem value="DeepEvalAnswerRelevancyEvaluator">Answer Relevancy</SelectItem>
                  <SelectItem value="DeepEvalContextualPrecisionEvaluator">Contextual Precision</SelectItem>
                  <SelectItem value="DeepEvalHallucinationEvaluator">Hallucination</SelectItem>
                  <SelectItem value="PhoenixToxicityEvaluator">Toxicity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Input Payload / Query</Label>
              <Textarea
                className="font-mono text-xs min-h-[80px]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="User query..."
              />
            </div>

            <div className="space-y-2">
              <Label>Output / Response</Label>
              <Textarea
                className="font-mono text-xs min-h-[80px]"
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="LLM response..."
              />
            </div>

            <div className="space-y-2">
              <Label>Retrieval Context (Split by double newline)</Label>
              <Textarea
                className="font-mono text-xs min-h-[120px]"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Retrieved context chunks..."
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Output (Optional)</Label>
              <Textarea
                className="font-mono text-xs min-h-[60px]"
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                placeholder="Ground truth..."
              />
            </div>
          </div>

          {/* Right Column: Configuration & Results */}
          <div className="space-y-6">
             {/* Configuration Section */}
             <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
                <h3 className="font-semibold text-sm border-b pb-2">Configuration</h3>
                
                <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={provider} onValueChange={setProvider}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="azure">Azure OpenAI</SelectItem>
                            <SelectItem value="langchain">Langchain</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)} 
                        placeholder="sk-..." 
                        className="bg-background"
                    />
                </div>

                {provider === "azure" && (
                    <>
                        <div className="space-y-2">
                            <Label>Azure Endpoint</Label>
                            <Input 
                                value={azureEndpoint} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAzureEndpoint(e.target.value)} 
                                placeholder="https://..." 
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>API Version</Label>
                            <Input 
                                value={apiVersion} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiVersion(e.target.value)} 
                                placeholder="2023-05-15"
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Deployment Name</Label>
                            <Input 
                                value={deploymentName} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeploymentName(e.target.value)} 
                                placeholder="deployment-name"
                                className="bg-background"
                            />
                        </div>
                    </>
                )}

                <div className="space-y-2">
                    <Label>Model Name</Label>
                    <Input 
                        value={model} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)} 
                        placeholder={provider === "azure" ? "Model ID" : "e.g. gpt-4o"}
                        className="bg-background"
                    />
                </div>
             </div>

             {/* Results Section */}
             {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-sm">
                {error}
                </div>
            )}

            {result && (
                <div className={`p-4 rounded border ${result.passed ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${result.passed ? 'text-green-500' : 'text-red-500'}`}>
                    {result.passed ? "PASSED" : "FAILED"}
                    </span>
                    <span className="font-mono text-sm">Score: {result.score.toFixed(3)}</span>
                </div>
                <p className="text-sm text-foreground/80">{result.reason}</p>
                </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleRunEvaluation} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run Evaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
