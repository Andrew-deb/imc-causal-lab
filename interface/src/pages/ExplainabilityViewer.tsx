import { useQuery } from "@tanstack/react-query";
import { api, ExplainabilityData, SessionSummary } from "@/lib/api";
import { useSession } from "@/contexts/SessionContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
import { buildCausalGraph } from "@/lib/causal-graph";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";

const MOCK_SESSIONS: SessionSummary[] = [
  { session_id: "s-001", date: "2025-03-15", treatment: "imc_category", outcome: "purchase", status: "completed" },
  { session_id: "s-002", date: "2025-03-10", treatment: "imc_category", outcome: "revenue", status: "completed" },
];

const MOCK: ExplainabilityData = {
  variable_roles: { age: "confounder", income: "confounder", imc_category: "treatment", purchase: "outcome" },
  imc_mapping: { ads: "advertising", email: "direct_marketing", sms: "direct_marketing", coupon: "promotion" },
  dag_edges: [
    { source: "age", target: "imc_category" },
    { source: "income", target: "imc_category" },
    { source: "imc_category", target: "purchase" },
    { source: "age", target: "purchase" },
  ],
  reasoning: "Age and income are identified as confounders that influence both the treatment (IMC category assignment) and the outcome (purchase behavior). The DAG shows that IMC category has a direct causal effect on purchase, while age and income create backdoor paths that must be controlled for unbiased estimation.",
  metrics: { ATE: 0.23, ATT: 0.18, CATE_mean: 0.15 },
};

function deriveSelectedVariables(roles: Record<string, string>) {
  const sv = { treatment: "", outcome: "", confounders: [] as string[], mediators: [] as string[], colliders: [] as string[] };
  Object.entries(roles).forEach(([v, r]) => {
    if (r === "treatment") sv.treatment = v;
    else if (r === "outcome") sv.outcome = v;
    else if (r === "confounder") sv.confounders.push(v);
    else if (r === "mediator") sv.mediators.push(v);
    else if (r === "collider") sv.colliders.push(v);
  });
  return sv;
}

export default function ExplainabilityViewer() {
  const { sessionId: ctxSessionId } = useSession();

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.getSessions().catch(() => MOCK_SESSIONS),
    placeholderData: MOCK_SESSIONS,
  });

  // Default to latest (first completed) session
  const completedSessions = (sessions ?? MOCK_SESSIONS).filter((s) => s.status === "completed");
  const latestId = completedSessions[0]?.session_id ?? ctxSessionId;

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSessionId = selectedSessionId ?? latestId;

  useEffect(() => {
    if (!selectedSessionId && latestId) setSelectedSessionId(latestId);
  }, [latestId, selectedSessionId]);

  const { data, isLoading } = useQuery({
    queryKey: ["explainability", activeSessionId],
    queryFn: () => (activeSessionId ? api.getExplainability(activeSessionId) : Promise.resolve(MOCK)),
    placeholderData: MOCK,
  });

  const d = data ?? MOCK;
  const sv = deriveSelectedVariables(d.variable_roles);
  const { nodes, edges } = buildCausalGraph(sv);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Explainability Viewer</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Explainability Viewer</h1>
          <p className="text-muted-foreground text-sm mt-1">Explore the causal reasoning behind the analysis.</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={activeSessionId ?? ""} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select session..." />
            </SelectTrigger>
            <SelectContent>
              {completedSessions.map((s) => (
                <SelectItem key={s.session_id} value={s.session_id} className="text-sm">
                  {s.date} — {s.treatment} → {s.outcome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Variable Roles</TabsTrigger>
          <TabsTrigger value="mapping">IMC Mapping</TabsTrigger>
          <TabsTrigger value="dag">Causal DAG</TabsTrigger>
          <TabsTrigger value="reasoning">PyWhy Reasoning</TabsTrigger>
          <TabsTrigger value="metrics">Causal Metrics</TabsTrigger>
          <TabsTrigger value="model-comparison">Model Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle className="text-base">Variable Roles</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Variable</TableHead><TableHead>Role</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(d.variable_roles).map(([v, r]) => (
                    <TableRow key={v}>
                      <TableCell className="font-mono text-sm">{v}</TableCell>
                      <TableCell className="capitalize text-sm">{r}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader><CardTitle className="text-base">IMC Mapping</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Campaign Type</TableHead><TableHead>IMC Category</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(d.imc_mapping).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-sm">{k}</TableCell>
                      <TableCell className="capitalize text-sm">{v.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dag">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Causal DAG</CardTitle>
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { role: "Treatment", color: "hsl(200, 60%, 50%)" },
                  { role: "Outcome", color: "hsl(140, 50%, 45%)" },
                  { role: "Confounder", color: "hsl(35, 70%, 50%)" },
                  { role: "Mediator", color: "hsl(270, 40%, 55%)" },
                  { role: "Collider", color: "hsl(0, 50%, 55%)" },
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
                <ReactFlow nodes={nodes} edges={edges} fitView>
                  <Background />
                  <Controls />
                </ReactFlow>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reasoning">
          <Card>
            <CardHeader><CardTitle className="text-base">PyWhy Reasoning</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{d.reasoning}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader><CardTitle className="text-base">Causal Metrics</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Metric</TableHead><TableHead>Value</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(d.metrics).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-sm">{k}</TableCell>
                      <TableCell className="font-mono text-sm">{(v * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model-comparison">
          <ModelComparisonTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
