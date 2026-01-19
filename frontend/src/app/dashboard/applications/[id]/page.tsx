"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useDashboard } from "@/context/DashboardContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Activity, DollarSign, Clock, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function ApplicationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { selectedProject } = useDashboard();
  
  const [app, setApp] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && selectedProject) {
        fetchAppAndStats();
    }
  }, [id, selectedProject]);

  const fetchAppAndStats = async () => {
    setLoading(true);
    try {
        // 1. Fetch App Details to get Name
        // We iterate through all apps for now or use specific endpoint if exists
        // Assuming /management/applications/{id} exists
        const appRes = await api.get(`/management/applications/${id}`);
        setApp(appRes.data);
        
        if (appRes.data && appRes.data.name) {
            // 2. Fetch Stats using App Name
            const statsRes = await api.get(`/analytics/applications/${appRes.data.name}/stats`, {
                params: {
                    project_id: selectedProject?.id
                }
            });
            setStats(statsRes.data);
        }
    } catch (e) {
        console.error("Failed to fetch app details", e);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading application analytics...</div>;
  if (!app || !stats) return <div className="p-8">Application not found.</div>;

  const { overview, charts, evaluations } = stats;

  return (
    <div className="container mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader 
            title={app.name} 
            infoTooltip={`Analytics for ${app.name}`} 
        />
      </div>

      {/* 1. Overview Cards (6 Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Requests" value={overview.total_requests.toLocaleString()} icon={<Activity className="h-4 w-4 text-blue-500"/>} />
        <StatCard title="Total Cost" value={`$${overview.total_cost}`} icon={<DollarSign className="h-4 w-4 text-green-500"/>} />
        <StatCard title="Total Tokens" value={overview.total_tokens.toLocaleString()} icon={<Activity className="h-4 w-4 text-purple-500"/>} />
        <StatCard title="Avg Latency" value={`${overview.avg_latency}ms`} icon={<Clock className="h-4 w-4 text-yellow-500"/>} />
        <StatCard title="Error Rate" value={`${overview.error_rate}%`} icon={<AlertTriangle className="h-4 w-4 text-red-500"/>} />
        <StatCard title="P95 Latency" value={`${overview.p95_latency}ms`} icon={<Clock className="h-4 w-4 text-orange-500"/>} />
      </div>

      {/* 2. Charts Row 1: Requests & Latency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader><CardTitle>Requests over Time</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.requests_over_time}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" fontSize={11} angle={-15} textAnchor="end" height={50} />
                        <YAxis fontSize={12} />
                        <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} />
                        <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Latency Trend (Avg)</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.latency_over_time}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" fontSize={11} angle={-15} textAnchor="end" height={50} />
                        <YAxis fontSize={12} />
                        <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} />
                        <Line type="monotone" dataKey="latency" stroke="#fbbf24" strokeWidth={2} dot={false}/>
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>
      
      {/* 2b. Charts Row 2: Tokens & Cost (NEW) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Token Usage over Time</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.tokens_over_time}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" fontSize={11} angle={-15} textAnchor="end" height={50} />
                        <YAxis fontSize={12} />
                        <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} />
                        <Bar dataKey="tokens" fill="#8884d8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle>Estimated Cost over Time</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.cost_over_time}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" fontSize={11} angle={-15} textAnchor="end" height={50} />
                        <YAxis fontSize={12} tickFormatter={(val) => `$${val}`}/>
                        <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} formatter={(val: any) => [`$${val}`, "Cost"]}/>
                        <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      {/* 3. Charts Row 3: Status & Model Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="col-span-1">
            <CardHeader><CardTitle>Status Codes</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={charts.status_distribution}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={5} dataKey="value"
                        >
                            {charts.status_distribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'ERROR' ? '#ef4444' : COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
         </Card>

         <Card className="col-span-2">
            <CardHeader><CardTitle>Model Usage</CardTitle></CardHeader>
             <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.model_usage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={true} vertical={false}/>
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="name" type="category" width={150} fontSize={12} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: "#1f2937", border: "none"}}/>
                        <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
         </Card>                 
      </div>

       {/* 4. Evaluation Stats */}
      <h2 className="text-xl font-semibold mt-8 mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-green-500 w-5 h-5"/> Evaluation Performance
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <StatCard title="Total Evaluations" value={evaluations.total_evals} />
           <StatCard title="Overall Pass Rate" value={`${evaluations.pass_rate}%`} icon={<CheckCircle2 className="h-4 w-4 text-green-500"/>} />
           <StatCard title="Average Score" value={evaluations.avg_score} />
      </div>
      
      {evaluations.score_trend.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Card>
                <CardHeader><CardTitle>Evaluation Score Trend (30 Days)</CardTitle></CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evaluations.score_trend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis domain={[0, 1]} fontSize={12} />
                            <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} />
                            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader><CardTitle>Pass vs Fail Trend</CardTitle></CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.pass_fail_trend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip contentStyle={{backgroundColor: "#1f2937", border: "none"}} />
                            <Bar dataKey="passed" stackId="a" fill="#22c55e" />
                            <Bar dataKey="failed" stackId="a" fill="#ef4444" />
                            <Legend />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
          </div>
      )}

      {/* 5. Top Users */}
      <h2 className="text-xl font-semibold mt-8 mb-4 flex items-center gap-2">
         <Users className="w-5 h-5" /> Top Users
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {charts.top_users.map((u: any, i: number) => (
               <Card key={i}>
                   <CardContent className="flex justify-between items-center p-4">
                       <span className="font-mono text-sm">{u.user}</span>
                       <span className="font-bold text-lg">{u.count}</span>
                   </CardContent>
               </Card>
           ))}
      </div>

    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon?: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}
