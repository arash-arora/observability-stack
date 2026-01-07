"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TokenTimeChartProps {
  data: any[];
  totalTokens: number;
}

export function TokenTimeChart({ data, totalTokens }: TokenTimeChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
            <h3 className="text-lg font-semibold text-foreground">Tokens by time</h3>
            <div className="flex gap-4 mt-2 border-b border-border w-full">
                <button className="pb-2 text-sm font-medium text-primary border-b-2 border-primary">Tokens</button>
            </div>
        </div>
      </div>
      
      <div className="h-[250px] w-full">
         <div className="mb-4">
             <span className="text-3xl font-bold text-foreground">{totalTokens.toLocaleString()}</span>
             <span className="ml-2 text-sm text-muted-foreground">Total tokens</span>
         </div>
         <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="tokens" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTokens)" 
                />
            </AreaChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
}
