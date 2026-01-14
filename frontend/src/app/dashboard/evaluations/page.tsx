import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EvaluationsOverview from "@/components/evaluations/EvaluationsOverview";
import EvaluationsList from "@/components/evaluations/EvaluationsList";

export default function EvaluationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">

      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
            <EvaluationsOverview />
        </TabsContent>
        <TabsContent value="evaluations" className="space-y-4">
            <EvaluationsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
