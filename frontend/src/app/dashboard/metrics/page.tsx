"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Info,
  MoreHorizontal,
  FlaskConical,
  Beaker,
  Edit2,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useDashboard } from "@/context/DashboardContext";

// --- Inline Components ---
const Button = ({
  children,
  className,
  variant = "primary",
  ...props
}: any) => {
  const baseClass =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline:
      "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
  };
  return (
    <button
      className={`${baseClass} ${
        variants[variant as keyof typeof variants]
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: any) => (
  <input
    className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Badge = ({ children, variant = "default", className }: any) => {
  const base =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default:
      "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary:
      "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "text-foreground",
  };
  return (
    <div
      className={`${base} ${
        variants[variant as keyof typeof variants]
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface Metric {
  id: string;
  name: string;
  type: string;
  tags: string[];
  description: string;
  code: string;
  inputs: string[];
}

export default function MetricsPage() {
  const router = useRouter();
  const { selectedOrg } = useDashboard();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<
    "all" | "preset" | "custom"
  >("all");
  const [loading, setLoading] = useState(true);

  // Check permissions
  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setFetchError(null);
        const res = await api.get("/evaluations/metrics");
        const mapped = res.data.map((m: any) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          tags: m.tags || [],
          description: m.description,
          code: m.code_snippet,
          inputs: m.inputs || [],
        }));
        setMetrics(mapped);
      } catch (err: any) {
        console.error("Failed to fetch metrics", err);
        setFetchError(err.response?.data?.detail || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const filteredMetrics = metrics.filter((metric) => {
    const matchesSearch =
      metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      metric.tags.some((tag: string) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesSource =
      selectedSource === "all"
        ? true
        : selectedSource === "preset"
        ? metric.tags.includes("preset")
        : !metric.tags.includes("preset");
    return matchesSearch && matchesSource;
  });

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete the metric "${name}"?`)) {
          try {
              await api.delete(`/evaluations/metrics/${id}`);
              setMetrics(metrics.filter(m => m.id !== id));
          } catch (err: any) {
              console.error(err);
              alert("Failed to delete metric: " + (err.response?.data?.detail || err.message));
          }
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Metrics Hub" 
        infoTooltip="Manage and explore your evaluation metrics. Define custom metrics or use preset ones." 
      >
        {canCreate && (
            <Button
                variant="primary"
                className="shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
                onClick={() => router.push("/dashboard/metrics/new")}
            >
                <Plus size={16} />
                Create Metric
            </Button>
        )}
      </PageHeader>

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <div className="w-64 space-y-8 shrink-0">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Source
            </h3>
            <div className="flex flex-col gap-1">
              <Button
                variant={selectedSource === "all" ? "secondary" : "ghost"}
                className="justify-start w-full text-left"
                onClick={() => setSelectedSource("all")}
              >
                All Metrics
              </Button>
              <Button
                variant={selectedSource === "preset" ? "secondary" : "ghost"}
                className="justify-start w-full text-left"
                onClick={() => setSelectedSource("preset")}
              >
                SDK Metrics
              </Button>
              <Button
                variant={selectedSource === "custom" ? "secondary" : "ghost"}
                className="justify-start w-full text-left"
                onClick={() => setSelectedSource("custom")}
              >
                Custom Metrics
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                "preset",
                "custom",
                "rag",
                "safety",
                "agents",
                "tools"
              ].map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or tag..."
              className="pl-9 bg-background/50 backdrop-blur-sm"
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Metrics Tables */}
          {fetchError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {filteredMetrics.filter(m => m.type === 'custom').length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FlaskConical size={18} className="text-primary" />
                My Custom Metrics
                <Badge variant="secondary" className="ml-2 font-normal">{filteredMetrics.filter(m => m.type === 'custom').length}</Badge>
              </h2>
              <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                <div className="w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="bg-muted/50">
                      <tr className="border-b transition-colors">
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[400px]">Metric Details</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Required Inputs</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Tags</th>
                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0 bg-card">
                      {filteredMetrics.filter(m => m.type === 'custom').map((metric) => (
                        <tr
                          key={metric.id}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                          onClick={() => router.push(`/dashboard/metrics/${metric.id}`)}
                        >
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-sm text-foreground">{metric.name}</span>
                              <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{metric.description}</span>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                             <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20">
                                {metric.type}
                             </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                                {metric.inputs.map((input) => (
                                    <code key={input} className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold text-muted-foreground">
                                        {input}
                                    </code>
                                ))}
                                {metric.inputs.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex gap-1.5 flex-wrap">
                              {metric.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal border border-border">{tag}</Badge>
                              ))}
                              {metric.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground self-center ml-1">+{metric.tags.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-middle text-right">
                              <div className="flex items-center justify-end gap-2 text-muted-foreground">
                                  <button 
                                      className="p-1.5 cursor-pointer hover:bg-muted hover:text-foreground rounded transition-colors"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/dashboard/metrics/${metric.id}/edit`);
                                      }}
                                      title="Edit Metric"
                                  >
                                      <Edit2 size={16} />
                                  </button>
                                  <button 
                                      className="p-1.5 cursor-pointer hover:bg-destructive/10 text-destructive rounded transition-colors"
                                      onClick={(e) => handleDelete(e, metric.id, metric.name)}
                                      title="Delete Metric"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {filteredMetrics.filter(m => m.type !== 'custom').length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Beaker size={18} className="text-muted-foreground" />
                SDK Preset Metrics
                <Badge variant="secondary" className="ml-2 font-normal">{filteredMetrics.filter(m => m.type !== 'custom').length}</Badge>
              </h2>
              <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                <div className="w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="bg-muted/50">
                      <tr className="border-b transition-colors">
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[400px]">Metric Details</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Required Inputs</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Tags</th>
                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0 bg-card">
                      {filteredMetrics.filter(m => m.type !== 'custom').map((metric) => (
                        <tr
                          key={metric.id}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                          onClick={() => router.push(`/dashboard/metrics/${metric.id}`)}
                        >
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-sm text-foreground">{metric.name}</span>
                              <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{metric.description}</span>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                             <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                {metric.type}
                             </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                                {metric.inputs.map((input) => (
                                    <code key={input} className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold text-muted-foreground">
                                        {input}
                                    </code>
                                ))}
                                {metric.inputs.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex gap-1.5 flex-wrap">
                              {metric.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal border border-border">{tag}</Badge>
                              ))}
                              {metric.tags.length > 3 && (
                                <span className="text-xs text-muted-foreground self-center ml-1">+{metric.tags.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-middle text-right text-muted-foreground">
                              -
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {filteredMetrics.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No metrics found matching your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
