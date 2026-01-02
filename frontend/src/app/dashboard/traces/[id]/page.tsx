"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import TraceTree from '@/components/TraceTree';

export default function TraceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<{ spans: any[], observations: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchTrace(id as string);
  }, [id]);

  const fetchTrace = async (traceId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/analytics/traces/${traceId}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading trace...</div>;
  if (!data) return <div className="p-8">Trace not found</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="btn btn-outline p-2">
            <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold font-mono">Trace: {id}</h1>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Execution Trace</h2>
        <TraceTree spans={data.spans} observations={data.observations} />
      </div>
    </div>
  );
}
