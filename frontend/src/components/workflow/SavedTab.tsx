"use client";

import { useEffect, useState } from 'react';
import { getWorkflows } from '@/lib/workflow-api';
import WorkflowList from './WorkflowList';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SavedTab() {
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            // Fetch all workflows
            const data = await getWorkflows(); 
            setWorkflows(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const handleEdit = (workflow: any) => {
        // Navigate to the builder (Graphs tab) with this workflow ID
        // We'll implement query param handling in GraphsTab later, 
        // for now just pushing the ID to URL
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'graphs');
        params.set('workflowId', workflow.id);
        router.push(`/dashboard/workflow?${params.toString()}`);
    };

    const handleRun = (workflow: any) => {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'graphs');
        params.set('workflowId', workflow.id);
        params.set('run', 'true'); // Optional: Trigger run dialog immediately
        router.push(`/dashboard/workflow?${params.toString()}`);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="h-full overflow-y-auto p-1">
            <WorkflowList 
                workflows={workflows} 
                onEdit={handleEdit}
                onRun={handleRun}
                // onDelete={} // TODO: Implement delete API
            />
        </div>
    );
}
