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
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button onClick={() => router.back()} className="p-2 border border-black/[0.04] bg-white hover:bg-neutral-50 rounded-xl transition-all shadow-sm cursor-pointer text-[#6e6e73] hover:text-[#1d1d1f]">
            <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-[#1d1d1f] font-mono">Trace: {id}</h1>
      </div>

      <div className="flex-1 min-h-0">
        <TraceTree spans={data.spans} observations={data.observations} traceId={id as string} />
      </div>
    </div>
  );
}
