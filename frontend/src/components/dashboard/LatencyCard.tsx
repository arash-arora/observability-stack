"use client";

interface LatencyCardProps {
    title: string;
    data: any[];
}

export function LatencyCard({ title, data }: LatencyCardProps) {
  return (
    <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col h-full">
      <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest mb-4">{title}</h3>
      
      {(!data || data.length === 0) ? (
         <div className="flex-1 flex items-center justify-center text-[#6e6e73]/70 text-xs py-8 font-semibold">No data available</div>
      ) : (
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-[#6e6e73] border-b border-black/[0.03]">
                        <th className="pb-2 font-semibold uppercase tracking-wider">Name</th>
                        <th className="pb-2 font-semibold uppercase tracking-wider text-right">p50</th>
                        <th className="pb-2 font-semibold uppercase tracking-wider text-right">p90</th>
                        <th className="pb-2 font-semibold uppercase tracking-wider text-right">p99</th>
                    </tr>
                </thead>
                <tbody className="text-[#1d1d1f] font-medium">
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-black/[0.02] last:border-0 hover:bg-black/[0.02] transition-colors">
                            <td className="py-2.5 font-mono text-[9px] text-[#0071e3] max-w-[120px] truncate" title={row.name}>
                              <span className="bg-neutral-100/80 px-2 py-0.5 rounded-full border border-neutral-200/50 text-[#1d1d1f] font-semibold">
                                {row.name}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold text-[#1d1d1f]">{row.p50.toFixed(2)}s</td>
                            <td className="py-2.5 text-right font-semibold">{row.p90.toFixed(2)}s</td>
                            <td className="py-2.5 text-right font-semibold">{row.p99.toFixed(2)}s</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      )}
    </div>
  );
}
