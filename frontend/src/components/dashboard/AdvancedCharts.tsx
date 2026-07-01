"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const DONUT_COLORS = ["#10b981", "#ef4444", "#f59e0b"]; // Emerald (Success), Red (Error), Amber

interface AdvancedChartsProps {
  data: {
    apps_metrics: any[];
    app_series: any[];
    status_distribution: any[];
    token_split: any[];
    top_users: any[];
    gen_speed: any[];
  } | null;
}

export function AdvancedCharts({ data }: AdvancedChartsProps) {
  if (!data) return null;

  const {
    apps_metrics,
    app_series,
    status_distribution,
    token_split,
    top_users,
    gen_speed,
  } = data;

  // Helper for colors
  const getAppColor = (index: number) => COLORS[index % COLORS.length];

  return (
    <div className="space-y-8">
      
      {/* SECTION 1: Application Insights */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1 rounded">Apps</span> Application Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Requests by App (Donut) */}
            <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Requests Volume</CardTitle>
                <CardDescription>Total traces per application</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={apps_metrics}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="total_count"
                    nameKey="name"
                    >
                    {apps_metrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getAppColor(index)} />
                    ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
                </ResponsiveContainer>
            </CardContent>
            </Card>

            {/* 2. Cost by App (Bar) */}
            <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Cost Distribution</CardTitle>
                <CardDescription>Total estimated cost ($)</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apps_metrics} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 12}} />
                    <Tooltip 
                        formatter={(value: any) => [`$${value}`, "Cost"]}
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Bar dataKey="total_cost" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
                </ResponsiveContainer>
            </CardContent>
            </Card>

            {/* 3. Error Rate by App (Bar) */}
            <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Reliability</CardTitle>
                <CardDescription>Error rate percentage (%)</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apps_metrics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} />
                    <YAxis unit="%" />
                    <Tooltip 
                         formatter={(value: any) => [`${value}%`, "Error Rate"]}
                         cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                         contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Bar dataKey="error_rate" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
                </ResponsiveContainer>
            </CardContent>
            </Card>
        </div>

        {/* 4. Daily Traffic Trends (Stacked Area) */}
        <div className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Traffic Trends</CardTitle>
                    <CardDescription>Request volume over time by application</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={app_series}>
                    <defs>
                        {apps_metrics.map((app, index) => (
                            <linearGradient key={app.name} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={getAppColor(index)} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={getAppColor(index)} stopOpacity={0}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="time" minTickGap={30} tick={{fontSize: 12}} />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                    <Legend />
                    {apps_metrics.map((app, index) => (
                        <Area 
                            key={app.name}
                            type="monotone" 
                            dataKey={app.name} 
                            stackId="1" 
                            stroke={getAppColor(index)} 
                            fill={`url(#color${index})`} 
                        />
                    ))}
                    </AreaChart>
                </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* SECTION 2: General Analytics */}
      <div>
        <h2 className="text-lg font-semibold mb-4 mt-8 flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1 rounded">Global</span> General Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
             {/* 6. Status Distribution (Donut) */}
             <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Status Check</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={status_distribution}
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                        >
                           {status_distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'ERROR' ? '#ef4444' : '#10b981'} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
             </Card>

             {/* 7. Token Split (Pie) */}
             <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Token Split</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={token_split}
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            dataKey="value"
                        >
                            <Cell fill="#8884d8" />
                            <Cell fill="#82ca9d" />
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
             </Card>

             {/* 8. Avg Latency (App) - Moved here */}
             <Card>
                 <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium">Avg Latency (App)</CardTitle>
                     <CardDescription>Avg Response time (ms)</CardDescription>
                 </CardHeader>
                 <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={apps_metrics} margin={{ top: 20 }}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                             <XAxis dataKey="name" tick={{fontSize: 12}} />
                             <YAxis />
                             <Tooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} />
                             <Bar dataKey="avg_latency" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
             </Card>
        </div>
      </div>
    </div>
  );
}
