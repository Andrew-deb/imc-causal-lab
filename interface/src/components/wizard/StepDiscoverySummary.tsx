import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionContext";
import { api, CausalDiscoveryResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildCausalGraph, ROLE_COLORS } from "@/lib/causal-graph";

const MOCK: CausalDiscoveryResult = {
  dag_edges: [
    { source: "age", target: "imc_category" },
    { source: "income", target: "imc_category" },
    { source: "imc_category", target: "purchase" },
    { source: "age", target: "purchase" },
    { source: "income", target: "purchase" },
  ],
  reasoning:
    "Age and income are identified as confounders influencing both IMC category assignment and purchase behavior. The backdoor criterion is satisfied by conditioning on age and income. The causal effect of IMC exposure on purchase can be identified via adjustment.",
  selected_variables: {
    treatment: "imc_category",
    outcome: "purchase",
    confounders: ["age", "income"],
    mediators: [],
    colliders: [],
  },
};

export default function StepDiscoverySummary({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { sessionId } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["causal-discovery", sessionId],
    queryFn: () => (sessionId ? api.getCausalDiscovery(sessionId) : Promise.resolve(MOCK)),
    placeholderData: MOCK,
  });

  const d = data ?? MOCK;
  const { nodes, edges } = buildCausalGraph(d.selected_variables);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Variables */}
      <Card>
        <CardHeader><CardTitle className="text-base">Selected Variables</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Role</TableHead><TableHead>Variable(s)</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-sm">Treatment</TableCell>
                <TableCell><Badge variant="secondary">{d.selected_variables.treatment}</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-sm">Outcome</TableCell>
                <TableCell><Badge variant="secondary">{d.selected_variables.outcome}</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-sm">Confounders</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {d.selected_variables.confounders.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                </TableCell>
              </TableRow>
              {d.selected_variables.mediators.length > 0 && (
                <TableRow>
                  <TableCell className="font-medium text-sm">Mediators</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {d.selected_variables.mediators.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
                  </TableCell>
                </TableRow>
              )}
              {d.selected_variables.colliders.length > 0 && (
                <TableRow>
                  <TableCell className="font-medium text-sm">Colliders</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {d.selected_variables.colliders.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PyWhy Reasoning */}
      <Card>
        <CardHeader><CardTitle className="text-base">PyWhy Causal Reasoning</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{d.reasoning}</p>
        </CardContent>
      </Card>

      {/* Causal DAG */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Causal DAG</CardTitle>
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              { role: "Treatment", color: ROLE_COLORS.treatment },
              { role: "Outcome", color: ROLE_COLORS.outcome },
              { role: "Confounder", color: ROLE_COLORS.confounder },
              { role: "Mediator", color: ROLE_COLORS.mediator },
              { role: "Collider", color: ROLE_COLORS.collider },
            ].map((l) => (
              <span key={l.role} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.role}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] border rounded-lg overflow-hidden">
            <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable>
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Generate Causal Estimates</Button>
      </div>
    </div>
  );
}
