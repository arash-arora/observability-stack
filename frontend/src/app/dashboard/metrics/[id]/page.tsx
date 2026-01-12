"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Code,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
// import { PRESET_METRICS } from '../data';

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

// --- Inline Components ---
const Button = ({
  children,
  className,
  variant = "primary",
  size = "default",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  [key: string]: any;
}) => {
  const baseClass =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const sizes = {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 rounded-md px-3 text-xs",
    icon: "h-9 w-9",
  };
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline:
      "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
  };
  return (
    <button
      className={`${baseClass} ${
        sizes[size as keyof typeof sizes] || sizes.default
      } ${variants[variant as keyof typeof variants]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "secondary" | "outline"; className?: string }) => {
  const base =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default:
      "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary:
      "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "text-foreground",
  };
  return (
    <div
      className={`${base} ${
        variants[variant as keyof typeof variants]
      } ${className}`}
    >
      {children}
    </div>
  );
};

const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={`flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Label = ({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </label>
);

export default function MetricDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<"info" | "run">("info");
  const [copied, setCopied] = useState(false);
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

  const [metric, setMetric] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetric = async () => {
      try {
        // Optimally we'd have GET /metrics/:id, but fetching all is fine for now given the list size
        const res = await api.get("/evaluations/metrics");
        const data = res.data;
        const found = data.find((m: any) => m.id === params.id);
        if (found) {
          setMetric({
            id: found.id,
            name: found.name,
            type: found.type,
            level: "Trace",
            tags: found.tags || [],
            owner: found.provider,
            lastEdit: "-",
            description: found.description,
            code: found.code_snippet,
            prompt: found.prompt, // If backend supports it later
          });

          // Pre-fill fields with dummy data if available
          const dummy = DUMMY_DATA[found.id];
          if (dummy) {
             setEvalInput(dummy.input || "");
             setEvalOutput(dummy.output || "");
             setEvalContext(dummy.context || "");
             setEvalExpected(dummy.expected || "");
          }
        }
      } catch (_e) {
        console.error("Failed to fetch metric details");
      } finally {
        setLoading(false);
      }
    };
    fetchMetric();
  }, [params.id]);

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

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading metric details...
      </div>
    );
  }

  if (!metric) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold">Metric not found</h2>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(metric.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      });
    } catch (e: any) {
      console.error("Evaluation failed", e);
      setTestResult({
        score: 0,
        reason: e.response?.data?.detail || e.message || "Failed to run evaluation",
        passed: false,
        latency_ms: "-",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{metric.name}</h1>
            <Badge variant="outline">{metric.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {metric.description}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b">
        <div className="flex h-10 items-center gap-4">
          <button
            onClick={() => setActiveTab("info")}
            className={`h-10 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "info"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Definition & Usage
          </button>
          <button
            onClick={() => setActiveTab("run")}
            className={`h-10 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "run"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Run Evaluation
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "info" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card className="overflow-hidden border-2 border-primary/10">
                <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {metric.prompt ? (
                      <MessageSquare size={14} className="text-primary" />
                    ) : (
                      <Code size={14} className="text-primary" />
                    )}
                    <span>
                      {metric.prompt ? "Evaluation Prompt" : "Python SDK Usage"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7"
                  >
                    {copied ? (
                      <Check size={14} className="mr-1 text-green-500" />
                    ) : (
                      <Copy size={14} className="mr-1" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="p-0 bg-[#0d1117]">
                  <pre className="p-4 text-sm font-mono text-zinc-100 overflow-x-auto whitespace-pre-wrap">
                    {metric.prompt ||
                      metric.code ||
                      "# No code snippet available"}
                  </pre>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  About this metric
                </h3>
                <div className="space-y-4 text-sm">
                  <p>
                    This metric is provided by{" "}
                    <span className="font-semibold text-foreground">
                      {metric.owner}
                    </span>
                    . It is designed to evaluate {metric.type} interactions at
                    the {metric.level} level.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">
                        Last Updated
                      </span>
                      <span className="font-medium">{metric.lastEdit}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">
                        Complexity
                      </span>
                      <span className="font-medium">Medium</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {metric.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card className="p-5 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
                <h3 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-300">
                  How it works
                </h3>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                  This metric uses a dedicated LLM to grade the output based on
                  predefined criteria. It analyzes the semantic meaning rather
                  than just keywords.
                </p>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "run" && (
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
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
