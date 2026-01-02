"use client";

import { Info } from 'lucide-react';

interface MetricsCardsProps {
  data: any;
}

export function MetricsCards({ data }: MetricsCardsProps) {
  const { total_traces = 0, total_cost = 0, total_scores = 0, scores_stats = [] } = data || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
      {/* Card 1: Traces */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Traces</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{total_traces}</span>
                <span className="text-xs text-muted-foreground">Total traces tracked</span>
            </div>
        </div>
        
        <div className="space-y-2 mt-4">
            {/* Simple distribution placeholder */}
            <div className="text-xs text-muted-foreground">Distribution data requires grouping</div>
        </div>
      </div>

      {/* Card 2: Model Costs */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Model costs</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">${total_cost.toFixed(4)}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    Total cost <Info size={12} />
                </span>
            </div>
        </div>
      </div>

      {/* Card 3: Scores */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Scores</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{total_scores}</span>
                <span className="text-xs text-muted-foreground">Total scores tracked</span>
            </div>
        </div>

        <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium text-right">#</th>
                        <th className="pb-2 font-medium text-right">Avg</th>
                    </tr>
                </thead>
                <tbody className="text-foreground">
                    {scores_stats.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="py-2 font-mono text-[10px] text-cyan-400">{row.name}</td>
                            <td className="py-2 text-right">{row.count}</td>
                            <td className="py-2 text-right">{row.avg}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
