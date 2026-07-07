"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader2, ArrowLeft } from "lucide-react";
import EvaluationDetailView from "@/components/evaluations/EvaluationDetailView";
import EvaluationGroupView from "@/components/evaluations/EvaluationGroupView";
import BatchEvalDetailView from "@/components/evaluations/BatchEvalDetailView";
import EvaluationModal from "@/components/dashboard/EvaluationModal";
import { Button } from "@/components/ui/button";

export default function RunDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const evaluationId = searchParams.get("evaluation_id");
    const legacyTraceId = searchParams.get("trace_id");
    const batchId = searchParams.get("batch_id");

    // Determine mode:
    // - batch_id  → group view: fetch all results for a batch
    // - evaluation_id (UUID) → single result view
    // - evaluation_id (non-UUID) or trace_id → group view: fetch all results for a trace
    const isUUID = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

    const traceGroupId = !batchId
        ? (legacyTraceId || (evaluationId && !isUUID(evaluationId) ? evaluationId : null))
        : null;
    const singleEvalId = !batchId && evaluationId && isUUID(evaluationId) ? evaluationId : null;

    const [result, setResult] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [traceDetails, setTraceDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isRerunOpen, setIsRerunOpen] = useState(false);
    const [rerunData, setRerunData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [batchTitle, setBatchTitle] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (batchId) {
                // Fetch all evaluation results for this batch
                const res = await api.get(`/evaluations/results?batch_id=${batchId}&limit=500`);
                setResults(res.data);
                setBatchTitle(`Batch Evaluation — ${batchId.substring(0, 8)}...`);
            } else if (traceGroupId) {
                const resultsRes = await api.get(`/evaluations/results?trace_id=${traceGroupId}`);
                setResults(resultsRes.data);

                try {
                    const traceRes = await api.get(`/analytics/traces/${traceGroupId}`);
                    setTraceDetails(traceRes.data);
                } catch (err) {
                    console.warn("Failed to fetch additional trace details", err);
                }
            } else if (singleEvalId) {
                const res = await api.get(`/evaluations/results/${singleEvalId}`);
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
        if (batchId || singleEvalId || traceGroupId) {
            fetchData();
        }
    }, [batchId, singleEvalId, traceGroupId]);

    const handleRerun = (data: any = result) => {
        setRerunData(data);
        setIsRerunOpen(true);
    };

    if (!batchId && !singleEvalId && !traceGroupId) {
        return <div className="p-12 text-center text-muted-foreground">No evaluation ID provided.</div>;
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

            {batchTitle && (
                <h2 className="text-lg font-semibold text-foreground">{batchTitle}</h2>
            )}

            {batchId ? (
                <BatchEvalDetailView results={results} batchTitle={batchTitle ?? undefined} />
            ) : traceGroupId ? (
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

            {rerunData && (
                <EvaluationModal
                    isOpen={isRerunOpen}
                    onClose={() => {
                        setIsRerunOpen(false);
                        fetchData();
                    }}
                    initialData={{
                        input: rerunData.input,
                        output: rerunData.output,
                        context: rerunData.context,
                        trace: {
                            trace_id: rerunData.trace_id || traceGroupId
                        }
                    }}
                />
            )}
        </div>
    );
}


