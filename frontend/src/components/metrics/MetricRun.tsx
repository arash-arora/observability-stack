import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const DUMMY_DATA: Record<string, { input?: string; output?: string; context?: string; expected?: string }> = {
  RagasFaithfulnessEvaluator: {
    input: "Who won the first Super Bowl?",
    output: "The Green Bay Packers won the first Super Bowl.",
    context: "The First AFL–NFL World Championship Game was played on January 15, 1967. The Green Bay Packers defeated the Kansas City Chiefs 35–10.",
    expected: "Green Bay Packers"
  },
  RagasAnswerRelevancyEvaluator: {
    input: "What is the capital of France?",
    output: "The capital of France is Paris.",
    context: "", 
    expected: "Paris"
  },
  RagasContextPrecisionEvaluator: {
      input: "What caused the 2008 financial crisis?",
      context: "The 2008 financial crisis was caused by a combination of factors, including the subprime mortgage crisis, deregulation, and excessive risk-taking by banks.",
      expected: "Subprime mortgage crisis, deregulation, risk-taking"
  },
  RagasContextRecallEvaluator: {
      input: "List the planets in the solar system.",
      context: "The solar system consists of the Sun and the objects that orbit it, including eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",
      expected: "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune"
  },
  DeepEvalHallucinationEvaluator: {
      input: "Who is the president of the moon?",
      output: "There is no president of the moon.",
      context: "The Moon is an astronomical body orbiting Earth. It has no government or president.",
      expected: "No president"
  },
  DeepEvalAnswerRelevancyEvaluator: {
      input: "How do I bake a cake?",
      output: "You need flour, sugar, eggs, and butter. Mix them and bake at 350F.",
      context: "Baking requires precise measurements and temperature control.",
      expected: "Recipe for cake"
  },
  DeepEvalFaithfulnessEvaluator: {
      input: "Is the earth flat?",
      output: "No, the earth is an oblate spheroid.",
      context: "Scientific evidence overwhelmingly supports that the Earth is a sphere.",
      expected: "Round/Sphere"
  },
  PhoenixToxicityEvaluator: {
      input: "Say something mean.",
      output: "I hate you, you are terrible.",
      context: "",
      expected: "Non-toxic response"
  },
  PhoenixHallucinationEvaluator: {
      input: "Who is the president of the moon?",
      output: "There is no president of the moon.",
      context: "The Moon is an astronomical body orbiting Earth. It has no government.",
      expected: "No president"
  },
  AgentRoutingEvaluator: {
      input: "What is the weather in Tokyo?",
      output: "Using weather_tool to fetch Tokyo weather.",
      context: "Available tools: [weather_tool, stock_tool]",
      expected: "weather_tool"
  },
  RagasNoiseSensitivityEvaluator: {
      input: "What is the capital of France?",
      output: "The capital of France is Paris.",
      context: "Paris is the capital of France. It is known for the Eiffel Tower.",
      expected: "Paris"
  }
};

interface MetricRunProps {
  metric: any;
}

