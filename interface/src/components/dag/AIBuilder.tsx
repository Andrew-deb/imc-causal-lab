import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, RefreshCw, Save, Loader2, ArrowLeft, Zap } from "lucide-react";
import TagInput from "./TagInput";
import DAGCanvas, { edgeKey } from "./DAGCanvas";
import VariableRolesPanel from "./VariableRolesPanel";
import EdgeReasoningSheet from "./EdgeReasoningSheet";
import { discoverDAG, type CausalEdgeFull, type SavedDAG, type VariableRoles } from "@/lib/dag-store";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSaved: (dag: SavedDAG) => void;
  onCancel?: () => void;
  saveDag: (dag: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & { dag_id?: string }) => Promise<SavedDAG>;
  embedded?: boolean;
  sessionId?: string | null;
}

const STEPS = [
  "Identifying domain expertise…",
  "Classifying variable roles…",
  "Discovering causal relationships…",
];

export default function AIBuilder({ onSaved, onCancel, saveDag, embedded, sessionId }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("Marketing Funnel v1");
  const [variables, setVariables] = useState<string[]>(["age", "income", "engagement"]);
  const [treatment, setTreatment] = useState("IMC_Exposure");
  const [outcome, setOutcome] = useState("purchase");

  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [edges, setEdges] = useState<CausalEdgeFull[] | null>(null);
  const [roles, setRoles] = useState<VariableRoles | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [selected, setSelected] = useState<CausalEdgeFull | null>(null);
  const [saving, setSaving] = useState(false);

  const allVars = Array.from(new Set([treatment, outcome, ...variables].filter(Boolean)));

  const runDiscovery = async () => {
    if (!treatment || !outcome || variables.length < 1 || !name.trim()) {
      toast({ title: "Missing fields", description: "Name, treatment, outcome, and at least one variable are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setEdges(null);
    setError(null);
    setStepIdx(0);

    // Simulate step progression while the API is running.
    const t1 = setTimeout(() => setStepIdx(1), 2000);
    const t2 = setTimeout(() => setStepIdx(2), 5000);

    try {
      const res = await discoverDAG({
        variables: allVars,
        treatment,
        outcome,
        sessionId: sessionId ?? null,
      });
      setEdges(res.edges);
      setRoles(res.variable_roles);
      setDomains(res.domain_expertises);
      setModel(res.model_used);

      if (res.edges.length === 0) {
        setError("The LLM did not discover any causal edges. Try adding more variables or adjusting the treatment/outcome.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Discovery failed";
      setError(msg);
      toast({ title: "Discovery failed", description: msg, variant: "destructive" });
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
    }
  };

  const handleConnect = (source: string, target: string) => {
    if (source === target) return;
    if (edges?.some((e) => e.source === source && e.target === target)) return;
    const newEdge: CausalEdgeFull = {
      source, target, confidence: 1.0, relationship_type: "direct",
      reasoning: "Manually specified by domain expert.", origin: "manual",
    };
    setEdges((prev) => [...(prev ?? []), newEdge]);
  };

  const handleDelete = (edge: CausalEdgeFull) => {
    setEdges((prev) => (prev ?? []).filter((e) => !(e.source === edge.source && e.target === edge.target)));
  };

  const handleSave = async () => {
    if (!edges || !roles) return;
    setSaving(true);
    try {
      const saved = await saveDag({
        name,
        description: `${edges.filter((e) => e.origin === "llm").length} AI + ${edges.filter((e) => e.origin === "manual").length} manual edges.`,
        treatment, outcome,
        variables: allVars,
        edges,
        variable_roles: roles,
        creation_mode: "llm_assisted",
        model_used: model || "",
        domain_expertises: domains,
      });
      toast({ title: "DAG saved to library ✅", description: saved.name });
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Failed to save DAG", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Library
          </Button>
        </div>
      )}

      {!edges && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generate DAG with AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dag-name" className="text-sm">DAG Name</Label>
                <Input id="dag-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dag-treatment" className="text-sm">Treatment</Label>
                <Input id="dag-treatment" value={treatment} onChange={(e) => setTreatment(e.target.value)} className="h-9 font-mono text-sm" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dag-outcome" className="text-sm">Outcome</Label>
                <Input id="dag-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-9 font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Other Variables</Label>
              <p className="text-xs text-muted-foreground">Type a variable name and press Enter (or paste comma-separated values).</p>
              <TagInput values={variables} onChange={setVariables} placeholder="e.g. age, income, engagement…" />
            </div>
            {loading && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2 text-sm ${i <= stepIdx ? "text-foreground" : "text-muted-foreground/50"}`}>
                    {i < stepIdx ? (
                      <Zap className="h-3.5 w-3.5 text-primary" />
                    ) : i === stepIdx ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border" />
                    )}
                    {s}
                  </div>
                ))}
              </div>
            )}
            {error && !loading && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button id="dag-generate-btn" onClick={runDiscovery} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate DAG
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {edges && roles && (
        <div className="space-y-4">
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              AI has proposed this causal structure. Click any edge to view reasoning, drag between nodes to add manual edges, then save to your library.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{name} — Verification</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DAGCanvas
                  treatment={treatment}
                  outcome={outcome}
                  variables={allVars}
                  edges={edges}
                  variable_roles={roles}
                  selectedEdgeKey={selected ? edgeKey(selected) : null}
                  onEdgeClick={setSelected}
                  onConnect={handleConnect}
                  height="55vh"
                />
              </CardContent>
            </Card>
            <VariableRolesPanel
              treatment={treatment}
              outcome={outcome}
              variable_roles={roles}
              domain_expertises={domains}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={runDiscovery} disabled={loading} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
            <Button id="dag-save-btn" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to Library
            </Button>
          </div>
        </div>
      )}

      <EdgeReasoningSheet edge={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
    </div>
  );
}
