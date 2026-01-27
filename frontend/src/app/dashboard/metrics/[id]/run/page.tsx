"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MetricHeader } from "@/components/metrics/MetricHeader";
import { MetricTabs } from "@/components/metrics/MetricTabs";
import { MetricRun } from "@/components/metrics/MetricRun";

export default function MetricRunPage() {
  const router = useRouter();
  const params = useParams();
  const [metric, setMetric] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetric = async () => {
      try {
        const res = await api.get("/evaluations/metrics");
        const data = res.data;
        const found = data.find((m: any) => m.id === params.id);
        if (found) {
          setMetric({
            id: found.id,
            name: found.name,
            type: found.type,
            level: "Trace",
            tags: found.tags || [],
            owner: found.provider,
            lastEdit: "-",
            description: found.description,
            code: found.code_snippet,
            prompt: found.prompt,
            dummy_data: found.dummy_data,
            inputs: found.inputs || [],
          });
        }
      } catch (_e) {
        console.error("Failed to fetch metric details");
      } finally {
        setLoading(false);
      }
    };
    fetchMetric();
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading metric details...
      </div>
    );
  }

  if (!metric) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold">Metric not found</h2>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 py-6">
      <MetricHeader metric={metric} />
      <MetricTabs metricId={metric.id} activeTab="run" />
      <div className="mt-6">
        <MetricRun metric={metric} />
      </div>
    </div>
  );
}
