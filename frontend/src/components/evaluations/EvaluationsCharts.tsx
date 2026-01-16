"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface EvaluationsChartsProps {
  data: {
    pass_fail: any[];
    avg_scores: any[];
    score_trend: any[];
  } | null;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];

export function EvaluationsCharts({ data }: EvaluationsChartsProps) {
  if (!data) return null;

  const { pass_fail, avg_scores, score_trend } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 1. Pass/Fail Ratio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pass Ratio</CardTitle>
            <CardDescription>Evaluations outcome distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pass_fail}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {pass_fail.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Passed' ? '#10b981' : '#ef4444'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}/>
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Avg Score by Metric */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Metric Performance</CardTitle>
            <CardDescription>Average score per metric</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avg_scores} layout="vertical" margin={{ left: 40}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" domain={[0, 1]} tickCount={6} />
                <YAxis type="category" dataKey="metric" width={120} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

       {/* 3. Score Trend */}
       <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quality Trend</CardTitle>
            <CardDescription>Average evaluation score over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={score_trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" tick={{fontSize: 12}} minTickGap={30}/>
                <YAxis domain={[0, 1]} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                <Line type="monotone" dataKey="avg_score" stroke="#8884d8" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
    </div>
  );
}
