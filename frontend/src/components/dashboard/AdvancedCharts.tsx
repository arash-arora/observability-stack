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

const COLORS = ["#0071e3", "#34c759", "#af52de", "#ff9500", "#5ac8fa", "#ff3b30"];
const DONUT_COLORS = ["#34c759", "#ff3b30", "#ff9500"]; // Sage Green, Red, Orange

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
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* SECTION 1: Application Insights */}
      <div>
        <h2 className="text-sm font-bold tracking-wider text-muted-foreground/80 uppercase mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" /> Application Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Requests by App (Donut) */}
            <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
              <div className="mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Requests Volume</h3>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Total traces per application</p>
              </div>
              <div className="flex-1 w-full h-[220px]">
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
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(0,0,0,0.08)', 
                          borderRadius: '12px',
                          color: '#1d1d1f',
                          fontSize: '11px',
                          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
                        }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Cost by App (Bar) */}
            <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
              <div className="mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Cost Distribution</h3>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Total estimated cost ($)</p>
              </div>
              <div className="flex-1 w-full h-[220px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apps_metrics} layout="vertical" margin={{ left: -10, right: 10, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0, 0, 0, 0.05)" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={60} stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                        formatter={(value: any) => [`$${parseFloat(value).toFixed(4)}`, "Cost"]}
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(0,0,0,0.08)', 
                          borderRadius: '12px',
                          color: '#1d1d1f',
                          fontSize: '11px',
                          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
                        }}
                    />
                    <Bar dataKey="total_cost" fill="#0071e3" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Error Rate by App (Bar) */}
            <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
              <div className="mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Reliability</h3>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Error rate percentage (%)</p>
              </div>
              <div className="flex-1 w-full h-[220px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apps_metrics} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.05)" />
                    <XAxis dataKey="name" stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                    <YAxis unit="%" stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dx={-4} />
                    <Tooltip 
                         formatter={(value: any) => [`${parseFloat(value).toFixed(1)}%`, "Error Rate"]}
                         cursor={{fill: 'rgba(0,0,0,0.02)'}}
                         contentStyle={{ 
                           backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                           backdropFilter: 'blur(12px)',
                           border: '1px solid rgba(0,0,0,0.08)', 
                           borderRadius: '12px',
                           color: '#1d1d1f',
                           fontSize: '11px',
                           boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
                         }}
                    />
                    <Bar dataKey="error_rate" fill="#ff3b30" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
        </div>

        {/* 4. Daily Traffic Trends (Stacked Area) */}
        <div className="mt-6">
             <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[380px] transition-all duration-300">
                <div className="mb-4">
                    <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Traffic Trends</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Request volume over time by application</p>
                </div>
                <div className="flex-1 w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={app_series} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                        {apps_metrics.map((app, index) => (
                            <linearGradient key={app.name} id={`colorApp${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={getAppColor(index)} stopOpacity={0.25}/>
                                <stop offset="95%" stopColor={getAppColor(index)} stopOpacity={0}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.05)" />
                    <XAxis dataKey="time" minTickGap={30} stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dx={-4} />
                    <Tooltip contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(0,0,0,0.08)', 
                      borderRadius: '12px',
                      color: '#1d1d1f',
                      fontSize: '11px',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
                    }} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    {apps_metrics.map((app, index) => (
                        <Area 
                            key={app.name}
                            type="monotone" 
                            dataKey={app.name} 
                            stackId="1" 
                            stroke={getAppColor(index)} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill={`url(#colorApp${index})`} 
                        />
                    ))}
                    </AreaChart>
                </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>

      {/* SECTION 2: General Analytics */}
      <div>
        <h2 className="text-sm font-bold tracking-wider text-muted-foreground/80 uppercase mb-4 mt-8 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" /> General Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
             {/* 6. Status Distribution (Donut) */}
             <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
                <div className="mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Status Check</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Distribution of trace runs</p>
                </div>
                <div className="flex-1 w-full h-[220px]">
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
                                <Cell key={`cell-${index}`} fill={entry.name === 'ERROR' ? '#ff3b30' : '#34c759'} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(0,0,0,0.08)', 
                          borderRadius: '12px',
                          color: '#1d1d1f',
                          fontSize: '11px'
                        }} />
                        <Legend verticalAlign="bottom" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>

             {/* 7. Token Split (Pie) */}
             <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
                <div className="mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Token Split</h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Input vs output token allocation</p>
                </div>
                <div className="flex-1 w-full h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={token_split}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={70}
                            dataKey="value"
                        >
                            <Cell fill="#0071e3" />
                            <Cell fill="#af52de" />
                        </Pie>
                        <Tooltip contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(0,0,0,0.08)', 
                          borderRadius: '12px',
                          color: '#1d1d1f',
                          fontSize: '11px'
                        }} />
                        <Legend verticalAlign="bottom" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>

             {/* 8. Avg Latency (App) - Moved here */}
             <div className="rounded-2xl glass-card p-6 apple-hover overflow-hidden flex flex-col justify-between h-[340px] transition-all duration-300">
                 <div className="mb-2">
                     <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Avg Latency (App)</h3>
                     <p className="text-[10px] text-muted-foreground/70 mt-0.5">Avg Response time (ms)</p>
                 </div>
                 <div className="flex-1 w-full h-[220px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={apps_metrics} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.05)" />
                             <XAxis dataKey="name" stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                             <YAxis stroke="#86868b" fontSize={10} tickLine={false} axisLine={false} dx={-4} />
                             <Tooltip 
                               cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                               contentStyle={{ 
                                 backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                                 backdropFilter: 'blur(12px)',
                                 border: '1px solid rgba(0,0,0,0.08)', 
                                 borderRadius: '12px',
                                 color: '#1d1d1f',
                                 fontSize: '11px'
                               }} 
                             />
                             <Bar dataKey="avg_latency" fill="#af52de" radius={[6, 6, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
}
