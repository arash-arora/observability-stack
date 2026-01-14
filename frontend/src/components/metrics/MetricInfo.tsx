import { useState } from "react";
import { MessageSquare, Code, Check, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MetricInfoProps {
  metric: any;
}

export function MetricInfo({ metric }: MetricInfoProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(metric.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
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
  );
}
