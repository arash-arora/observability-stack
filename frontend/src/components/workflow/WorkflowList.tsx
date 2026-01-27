import React from 'react';
import { Button } from "@/components/ui/button";
import { Play, Edit, Trash2, Globe } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface Workflow {
    id: string;
    name: string;
    description: string | null;
    updated_at: string;
    is_published: boolean | null;
}

interface WorkflowListProps {
    workflows: Workflow[];
    onRun?: (workflow: Workflow) => void;
    onEdit?: (workflow: Workflow) => void;
    onDelete?: (workflow: Workflow) => void;
    readonly?: boolean;
}

export default function WorkflowList({ workflows, onRun, onEdit, onDelete, readonly = false }: WorkflowListProps) {
    if (workflows.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No workflows found.</div>;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
                <div key={workflow.id} className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-4">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold truncate" title={workflow.name}>{workflow.name}</h3>
                            {workflow.is_published && (
                                <span title="Published">
                                    <Globe size={14} className="text-green-500" />
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                            {workflow.description || "No description provided."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Updated {formatDistanceToNow(new Date(workflow.updated_at))} ago
                        </p>
                    </div>
                    
                    <div className="flex gap-2 mt-auto">
                        {onRun && (
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => onRun(workflow)}>
                                <Play className="mr-2 h-4 w-4" /> Run
                            </Button>
                        )}
                        {onEdit && !readonly && (
                            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onEdit(workflow)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                        )}
                         {onDelete && !readonly && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(workflow)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
