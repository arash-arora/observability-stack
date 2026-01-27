"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, Bot, Network } from "lucide-react";
import ToolsTab from '@/components/workflow/ToolsTab';
import AgentsTab from '@/components/workflow/AgentsTab';
import GraphsTab from '@/components/workflow/GraphsTab';
import SavedTab from '@/components/workflow/SavedTab';
import PublishedTab from '@/components/workflow/PublishedTab';

export default function WorkflowPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get('tab') || 'graphs';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/dashboard/workflow?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Workflow Builder</h2>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          <TabsTrigger 
            value="tools"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-medium"
          >
            <div className="flex items-center gap-2">
              <Hammer size={16} />
              <span>Tools</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="agents"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-medium"
          >
             <div className="flex items-center gap-2">
              <Bot size={16} />
              <span>Agents</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="graphs"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-medium"
          >
             <div className="flex items-center gap-2">
              <Network size={16} />
              <span>Builder</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="saved"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-medium"
          >
             <div className="flex items-center gap-2">
              <span>Saved Workflows</span>
            </div>
          </TabsTrigger>
           <TabsTrigger 
            value="published"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-medium"
          >
             <div className="flex items-center gap-2">
              <span>Published</span>
            </div>
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 mt-4 overflow-hidden">
            <TabsContent value="tools" className="h-full m-0 data-[state=active]:flex flex-col">
                <ToolsTab />
            </TabsContent>
            <TabsContent value="agents" className="h-full m-0 data-[state=active]:flex flex-col">
                <AgentsTab />
            </TabsContent>
            <TabsContent value="graphs" className="h-full m-0 data-[state=active]:flex flex-col">
                <GraphsTab />
            </TabsContent>
            <TabsContent value="saved" className="h-full m-0 data-[state=active]:flex flex-col">
                <SavedTab />
            </TabsContent>
             <TabsContent value="published" className="h-full m-0 data-[state=active]:flex flex-col">
                <PublishedTab />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
