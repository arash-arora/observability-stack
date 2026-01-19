"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader2, ArrowLeft } from "lucide-react";
import EvaluationDetailView from "@/components/evaluations/EvaluationDetailView";
import EvaluationModal from "@/components/dashboard/EvaluationModal";
import { Button } from "@/components/ui/button";

export default function RunDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const evaluationId = searchParams.get("evaluation_id");
    
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isRerunOpen, setIsRerunOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResult = async () => {
        if (!evaluationId) return;
        setLoading(true);
        try {
            const res = await api.get(`/evaluations/results/${evaluationId}`);
            setResult(res.data);
            setError(null);
        } catch (e) {
            console.error("Failed to fetch evaluation result", e);
            setError("Failed to load evaluation details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (evaluationId) {
            fetchResult();
        }
    }, [evaluationId]);

    if (!evaluationId) {
        return <div className="p-12 text-center text-muted-foreground">No evaluation ID provided.</div>;
    }

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground"/></div>;
    }

    if (error) {
        return <div className="p-12 text-center text-destructive">{error}</div>;
    }

    if (!result) {
        return <div className="p-12 text-center text-muted-foreground">Evaluation not found.</div>;
    }

    return (
        <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            <EvaluationDetailView 
                result={result} 
                onRerun={() => setIsRerunOpen(true)} 
            />

            {/* Rerun Modal */}
            <EvaluationModal
                isOpen={isRerunOpen}
                onClose={() => {
                    setIsRerunOpen(false);
                    fetchResult(); // Refresh details after rerun
                }}
                initialData={{
                    input: result.input,
                    output: result.output,
                    context: result.context
                }}
            />
        </div>
    );
}
