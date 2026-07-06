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
  Sparkles,
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
      className={`${baseClass} ${variants[variant as keyof typeof variants]
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
      className={`${base} ${variants[variant as keyof typeof variants]
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

  // Calculate summary counts
  const totalMetrics = metrics.length;
  const customMetrics = metrics.filter(m => m.type === "custom").length;
  const sdkMetrics = metrics.filter(m => m.tags.includes("preset")).length;

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        {/* Total Metrics */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-[#0071e3]/10">
              <FlaskConical size={20} className="text-[#0071e3]" />
            </div>
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Total Metrics</h3>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{totalMetrics}</div>
          <div className="text-xs text-[#6e6e73] mt-2">All available metrics</div>
        </div>

        {/* Custom Metrics */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Beaker size={20} className="text-emerald-600" />
            </div>
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">Custom Metrics</h3>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{customMetrics}</div>
          <div className="text-xs text-[#6e6e73] mt-2">User-defined evaluations</div>
        </div>

        {/* SDK Metrics */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.04)] transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Sparkles size={20} className="text-amber-600" />
            </div>
            <h3 className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest">SDK Metrics</h3>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{sdkMetrics}</div>
          <div className="text-xs text-[#6e6e73] mt-2">Pre-built evaluations</div>
        </div>
      </div>

      {/* Horizontal Filter Bar */}
      <div className="flex items-center gap-4 bg-white/70 backdrop-blur-xl border border-black/[0.04] rounded-2xl p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or tag..."
            className="pl-9 bg-white border-black/[0.08]"
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Type Pills */}
        <div className="flex items-center gap-2 border-l border-black/[0.08] pl-4">
          <span className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wider">Type:</span>
          <button
            onClick={() => setSelectedSource("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              selectedSource === "all"
                ? "bg-[#0071e3] text-white shadow-sm"
                : "bg-white text-[#6e6e73] hover:bg-[#0071e3]/10 border border-black/[0.08]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedSource("preset")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              selectedSource === "preset"
                ? "bg-[#0071e3] text-white shadow-sm"
                : "bg-white text-[#6e6e73] hover:bg-[#0071e3]/10 border border-black/[0.08]"
            }`}
          >
            SDK Metrics
          </button>
          <button
            onClick={() => setSelectedSource("custom")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              selectedSource === "custom"
                ? "bg-[#0071e3] text-white shadow-sm"
                : "bg-white text-[#6e6e73] hover:bg-[#0071e3]/10 border border-black/[0.08]"
            }`}
          >
            Custom Metrics
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">

        {/* Error Message */}
        {fetchError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* Unified Metrics Table */}
        {filteredMetrics.length > 0 ? (
          <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="w-full overflow-auto">
              <table className="w-full caption-bottom text-sm text-left">
                <thead className="bg-black/[0.02]">
                  <tr className="border-b border-black/[0.04]">
                    <th className="h-10 px-4 text-left align-middle font-semibold text-[#6e6e73] text-[11px] uppercase tracking-wider w-[500px]">Metric Details</th>
                    <th className="h-10 px-4 text-left align-middle font-semibold text-[#6e6e73] text-[11px] uppercase tracking-wider">Type</th>
                    <th className="h-10 px-4 text-left align-middle font-semibold text-[#6e6e73] text-[11px] uppercase tracking-wider">Required Inputs</th>
                    <th className="h-10 px-4 text-right align-middle font-semibold text-[#6e6e73] text-[11px] uppercase tracking-wider w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0 bg-white/50">
                  {filteredMetrics.map((metric) => (
                    <tr
                      key={metric.id}
                      className="border-b border-black/[0.04] transition-colors hover:bg-black/[0.02] cursor-pointer"
                      onClick={() => router.push(`/dashboard/metrics/${metric.id}`)}
                    >
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#1d1d1f]">{metric.name}</span>
                            {metric.tags.includes("preset") && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium bg-amber-100 text-amber-700 border-amber-200">SDK</Badge>
                            )}
                            {metric.type === 'custom' && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium bg-emerald-100 text-emerald-700 border-emerald-200">Custom</Badge>
                            )}
                          </div>
                          <span className="text-xs text-[#6e6e73] line-clamp-2 leading-relaxed">{metric.description}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium bg-[#0071e3]/10 text-[#0071e3]">
                          {metric.type}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {metric.inputs.map((input) => (
                            <code key={input} className="relative rounded bg-black/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1d1d1f]">
                              {input}
                            </code>
                          ))}
                          {metric.inputs.length === 0 && <span className="text-[#6e6e73] text-xs">-</span>}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-right">
                        {metric.type === 'custom' ? (
                          <div className="flex items-center justify-end gap-2 text-[#6e6e73]">
                            <button
                              className="p-1.5 cursor-pointer hover:bg-[#0071e3]/10 hover:text-[#0071e3] rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/metrics/${metric.id}/edit`);
                              }}
                              title="Edit Metric"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="p-1.5 cursor-pointer hover:bg-red-50 text-red-600 rounded transition-colors"
                              onClick={(e) => handleDelete(e, metric.id, metric.name)}
                              title="Delete Metric"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#6e6e73] text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-[#6e6e73] text-sm font-medium">
            No metrics found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
