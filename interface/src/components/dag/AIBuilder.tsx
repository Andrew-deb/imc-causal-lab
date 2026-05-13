import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, RefreshCw, Save, Loader2, ArrowLeft, Zap, Maximize2 } from "lucide-react";
import TagInput from "./TagInput";
import DAGCanvas, { edgeKey } from "./DAGCanvas";
import VariableRolesPanel from "./VariableRolesPanel";
import EdgeReasoningSheet from "./EdgeReasoningSheet";
import { discoverDAG, type CausalEdgeFull, type SavedDAG, type VariableRoles } from "@/lib/dag-store";
import { useToast } from "@/hooks/use-toast";
import { useHistory } from "@/hooks/useHistory";

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
  
  // Fetch session details if sessionId is provided
  const { data: sessionData, isLoading: isLoadingSession } = useQuery({
    queryKey: ["sessionDetail", sessionId],
    queryFn: () => sessionId ? api.getSessionDetail(sessionId) : Promise.reject("No session"),
    enabled: !!sessionId,
    refetchOnWindowFocus: false, // Prevent background refetches from resetting state
  });

  const availableColumns = useMemo(() => {
    if (!sessionData?.dataset_meta) return [];
    const meta = sessionData.dataset_meta as any;
    const allCols = [
      ...(meta.customers_columns || []),
      ...(meta.transactions_columns || []),
      ...(meta.campaigns_columns || [])
    ];
    // Filter out IDs and dates (mimicking backend logic)
    const skipPatterns = ["_id", "session", "transaction_id", "imc_category", "email", "phone", "full_name", "name", "campaign_name", "registration_date", "start_date", "end_date"];
    return Array.from(new Set(allCols)).filter((col: any) => {
      const lower = col.toLowerCase();
      return !skipPatterns.some(pat => lower.includes(pat));
    });
  }, [sessionData]);

  const [name, setName] = useState("Marketing Funnel v1");
  const [treatment, setTreatment] = useState("IMC_Exposure");
  // Use empty default when session exists (will be populated from API)
  const [outcome, setOutcome] = useState(sessionId ? "" : "purchase");

  type HistoryState = {
    variables: string[];
    edges: CausalEdgeFull[] | null;
    roles: VariableRoles | null;
  };

  // Use empty defaults when session exists (will be populated from API)
  const { state: hState, pushState, setHistory, undo, redo, canUndo, canRedo } = useHistory<HistoryState>({
    variables: sessionId ? [] : ["age", "income", "engagement"],
    edges: null,
    roles: null,
  });
  const { variables, edges, roles } = hState;

  const [hasPopulated, setHasPopulated] = useState(false);

  // Auto-populate from dataset if available
  useEffect(() => {
    if (availableColumns.length > 0 && !hasPopulated) {
      const mappedOutcome = (sessionData?.column_mapping as any)?.outcome || "purchase";
      
      // Select outcome if it exists in columns, else default
      if (availableColumns.includes(mappedOutcome)) {
        setOutcome(mappedOutcome);
      } else if (availableColumns.includes("purchase")) {
        setOutcome("purchase");
      }
      
      // Pre-select all filtered columns except treatment and outcome as variables
      const initialVars = availableColumns.filter(c => c !== "IMC_Exposure" && c !== "imc_category" && c !== mappedOutcome && c !== "purchase");
      setHistory({ ...hState, variables: initialVars });
      setHasPopulated(true);
    }
  }, [availableColumns, sessionData, hasPopulated]);

  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [domains, setDomains] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [selected, setSelected] = useState<CausalEdgeFull | null>(null);
  const [saving, setSaving] = useState(false);

  const [nodesToDelete, setNodesToDelete] = useState<string[] | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backupState, setBackupState] = useState<{
    edges: CausalEdgeFull[];
    roles: VariableRoles;
    variables: string[];
  } | null>(null);


  try {
    const allVars = Array.from(new Set([treatment, outcome, ...variables].filter(Boolean)));

  const runDiscovery = async () => {
    if (!treatment || !outcome || variables.length < 1 || !name.trim()) {
      toast({ title: "Missing fields", description: "Name, treatment, outcome, and at least one variable are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setHistory({ ...hState, edges: null });
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
      setHistory({ ...hState, edges: res.edges, roles: res.variable_roles });
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
    pushState({ ...hState, edges: [...(edges ?? []), newEdge] });
  };

  const handleDelete = (edge: CausalEdgeFull) => {
    pushState({ ...hState, edges: (edges ?? []).filter((e) => !(e.source === edge.source && e.target === edge.target)) });
  };

  
  const handleNodesDeleteRequest = (deletedIds: string[]) => {
    setNodesToDelete(deletedIds);
  };

  const commitDeleteNodes = () => {
    if (!nodesToDelete) return;
    const idSet = new Set(nodesToDelete);
    
    const newVars = variables.filter(v => !idSet.has(v));
    const newEdges = (edges ?? []).filter((e) => !idSet.has(e.source) && !idSet.has(e.target));
    const newRoles = roles ? {
      confounders: roles.confounders.filter(v => !idSet.has(v)),
      mediators: roles.mediators.filter(v => !idSet.has(v)),
      colliders: roles.colliders.filter(v => !idSet.has(v)),
      instrumental_variables: roles.instrumental_variables.filter(v => !idSet.has(v)),
    } : null;
    
    pushState({ variables: newVars, edges: newEdges, roles: newRoles });
    setNodesToDelete(null);
  };

  const openFullscreen = () => {
    setBackupState({
      edges: edges ?? [],
      roles: roles ?? { confounders: [], mediators: [], colliders: [], instrumental_variables: [] },
      variables: [...variables],
    });
    setIsFullscreen(true);
  };

  const cancelFullscreen = () => {
    if (backupState) {
      setHistory({ variables: backupState.variables, edges: backupState.edges, roles: backupState.roles });
    }
    setIsFullscreen(false);
    setBackupState(null);
  };

  const commitFullscreen = () => {
    setIsFullscreen(false);
    setBackupState(null);
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

      {/* Show loading skeleton while session data is loading (prevents UI flash) */}
      {sessionId && isLoadingSession && !edges && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generate DAG with AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9 sm:col-span-2" />
            </div>
            <Skeleton className="h-32" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
      )}

      {!edges && !(sessionId && isLoadingSession) && (
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
                {availableColumns.length > 0 ? (
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger className="h-9 font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableColumns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="dag-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-9 font-mono text-sm" />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Other Variables</Label>
              {availableColumns.length > 0 ? (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-2">Select variables to include in causal discovery (IDs and Dates are pre-filtered).</p>
                  {availableColumns.filter(c => c !== treatment && c !== outcome).map(col => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`var-${col}`} 
                        checked={variables.includes(col)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHistory({ ...hState, variables: [...variables, col] });
                          } else {
                            setHistory({ ...hState, variables: variables.filter(v => v !== col) });
                          }
                        }}
                      />
                      <label htmlFor={`var-${col}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-mono">
                        {col}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Type a variable name and press Enter (or paste comma-separated values).</p>
                  <TagInput values={variables} onChange={(v) => setHistory({ ...hState, variables: v })} placeholder="e.g. age, income, engagement…" />
                </>
              )}
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
              <CardHeader className="pb-3 relative">
                <CardTitle className="text-base">{name} — Verification</CardTitle>
                <Button variant="ghost" size="icon" onClick={openFullscreen} className="h-8 w-8 absolute top-2 right-2 z-10" title="Fullscreen Edit">
                  <Maximize2 className="h-4 w-4" />
                </Button>
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
                  onNodesDeleteRequest={handleNodesDeleteRequest}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  height="65vh"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Label htmlFor="dag-save-name" className="text-sm whitespace-nowrap">DAG Name</Label>
              <Input
                id="dag-save-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 font-medium flex-1"
                placeholder="Enter a name for this DAG…"
              />
            </div>
            <Button variant="outline" onClick={runDiscovery} disabled={loading} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
            <Button id="dag-save-btn" onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to Library
            </Button>
          </div>
        </div>
      )}

      <EdgeReasoningSheet edge={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
      <AlertDialog open={!!nodesToDelete} onOpenChange={(open) => !open && setNodesToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {nodesToDelete?.join(", ")}? 
              This will remove the variable and all its causal relationships from the DAG. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={commitDeleteNodes} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFullscreen} onOpenChange={(open) => { if (!open) cancelFullscreen(); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>DAG Editor (Fullscreen)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden relative">
            {edges && roles && (
              <DAGCanvas
                treatment={treatment}
                outcome={outcome}
                variables={allVars}
                edges={edges}
                variable_roles={roles}
                selectedEdgeKey={selected ? edgeKey(selected) : null}
                onEdgeClick={setSelected}
                onConnect={handleConnect}
                onNodesDeleteRequest={handleNodesDeleteRequest}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                height="100%"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancelFullscreen}>Cancel</Button>
            <Button onClick={commitFullscreen}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
  } catch (err) {
    return <div className="p-10 text-red-500 font-mono">Render Error in AIBuilder: {String(err)}</div>;
  }
}
