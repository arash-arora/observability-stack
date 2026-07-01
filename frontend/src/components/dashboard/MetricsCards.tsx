"use client";

import { Info } from 'lucide-react';

interface MetricsCardsProps {
  data: any;
}

export function MetricsCards({ data }: MetricsCardsProps) {
  const { total_traces = 0, total_cost = 0, total_scores = 0, scores_stats = [] } = data || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 animate-in fade-in slide-in-from-bottom duration-300">
      {/* Card 1: Traces */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-5 right-5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Live</span>
        </div>
        <div className="mb-2">
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Traces</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{total_traces.toLocaleString()}</span>
            </div>
            <span className="text-xs text-[#6e6e73] mt-2.5 block">Total traces tracked</span>
        </div>
        
        <div className="mt-4 pt-4 border-t border-black/[0.04]">
            <div className="text-[11px] text-[#6e6e73] flex justify-between items-center font-medium">
              <span>Status</span>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">Active</span>
            </div>
        </div>
      </div>

      {/* Card 2: Total Tokens */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-5 right-5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Tokens</span>
        </div>
        <div className="mb-2">
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Total Tokens</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{data?.total_tokens?.toLocaleString() || 0}</span>
            </div>
            <span className="text-xs text-[#6e6e73] mt-2.5 block">Tokens consumed</span>
        </div>
        <div className="mt-4 pt-4 border-t border-black/[0.04]">
            <div className="text-[11px] text-[#6e6e73] flex justify-between items-center font-medium">
              <span>Avg/Trace</span>
              <span className="font-semibold text-[#1d1d1f]">
                {total_traces > 0 ? Math.round((data?.total_tokens || 0) / total_traces).toLocaleString() : 0}
              </span>
            </div>
        </div>
      </div>

      {/* Card 3: Model Costs */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-5 right-5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Cost</span>
        </div>
        <div className="mb-2">
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Model Costs</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">${total_cost.toFixed(4)}</span>
            </div>
            <span className="text-xs text-[#6e6e73] mt-2.5 block flex items-center gap-1">
                Total cost <Info size={11} className="opacity-60 text-[#6e6e73]" />
            </span>
        </div>
        <div className="mt-4 pt-4 border-t border-black/[0.04]">
            <div className="text-[11px] text-[#6e6e73] flex justify-between items-center font-medium">
              <span>Cost/Trace</span>
              <span className="font-semibold text-[#1d1d1f]">
                ${total_traces > 0 ? (total_cost / total_traces).toFixed(5) : "0.00"}
              </span>
            </div>
        </div>
      </div>

      {/* Card 4: Scores */}
      <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-5 right-5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Eval</span>
        </div>
        <div className="mb-2">
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Scores</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{total_scores}</span>
            </div>
            <span className="text-xs text-[#6e6e73] mt-2.5 block">Total scores tracked</span>
        </div>

        {scores_stats.length > 0 && (
          <div className="mt-4 pt-3 border-t border-black/[0.04]">
              <table className="w-full text-[10px] text-left">
                  <thead>
                      <tr className="text-[#6e6e73] border-b border-black/[0.03]">
                          <th className="pb-1 font-semibold uppercase tracking-wider">Name</th>
                          <th className="pb-1 font-semibold uppercase tracking-wider text-right">Count</th>
                          <th className="pb-1 font-semibold uppercase tracking-wider text-right">Avg</th>
                      </tr>
                  </thead>
                  <tbody className="text-[#1d1d1f] font-medium">
                      {scores_stats.slice(0, 2).map((row: any, i: number) => (
                          <tr key={i} className="border-b border-black/[0.02] last:border-0 hover:bg-black/[0.02] transition-colors">
                              <td className="py-1.5 font-mono text-[9px] text-[#0071e3] truncate max-w-[80px] font-semibold">{row.name}</td>
                              <td className="py-1.5 text-right font-semibold">{row.count}</td>
                              <td className="py-1.5 text-right font-semibold">{(row.avg * 100).toFixed(0)}%</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
}
