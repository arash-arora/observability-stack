"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Code, MessageSquare, List } from 'lucide-react';

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

export default function CreateMetricPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'prompt' | 'code'>('prompt');
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

  const handleSave = () => {
      // Mock save action
      console.log('Saving metric:', formData);
      router.push('/dashboard/metrics');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 py-6">
       {/* Height spacer for fixed header/sidebar if needed, padding handled by layout */}
       
       <div className="flex items-center gap-4 mb-6">
         <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
         </Button>
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Metric</h1>
            <p className="text-sm text-muted-foreground">Define a custom metric using a prompt or python code.</p>
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
                                    value={formData.model}
                                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                                >
                                    <option value="gpt-4o">GPT-4o</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    <option value="claude-3-opus">Claude 3 Opus</option>
                                </select>
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
                  <Button variant="primary" className="w-full" onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Metric
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
