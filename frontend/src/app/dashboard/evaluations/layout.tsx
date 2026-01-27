"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import { usePathname, useRouter } from "next/navigation";

export default function EvaluationsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // "runs" tab active for both /runs and /run (detail)
  const currentTab = pathname.includes("/run") ? "runs" : pathname.includes("/autoeval") ? "autoeval" : "overview";

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader 
        title="Evaluations" 
        infoTooltip="Run and analyze evaluations for your LLM applications." 
      />
      
      <Tabs value={currentTab} onValueChange={(val) => router.push(`/dashboard/evaluations/${val}`)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Evaluations</TabsTrigger>
          <TabsTrigger value="autoeval">Auto Eval</TabsTrigger>
        </TabsList>
        {children}
      </Tabs>
    </div>
  );
}
