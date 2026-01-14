import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MetricHeaderProps {
  metric: any;
}

export function MetricHeader({ metric }: MetricHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-4 mb-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.back()}
        className="h-8 w-8 rounded-full"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{metric.name}</h1>
          <Badge variant="outline">{metric.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {metric.description}
        </p>
      </div>
    </div>
  );
}
