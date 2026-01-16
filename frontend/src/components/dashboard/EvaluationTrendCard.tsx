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
             <Card>
                 <CardHeader>
                     <CardTitle className="text-sm font-medium">{title}</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground">
                     No evaluation data available.
                 </CardContent>
             </Card>
         )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <CardDescription>Average score over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }} 
                            tickFormatter={(value) => {
                                const d = new Date(value);
                                return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            }}
                        />
                        <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'hsl(var(--popover))', 
                                borderColor: 'hsl(var(--border))', 
                                borderRadius: '8px',
                                fontSize: '12px'
                            }} 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="avg_score" 
                            stroke="#10b981" 
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                            name="Avg Score"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
