"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageHeaderProps {
  title: string;
  infoTooltip?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, infoTooltip, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {infoTooltip && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={18} className="text-muted-foreground/60 hover:text-muted-foreground cursor-help transition-colors mt-1" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="max-w-xs text-sm">{infoTooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}
