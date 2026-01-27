"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader2, ArrowLeft } from "lucide-react";
import EvaluationDetailView from "@/components/evaluations/EvaluationDetailView";
import EvaluationGroupView from "@/components/evaluations/EvaluationGroupView";
import EvaluationModal from "@/components/dashboard/EvaluationModal";
import { Button } from "@/components/ui/button";

export default function RunDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const evaluationId = searchParams.get("evaluation_id");
    const traceId = searchParams.get("trace_id");
    
    const [result, setResult] = useState<any>(null); // Single result
    const [results, setResults] = useState<any[]>([]); // Group results
    const [traceDetails, setTraceDetails] = useState<any>(null); // Full trace data
    const [loading, setLoading] = useState(true);
    const [isRerunOpen, setIsRerunOpen] = useState(false);
    const [rerunData, setRerunData] = useState<any>(null); // Data for rerun modal
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (traceId) {
                const resultsRes = await api.get(`/evaluations/results?trace_id=${traceId}`);
                setResults(resultsRes.data);
                
                // Fetch trace details for agent info
                try {
                    const traceRes = await api.get(`/analytics/traces/${traceId}`);
                    setTraceDetails(traceRes.data);
                } catch (err) {
                    console.warn("Failed to fetch additional trace details", err);
                }
            } else if (evaluationId) {
                const res = await api.get(`/evaluations/results/${evaluationId}`);
                setResult(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch evaluation data", e);
            setError("Failed to load evaluation details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (evaluationId || traceId) {
            fetchData();
        }
    }, [evaluationId, traceId]);

    const handleRerun = (data: any = result) => {
        setRerunData(data);
        setIsRerunOpen(true);
    };

    if (!evaluationId && !traceId) {
        return <div className="p-12 text-center text-muted-foreground">No evaluation or trace ID provided.</div>;
    }

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground"/></div>;
    }

    if (error) {
        return <div className="p-12 text-center text-destructive">{error}</div>;
    }

    if (!result && results.length === 0) {
        return <div className="p-12 text-center text-muted-foreground">Evaluation not found.</div>;
    }

    return (
        <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            {traceId ? (
                 <EvaluationGroupView 
                    results={results} 
                    traceDetails={traceDetails}
                    onRerun={handleRerun} 
                 />
            ) : (
                <EvaluationDetailView 
                    result={result} 
                    onRerun={() => handleRerun(result)} 
                />
            )}

            {/* Rerun Modal */}
            {rerunData && (
                <EvaluationModal
                    isOpen={isRerunOpen}
                    onClose={() => {
                        setIsRerunOpen(false);
                        fetchData(); // Refresh details after rerun
                    }}
                    initialData={{
                        input: rerunData.input,
                        output: rerunData.output,
                        context: rerunData.context
                    }}
                />
            )}
        </div>
    );
}
