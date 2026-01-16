"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const Tooltip = ({ children }: { children: React.ReactNode }) => {
    return <div className="group relative inline-block">{children}</div>;
};

const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
    // If asChild is true, we should probably clone the child, but for simple substitution:
    return <>{children}</>;
};

const TooltipContent = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return (
        <div className={cn(
            "absolute z-50 max-w-xs rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md transition-all",
            "invisible opacity-0 group-hover:visible group-hover:opacity-100",
            "bottom-full left-1/2 -translate-x-1/2 mb-2 w-max",
            className
        )}>
            {children}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
        </div>
    );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
