"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface ModelUsageChartProps {
  data: any[];
  totalCost: number;
}

export function ModelUsageChart({ data, totalCost }: ModelUsageChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Model Usage</h3>
        <div className="flex gap-4 mt-2 border-b border-border">
            <button className="pb-2 text-sm font-medium text-primary border-b-2 border-primary">Cost by model</button>
        </div>
      </div>
      
      <div className="h-[250px] w-full">
         <div className="mb-4">
             <span className="text-3xl font-bold text-foreground">${totalCost.toFixed(4)}</span>
             <span className="ml-2 text-sm text-muted-foreground">Total Cost</span>
         </div>
         <div className="w-full">
            <table className="w-full text-sm text-left">
                <thead>
                    <tr className="text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Model</th>
                        <th className="pb-2 font-medium text-right">Count</th>
                        <th className="pb-2 font-medium text-right">Est. Cost</th>
                    </tr>
                </thead>
                <tbody className="text-foreground">
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-2 font-mono text-xs">{row.model}</td>
                            <td className="py-2 text-right">{row.count}</td>
                            <td className="py-2 text-right">${row.cost}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
