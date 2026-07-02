"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TimeChartProps {
  data: any[];
  totalTraces: number;
}

export function TimeChart({ data, totalTraces }: TimeChartProps) {
  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div>
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Traces by time</h3>
        </div>
      </div>
      
      <div className="h-[270px] w-full flex flex-col justify-between">
         <div className="mb-2">
             <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{totalTraces.toLocaleString()}</span>
             <span className="ml-2 text-xs font-semibold text-[#6e6e73]">Traces tracked</span>
         </div>
         <div className="h-[200px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                   <defs>
                       <linearGradient id="colorTraces" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#0071e3" stopOpacity={0.12}/>
                       <stop offset="95%" stopColor="#0071e3" stopOpacity={0}/>
                       </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.03)" vertical={false} />
                   <XAxis 
                       dataKey="time" 
                       stroke="#86868b" 
                       fontSize={10} 
                       tickLine={false}
                       axisLine={false}
                       dy={8}
                   />
                   <YAxis 
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
                       dataKey="traces" 
                       stroke="#0071e3" 
                       strokeWidth={2}
                       fillOpacity={1} 
                       fill="url(#colorTraces)" 
                       className="glow-chart-line"
                   />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
}
