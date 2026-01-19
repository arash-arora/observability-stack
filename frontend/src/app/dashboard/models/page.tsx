"use client";

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelRegistry from '@/components/models/ModelRegistry';
import ModelPlayground from '@/components/models/ModelPlayground';

export default function ModelHubPage() {
  const [activeTab, setActiveTab] = useState("registry");

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-6rem)]">
      <PageHeader 
        title="Model Hub" 
        infoTooltip="Register and test your LLMs to reuse credentials across the platform." 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col gap-4">
          <TabsList className="w-fit">
              <TabsTrigger value="registry">Model Registry</TabsTrigger>
              <TabsTrigger value="playground">Playground</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-auto space-y-4">
              <TabsContent value="registry" className="m-0 h-full">
                  <ModelRegistry />
              </TabsContent>
              <TabsContent value="playground" className="m-0 h-full">
                  <ModelPlayground />
              </TabsContent>
          </div>
      </Tabs>
    </div>
  );
}
