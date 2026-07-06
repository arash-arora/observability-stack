"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface LatencyChartProps {
  data: any[];
  title: string;
}

export function LatencyChart({ data, title }: LatencyChartProps) {
  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">{title}</h3>
        </div>
      </div>

      <div className="h-[270px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              label={{ value: 'ms', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#86868b' } }}
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
              formatter={(value: number) => [`${value.toFixed(2)} ms`, '']}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="p50"
            />
            <Line
              type="monotone"
              dataKey="p90"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="p90"
            />
            <Line
              type="monotone"
              dataKey="p99"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="p99"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