export function MetricRun({ metric }: MetricRunProps) {
  const [evalInput, setEvalInput] = useState("");
  const [evalContext, setEvalContext] = useState("");
  const [evalOutput, setEvalOutput] = useState("");
  const [evalExpected, setEvalExpected] = useState("");
  const [evalProvider, setEvalProvider] = useState("openai");
  const [evalModel, setEvalModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [deploymentName, setDeploymentName] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  // Observability configuration
  const [observeTrace, setObserveTrace] = useState(false);
  const [obsApiKey, setObsApiKey] = useState("");
  const [obsHost, setObsHost] = useState("http://localhost:8000");

  useEffect(() => {
    // Pre-fill fields with dummy data if available
    const dummy = DUMMY_DATA[metric.id];
    if (dummy) {
        setEvalInput(dummy.input || "");
        setEvalOutput(dummy.output || "");
        setEvalContext(dummy.context || "");
        setEvalExpected(dummy.expected || "");
    }
  }, [metric.id]);

  useEffect(() => {
      if (observeTrace && !obsApiKey) {
          // Auto-fetch API key
          const fetchKeys = async () => {
              try {
                  const res = await api.get("/management/api-keys");
                  if (res.data && res.data.length > 0) {
                      // Find first active key
                      const activeKey = res.data.find((k: any) => k.is_active);
                      if (activeKey) {
                          setObsApiKey(activeKey.key);
                      }
                  }
              } catch (e) {
                  console.error("Failed to fetch API keys", e);
              }
          };
          fetchKeys();
      }
  }, [observeTrace]);

  const handleRun = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      // 1. Prepare Inputs
      const inputs: any = {
        input: evalInput,
        output: evalOutput,
        context: evalContext.split("\n").filter(line => line.trim() !== ""),
        expected: evalExpected,
        provider: evalProvider,
        model: evalModel,
        api_key: apiKey,
        persist_result: false,
      };

      if (evalProvider === "azure") {
        inputs.azure_endpoint = azureEndpoint;
        inputs.api_version = apiVersion;
        inputs.deployment_name = deploymentName;
      }
      
      // Observability settings
      if (observeTrace) {
          inputs.observe = true;
          inputs.user_api_key = obsApiKey;
          inputs.host = obsHost;
      }

      // 2. Call API
      const res = await api.post("/evaluations/run", {
        metric_id: metric.id,
        inputs: inputs,
      });

      // 3. Set Result
      setTestResult({
        score: res.data.score,
        reason: res.data.reason,
        passed: res.data.passed,
        latency_ms: "N/A", 
        trace_id: res.data.trace_id,
      });
    } catch (e: any) {
      console.error("Evaluation failed", e);
      setTestResult({
        score: 0,
        reason: e.response?.data?.detail || e.message || "Failed to run evaluation",
        passed: false,
        latency_ms: "-",
        trace_id: null,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 space-y-6">
          <div className="space-y-4">
              <div className="space-y-2">
                  <Label>Input</Label>
                  <Textarea
                      className="min-h-25 font-mono"
                      placeholder="User query or input..."
                      value={evalInput}
                      onChange={(e) => setEvalInput(e.target.value)}
                  />
              </div>
              <div className="space-y-2">
                  <Label>Context (Optional - Line separated)</Label>
                  <Textarea
                      className="min-h-25 font-mono"
                      placeholder="Retrieved context..."
                      value={evalContext}
                      onChange={(e) => setEvalContext(e.target.value)}
                  />
              </div>
              <div className="space-y-2">
                  <Label>Output</Label>
                  <Textarea
                      className="min-h-25 font-mono"
                      placeholder="LLM response..."
                      value={evalOutput}
                      onChange={(e) => setEvalOutput(e.target.value)}
                  />
              </div>
              <div className="space-y-2">
                  <Label>Expected Output (Optional)</Label>
                  <Textarea
                      className="min-h-25 font-mono"
                      placeholder="Ground truth answer..."
                      value={evalExpected}
                      onChange={(e) => setEvalExpected(e.target.value)}
                  />
              </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleRun} disabled={isRunning || !evalInput}>
              {isRunning ? (
                <>Running...</>
              ) : (
                <>
                  <Play size={14} className="mr-2" /> Run Evaluation
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
          <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-sm">Configuration</h3>
              <div className="space-y-4">
                  <div className="space-y-2">
                      <Label>Provider</Label>
                      <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={evalProvider}
                          onChange={(e) => setEvalProvider(e.target.value)}
                      >
                          <option value="openai">OpenAI</option>
                          <option value="azure">Azure OpenAI</option>
                          <option value="langchain">Langchain</option>
                      </select>
                  </div>
                  
                  <div className="space-y-2">
                      <Label>API Key</Label>
                      <input
                          type="password"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="sk-..."
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                      />
                  </div>

                  {evalProvider === "azure" && (
                      <>
                          <div className="space-y-2">
                              <Label>Azure Endpoint</Label>
                              <input
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="https://your-resource.openai.azure.com/"
                                  value={azureEndpoint}
                                  onChange={(e) => setAzureEndpoint(e.target.value)}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label>API Version</Label>
                              <input
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="2023-05-15"
                                  value={apiVersion}
                                  onChange={(e) => setApiVersion(e.target.value)}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label>Deployment Name</Label>
                              <input
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="deployment-name"
                                  value={deploymentName}
                                  onChange={(e) => setDeploymentName(e.target.value)}
                              />
                          </div>
                      </>
                  )}

                  <div className="space-y-2">
                      <Label>Model Name</Label>
                      <input
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder={evalProvider === "azure" ? "Model ID (if different)" : "e.g. gpt-4o"}
                          value={evalModel}
                          onChange={(e) => setEvalModel(e.target.value)}
                      />
                  </div>
                  
                  <div className="pt-4 border-t space-y-4">
                      <div className="flex items-center space-x-2">
                          <input
                              type="checkbox"
                              id="observeTrace"
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              checked={observeTrace}
                              onChange={(e) => setObserveTrace(e.target.checked)}
                          />
                          <Label htmlFor="observeTrace" className="cursor-pointer">Observe Trace</Label>
                      </div>
                      
                      {observeTrace && (
                          <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                              <div className="space-y-2">
                                  <Label>Observix Host</Label>
                                  <input
                                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                      placeholder="http://localhost:8000"
                                      value={obsHost}
                                      onChange={(e) => setObsHost(e.target.value)}
                                  />
                              </div>
                              <div className="space-y-2">
                                  <Label>Observix API Key</Label>
                                  <input
                                      type="password"
                                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                      placeholder="obs-..."
                                      value={obsApiKey}
                                      onChange={(e) => setObsApiKey(e.target.value)}
                                  />
                                  {!obsApiKey && (
                                      <p className="text-xs text-muted-foreground">
                                          No API Key found? <Link href="/dashboard/settings" className="text-primary underline">Generate one in Settings</Link>.
                                      </p>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </Card>

        {testResult && (
          <div className="animate-in slide-in-from-top-2">
              <Card className="p-6">
            <h3 className="font-semibold mb-4">Evaluation Result</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                  Score
                </div>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {testResult.score}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Reasoning
              </div>
              <p className="text-sm italic text-foreground/80">
                &quot;{testResult.reason}&quot;
              </p>
            </div>
            {testResult.trace_id && (
                <div className="mt-4 flex justify-end">
                    <Link href={`/dashboard/traces?trace_id=${testResult.trace_id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                          <ExternalLink size={14} /> View Trace
                      </Button>
                    </Link>
                </div>
            )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
