"use client";

import { useEffect, useState } from 'react';
import { getWorkflows } from '@/lib/workflow-api';
import WorkflowList from './WorkflowList';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PublishedTab() {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchWorkflows = async () => {
            setLoading(true);
            try {
                // Fetch published workflows only
                const data = await getWorkflows(true); 
                setWorkflows(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflows();
    }, []);

    const handleRun = (workflow: any) => {
        // For simple running, we can reuse the GraphsTab logic by loading it there
        // Or implement a dedicated runner. For consistency, let's load into GraphsTab
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'graphs');
        params.set('workflowId', workflow.id);
        params.set('mode', 'view'); // Optional: View-only mode for published?
        router.push(`/dashboard/workflow?${params.toString()}`);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="h-full overflow-y-auto p-1">
             <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                    These workflows have been published and are ready for use.
                </p>
            </div>
            <WorkflowList 
                workflows={workflows} 
                onRun={handleRun}
                readonly
            />
        </div>
    );
}
