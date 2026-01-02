"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TimeChartProps {
  data: any[];
  totalTraces: number;
}

export function TimeChart({ data, totalTraces }: TimeChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
            <h3 className="text-lg font-semibold text-foreground">Traces by time</h3>
            <div className="flex gap-4 mt-2 border-b border-border w-full">
                <button className="pb-2 text-sm font-medium text-cyan-400 border-b-2 border-cyan-400">Traces</button>
            </div>
        </div>
      </div>
      
      <div className="h-[250px] w-full">
         <div className="mb-4">
             <span className="text-3xl font-bold text-foreground">{totalTraces}</span>
             <span className="ml-2 text-sm text-muted-foreground">Traces tracked</span>
         </div>
         <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorTraces" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
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
                    contentStyle={{ backgroundColor: '#020817', borderColor: '#1e293b' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="traces" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTraces)" 
                />
            </AreaChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
}
