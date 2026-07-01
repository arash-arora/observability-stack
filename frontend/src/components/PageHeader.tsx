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
    <div className="flex items-center justify-between pb-4 border-b border-border/10 mb-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-sans">
          {title}
        </h1>
        {infoTooltip && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={16} className="text-muted-foreground/50 hover:text-primary cursor-help transition-all duration-200 mt-1" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-card/90 backdrop-blur-md border border-border/40 text-foreground p-3 rounded-lg shadow-md max-w-xs">
                        <p className="text-xs leading-relaxed">{infoTooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
