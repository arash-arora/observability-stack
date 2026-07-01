"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface ModelUsageChartProps {
  data: any[];
  totalCost: number;
}

export function ModelUsageChart({ data, totalCost }: ModelUsageChartProps) {
  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 overflow-hidden">
      <div className="mb-4">
        <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Model Usage</h3>
      </div>
      
      <div className="h-[270px] w-full flex flex-col justify-between">
         <div className="mb-2">
             <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">${totalCost.toFixed(4)}</span>
             <span className="ml-2 text-xs font-semibold text-[#6e6e73]">Total Cost</span>
         </div>
         <div className="w-full flex-1 mt-4 overflow-y-auto pr-1">
            <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-[#6e6e73] border-b border-black/[0.03]">
                        <th className="pb-2 font-semibold uppercase tracking-wider">Model</th>
                        <th className="pb-2 font-semibold uppercase tracking-wider text-right">Count</th>
                        <th className="pb-2 font-semibold uppercase tracking-wider text-right">Est. Cost</th>
                    </tr>
                </thead>
                <tbody className="text-[#1d1d1f] font-medium">
                    {data && data.length > 0 ? (
                      data.map((row, i) => (
                          <tr key={i} className="border-b border-black/[0.02] last:border-0 hover:bg-black/[0.02] transition-colors">
                              <td className="py-2.5 font-mono text-[9px] text-[#0071e3] font-semibold">
                                <span className="bg-neutral-100/80 px-2 py-0.5 rounded-full border border-neutral-200/50 text-[#1d1d1f]">
                                  {row.model}
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-semibold">{row.count.toLocaleString()}</td>
                              <td className="py-2.5 text-right font-bold text-[#1d1d1f]">${parseFloat(row.cost).toFixed(4)}</td>
                          </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-[#6e6e73]/70 font-semibold">No model usage data available</td>
                      </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
