import Link from "next/link";

interface MetricTabsProps {
  metricId: string;
  activeTab: "info" | "run";
}

export function MetricTabs({ metricId, activeTab }: MetricTabsProps) {
  return (
    <div className="border-b">
      <div className="flex h-10 items-center gap-4">
        <Link
          href={`/dashboard/metrics/${metricId}`}
          className={`h-10 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
            activeTab === "info"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Definition & Usage
        </Link>
        <Link
          href={`/dashboard/metrics/${metricId}/run`}
          className={`h-10 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
            activeTab === "run"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Run Evaluation
        </Link>
      </div>
    </div>
  );
}
