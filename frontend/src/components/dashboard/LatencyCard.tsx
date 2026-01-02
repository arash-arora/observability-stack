"use client";

interface LatencyCardProps {
    title: string;
    data: any[];
}

export function LatencyCard({ title, data }: LatencyCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 h-full flex flex-col">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      
      {(!data || data.length === 0) ? (
         <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No data available</div>
      ) : (
         <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium text-right">p50</th>
                        <th className="pb-2 font-medium text-right">p90</th>
                        <th className="pb-2 font-medium text-right">p99</th>
                    </tr>
                </thead>
                <tbody className="text-foreground">
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="py-2 font-mono text-[10px] text-cyan-400 max-w-[100px] truncate" title={row.name}>{row.name}</td>
                            <td className="py-2 text-right">{row.p50}s</td>
                            <td className="py-2 text-right">{row.p90}s</td>
                            <td className="py-2 text-right">{row.p99}s</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      )}
    </div>
  );
}
