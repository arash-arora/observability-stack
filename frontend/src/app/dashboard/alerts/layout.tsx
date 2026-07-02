"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import { usePathname, useRouter } from "next/navigation";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current tab based on pathname
  const currentTab = pathname.includes("/rules")
    ? "rules"
    : pathname.includes("/channels")
    ? "channels"
    : "active";

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title="Alerts"
        infoTooltip="Monitor and manage alerts across your applications. Configure rules, view active alerts, and set up notification channels."
      />

      <Tabs value={currentTab} onValueChange={(val) => router.push(`/dashboard/alerts/${val}`)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Alerts</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        {children}
      </Tabs>
    </div>
  );
}
