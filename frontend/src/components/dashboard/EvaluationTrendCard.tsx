"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EvaluationTrendCardProps = {
    data: any[];
    title?: string;
};

export function EvaluationTrendCard({ data, title = "Evaluation Trend" }: EvaluationTrendCardProps) {
    if (!data || data.length === 0) {
         return (
             <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col h-[340px]">
                 <div className="mb-4">
                     <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">{title}</h3>
                 </div>
                 <div className="flex-1 flex items-center justify-center text-[#6e6e73]/70 text-xs font-semibold">
                     No evaluation data available.
                 </div>
             </div>
         )
    }

    return (
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col h-[340px] overflow-hidden">
            <div className="mb-4">
                <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">{title}</h3>
                <p className="text-[11px] text-[#6e6e73] font-semibold mt-1">Average score over the last 30 days</p>
            </div>
            <div className="flex-1 w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#34c759" stopOpacity={0.12}/>
                                <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.03)" />
                        <XAxis 
                            dataKey="date" 
                            stroke="#86868b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={8}
                            tickFormatter={(value) => {
                                const d = new Date(value);
                                return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            }}
                        />
                        <YAxis 
                            domain={[0, 1]} 
                            stroke="#86868b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dx={-4}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                                backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(0,0,0,0.05)', 
                                borderRadius: '16px',
                                color: '#1d1d1f',
                                fontSize: '11px',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)'
                            }} 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="avg_score" 
                            stroke="#34c759" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                            name="Avg Score"
                            className="glow-chart-line"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
