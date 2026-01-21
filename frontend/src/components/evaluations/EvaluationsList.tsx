"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Activity } from "lucide-react";
import EvaluationModal from "@/components/dashboard/EvaluationModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationResult {
  id: string;
  created_at: string;
  metric_id: string;
  input: string;
  output: string;
  context: string[];
  expected_output: string;
  score: number;
  passed: boolean;
  reason: string;
  application_name?: string;
  trace_id?: string;
}

export default function EvaluationsList() {
  const router = useRouter();
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<EvaluationResult | null>(null);
  const [isRerunOpen, setIsRerunOpen] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get("/evaluations/results");
      setResults(res.data);
    } catch (e) {
      console.error("Failed to fetch results", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleRerun = (result: EvaluationResult) => {
      setSelectedResult(result);
      setIsRerunOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchResults}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Trace</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Input Preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow 
                key={result.id} 
                className="cursor-pointer hover:bg-muted/50" 
                onClick={() => router.push(`/dashboard/evaluations/run?evaluation_id=${result.id}`)}
              >
                <TableCell className="font-mono text-xs">
                  {format(new Date(result.created_at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="text-sm text-foreground/80">
                   {result.application_name || "-"}
                </TableCell>
                <TableCell>
                  {result.trace_id ? (
                    <Link href={`/dashboard/traces?trace_id=${result.trace_id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Activity className="h-4 w-4 text-blue-500" />
                        </Button>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                        {result.metric_id.replace("Evaluator", "")}
                    </Badge>
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-muted-foreground text-sm">
                  {result.input}
                </TableCell>
                <TableCell>
                  <Badge variant={result.passed ? "default" : "destructive"} className={result.passed ? "bg-green-500 hover:bg-green-600" : ""}>
                    {result.passed ? "Passed" : "Failed"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-bold">
                  {result.score.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRerun(result);
                        }}
                    >
                        Rerun
                    </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && results.length === 0 && (
                <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No evaluations found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rerun Modal */}
      {selectedResult && (
          <EvaluationModal
            isOpen={isRerunOpen}
            onClose={() => {
                setIsRerunOpen(false);
                fetchResults(); // Refresh list after rerun
            }}
            initialData={{
                input: selectedResult.input,
                output: selectedResult.output,
                context: selectedResult.context
            }}
          />
      )}
    </div>
  );
}
