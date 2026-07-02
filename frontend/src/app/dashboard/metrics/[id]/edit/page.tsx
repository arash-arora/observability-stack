"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDashboard } from '@/context/DashboardContext';
import Link from 'next/link';
import { ArrowLeft, Save, Code, MessageSquare, List, Play } from 'lucide-react';
import api from '@/lib/api';

// --- Inline Components ---
const Button = ({ children, className, variant = 'primary', ...props }: any) => {
    const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";
    const variants = {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
    };
    return <button className={`${baseClass} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>{children}</button>;
};

const Input = ({ className, ...props }: any) => (
    <input className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Textarea = ({ className, ...props }: any) => (
    <textarea className={`flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props} />
);

const Label = ({ children, className, ...props }: any) => (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>{children}</label>
);

const Card = ({ children, className }: any) => (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
);

const Badge = ({ children, variant = 'default', className }: any) => {
    const base = "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors";
    const variants = {
        default: "border-transparent bg-primary text-primary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
    };
    return <div className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>{children}</div>;
};

export default function EditMetricPage() {
  const router = useRouter();
  const params = useParams();
  const metricId = params?.id as string;
  const { selectedProject } = useDashboard();
  const [mode, setMode] = useState<'prompt' | 'code'>('prompt');
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
      name: '',
      description: '',
      prompt: '',
      code: `class CustomMetricEvaluator:
    def evaluate(self, trace):
        # Your custom evaluation logic here
        return {
            "score": 0.0,
            "reason": "Not implemented"
        }`,
      model: 'gpt-4o'
  });
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const extractVariables = (text: string) => {
      const matches = text.match(/\{\{([^}]+)\}\}/g);
      if (!matches) return [];
      return Array.from(new Set(matches.map(m => m.slice(2, -2).trim())));
  };

  const variables = mode === 'prompt' ? extractVariables(formData.prompt) : [];

  useEffect(() => {
    if (metricId) {
        api.get('/evaluations/metrics')
           .then(res => {
               const metric = res.data.find((m: any) => m.id === metricId);
               if (metric) {
                   setFormData({
                       name: metric.name,
                       description: metric.description,
                       prompt: metric.prompt || "",
                       code: metric.code_snippet || "",
                       model: metric.provider || "openai"
                   });
                   // Find matching provider if possible
                   if (providers.length > 0) {
                        const pv = providers.find(p => p.provider === metric.provider);
                        if (pv) setSelectedProviderId(pv.id);
                   }
               }
               setLoading(false);
           })
           .catch(() => setLoading(false));
    }
  }, [metricId, providers]);

  const handleTestRun = async () => {
      setTestRunning(true);
      setTestResult(null);
      
      const inputsPayload: any = {
          ...testInputs,
          custom_prompt: formData.prompt,
      };

      const selectedProvider = providers.find(p => p.id === selectedProviderId);
      if (selectedProvider) {
          inputsPayload.provider = selectedProvider.provider;
          inputsPayload.api_key = selectedProvider.api_key;
          if (selectedProvider.provider === 'azure') {
               inputsPayload.azure_endpoint = selectedProvider.base_url;
               inputsPayload.api_version = selectedProvider.api_version;
               inputsPayload.deployment_name = selectedProvider.deployment_name;
               inputsPayload.model = selectedProvider.deployment_name;
          } else {
               inputsPayload.model = selectedProvider.model_name;
          }
      } else {
          inputsPayload.model = formData.model; // fallback
      }

      try {
          const res = await api.post('/evaluations/run', {
              metric_id: '',
              inputs: inputsPayload
          });
          setTestResult(res.data);
      } catch (e: any) {
          alert('Test run failed: ' + (e.response?.data?.detail || e.message));
      } finally {
          setTestRunning(false);
      }
  };

  const handleSave = async () => {
      if (!formData.name) {
          alert("Please provide a metric name.");
          return;
      }
      setSaving(true);
      const selectedProvider = providers.find(p => p.id === selectedProviderId);
      const providerName = selectedProvider ? selectedProvider.provider : formData.model;

      try {
          await api.put(`/evaluations/metrics/${metricId}`, {
              name: formData.name,
              description: formData.description,
              provider: providerName,
              type: "custom",
              prompt: formData.prompt,
              code_snippet: formData.code,
              tags: ["custom"],
              inputs: mode === 'prompt' ? variables : [],
              dummy_data: testInputs && Object.keys(testInputs).length > 0 ? testInputs : null
          });
          router.push('/dashboard/metrics');
      } catch (e: any) {
          console.error(e);
          alert("Failed to update metric");
      } finally {
          setSaving(false);
      }
  };

  if (loading) {
      return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading metric...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 py-6">
       {/* Height spacer for fixed header/sidebar if needed, padding handled by layout */}
       
       <div className="flex items-center gap-4 mb-6">
         <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
         </Button>
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Custom Metric</h1>
            <p className="text-sm text-muted-foreground">Update your evaluation metric below. Modifying the prompt will automatically change the required inputs.</p>
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
             {/* Main Form */}
             <Card className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Metric Name</Label>
                    <Input 
                        id="name" 
                        placeholder="e.g. Tone Consistency" 
                        value={formData.name}
                        onChange={(e: any) => setFormData({...formData, name: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                        id="description" 
                        placeholder="Describe what this metric evaluates..." 
                        value={formData.description}
                        onChange={(e: any) => setFormData({...formData, description: e.target.value})}
                    />
                </div>
             </Card>

             {/* Mode Selection Tabs */}
             <div className="w-full">
                <div className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg mb-4">
                    <button
                        onClick={() => setMode('prompt')}
                        className={`text-sm font-medium py-2 rounded-md transition-all ${mode === 'prompt' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <MessageSquare size={14} />
                            Prompt-based
                        </div>
                    </button>
                    <button
                        onClick={() => setMode('code')}
                        className={`text-sm font-medium py-2 rounded-md transition-all ${mode === 'code' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Code size={14} />
                            Code-based
                        </div>
                    </button>
                </div>

                <Card className="p-0 overflow-hidden border-t-4 border-t-primary">
                    {mode === 'prompt' ? (
                        <div className="p-6 space-y-4 bg-gradient-to-br from-background to-muted/20">
                            <div className="space-y-2">
                                <Label className="flex justify-between">
                                    <span>Evaluation Prompt</span>
                                    <span className="text-xs text-muted-foreground">Use {'{{input}}'} and {'{{output}}'} varialbes</span>
                                </Label>
                                <Textarea 
                                    className="min-h-[200px] font-mono text-sm leading-relaxed"
                                    placeholder="You are an expert evaluator. Rate the tone of the following response..."
                                    value={formData.prompt}
                                    onChange={(e: any) => setFormData({...formData, prompt: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Evaluation Model</Label>
                                <select 
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={selectedProviderId}
                                    onChange={(e) => setSelectedProviderId(e.target.value)}
                                >
                                    {providers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.model_name || p.deployment_name})</option>
                                    ))}
                                    {providers.length === 0 && (
                                        <option value="">No models registered</option>
                                    )}
                                </select>
                                {providers.length === 0 && (
                                    <p className="text-[10px] text-muted-foreground mt-1">Please register a model in Provider Hub to evaluate metrics.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-[400px]">
                            <div className="bg-zinc-950 text-zinc-400 text-xs px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span>evaluator.py</span>
                                <span>Python 3.12</span>
                            </div>
                            <textarea 
                                className="flex-1 w-full bg-[#0d1117] text-zinc-100 font-mono text-sm p-4 resize-none focus:outline-none"
                                spellCheck={false}
                                value={formData.code}
                                onChange={(e) => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                    )}
                </Card>

              {/* Test Run Section */}
              <Card className="p-6 space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Test Run</h3>
                  {variables.length > 0 ? (
                      <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">Provide sample values for your prompt variables to test the evaluation logic.</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {variables.map(v => (
                                  <div key={v} className="space-y-2">
                                      <Label className="font-mono text-xs">{v}</Label>
                                      <Textarea 
                                        className="h-20"
                                        placeholder={`Sample ${v}...`}
                                        value={testInputs[v] || ''}
                                        onChange={(e: any) => setTestInputs({...testInputs, [v]: e.target.value})}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground">No variables defined. Use {'{{variable}}'} in your prompt.</p>
                  )}
                  
                  <div className="pt-2">
                      <Button onClick={handleTestRun} disabled={testRunning || variables.length === 0} className="gap-2">
                          <Play size={16} />
                          {testRunning ? 'Running...' : 'Run Test'}
                      </Button>
                  </div>

                  {testResult && (
                      <div className="mt-4 p-4 bg-muted/30 rounded-md border">
                          <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold">Result Score:</span>
                              <Badge variant={testResult.passed ? 'default' : 'destructive'} className={testResult.passed ? 'bg-green-500 hover:bg-green-600' : ''}>
                                  {Math.round(testResult.score * 100)}%
                              </Badge>
                          </div>
                          <div className="mb-2">
                              <span className="font-semibold text-sm">Reasoning:</span>
                              <p className="text-sm mt-1">{testResult.reason}</p>
                          </div>
                      </div>
                  )}
              </Card>
             </div>
          </div>

          <div className="space-y-6">
              {/* Sidebar Info */}
              <Card className="p-6 bg-muted/30">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <List size={16} />
                      Validation Steps
                  </h3>
                  <div className="space-y-4 relative pl-4 border-l-2 border-muted">
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                            <p className="text-sm font-medium">Define Logic</p>
                            <p className="text-xs text-muted-foreground mt-1">Write the prompt or code that determines the score.</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-muted border border-foreground/20 ring-4 ring-background" />
                            <p className="text-sm font-medium text-muted-foreground">Test Run</p>
                            <p className="text-xs text-muted-foreground mt-1">Run against a sample trace to verify output.</p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-muted border border-foreground/20 ring-4 ring-background" />
                            <p className="text-sm font-medium text-muted-foreground">Publish</p>
                        </div>
                  </div>
              </Card>

              <div className="flex flex-col gap-3">
                  <Button variant="primary" className="w-full" onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Updating...' : 'Update Metric'}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => router.back()}>
                      Cancel
                  </Button>
              </div>
          </div>
       </div>
    </div>
  );
}
