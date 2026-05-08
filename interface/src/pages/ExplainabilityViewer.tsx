import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Workflow, Plus, Sparkles, Pencil, Trash2, ArrowLeft, Edit3,
} from "lucide-react";
import { useDAGLibrary, type SavedDAG, type CausalEdgeFull } from "@/lib/dag-store";
import DAGCanvas, { edgeKey } from "@/components/dag/DAGCanvas";
import VariableRolesPanel from "@/components/dag/VariableRolesPanel";
import EdgeReasoningSheet from "@/components/dag/EdgeReasoningSheet";
import AIBuilder from "@/components/dag/AIBuilder";
import ManualBuilder from "@/components/dag/ManualBuilder";
import { format, parseISO } from "date-fns";
import { ROLE_COLORS } from "@/lib/causal-graph";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/console/PageHeader";
import { cn } from "@/lib/utils";

type View =
  | { kind: "library" }
  | { kind: "detail"; id: string }
  | { kind: "ai" }
  | { kind: "manual" };

export default function ExplainabilityViewer() {
  const { dags, save, remove } = useDAGLibrary();
  const [view, setView] = useState<View>({ kind: "library" });
  const [createOpen, setCreateOpen] = useState(false);

  const fmt = (d: string) => { try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; } };

  if (view.kind === "ai") {
    return <Wrapper title="Generate DAG with AI"><AIBuilder saveDag={save} onSaved={() => setView({ kind: "library" })} onCancel={() => setView({ kind: "library" })} /></Wrapper>;
  }
  if (view.kind === "manual") {
    return <Wrapper title="Build DAG Manually"><ManualBuilder saveDag={save} onSaved={(d) => setView({ kind: "detail", id: d.dag_id })} onCancel={() => setView({ kind: "library" })} /></Wrapper>;
  }
  if (view.kind === "detail") {
    const dag = dags.find((d) => d.dag_id === view.id);
    if (!dag) return <Wrapper title="DAG not found"><Button variant="ghost" onClick={() => setView({ kind: "library" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Wrapper>;
    return <DAGDetail dag={dag} onBack={() => setView({ kind: "library" })} onSave={save} onDelete={(id) => { remove(id); setView({ kind: "library" }); }} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Causal Discovery Studio"
        description="Build, manage, and reuse causal DAG structures for your analyses."
        breadcrumbs={[{ label: "Discover Studio" }]}
        icon={<Workflow className="h-5 w-5" />}
        meta={<span>{dags.length} saved DAG{dags.length === 1 ? "" : "s"}</span>}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button id="create-dag-btn" size="sm" className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New DAG
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new DAG</DialogTitle>
              <DialogDescription>Choose how you want to build your causal structure.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                id="create-dag-ai"
                onClick={() => { setCreateOpen(false); setView({ kind: "ai" }); }}
                className="text-left rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Sparkles className="h-5 w-5 text-primary mb-2" />
                <div className="font-semibold text-sm">Generate with AI</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Provide variables and let the model propose causal relationships.
                </div>
              </button>
              <button
                id="create-dag-manual"
                onClick={() => { setCreateOpen(false); setView({ kind: "manual" }); }}
                className="text-left rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Pencil className="h-5 w-5 text-primary mb-2" />
                <div className="font-semibold text-sm">Build Manually</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Assign roles and draw edges yourself in a Dagitty-style canvas.
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
        }
      />

      {dags.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          No DAGs yet. Click <strong>Create New DAG</strong> to get started.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dags.map((d) => (
            <Card key={d.dag_id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{d.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-medium",
                      d.creation_mode === "llm_assisted"
                        ? "bg-info-soft text-info border-info/30"
                        : "bg-accent text-accent-foreground border-primary/30"
                    )}
                  >
                    {d.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge style={{
                      backgroundColor: ROLE_COLORS.treatment,
                      color: "#fff",
                      border: `1px solid ${ROLE_COLORS.treatment}`,
                    }} className="font-mono text-[10px]">{d.treatment}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge style={{
                      backgroundColor: ROLE_COLORS.outcome,
                      color: "#fff",
                      border: `1px solid ${ROLE_COLORS.outcome}`,
                    }} className="font-mono text-[10px]">{d.outcome}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {d.edges.length} edges · {d.variables.length} variables
                  </div>
                  <div className="text-muted-foreground">Created {fmt(d.created_at)}</div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="default" className="flex-1 h-8" onClick={() => setView({ kind: "detail", id: d.dag_id })}>
                    Open
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setView({ kind: "detail", id: d.dag_id })}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 px-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{d.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This DAG will be removed from the library. Sessions using it will keep their stored copy.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(d.dag_id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Wrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Workflow className="h-6 w-6 text-primary" /> {title}
      </h1>
      {children}
    </div>
  );
}

function DAGDetail({ dag, onBack, onSave, onDelete }: {
  dag: SavedDAG;
  onBack: () => void;
  onSave: (d: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & { dag_id?: string }) => SavedDAG;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [edges, setEdges] = useState<CausalEdgeFull[]>(dag.edges);
  const [selected, setSelected] = useState<CausalEdgeFull | null>(null);
  const variables = Array.from(new Set([dag.treatment, dag.outcome, ...dag.variables]));

  const handleConnect = (source: string, target: string) => {
    if (source === target) return;
    if (edges.some((e) => e.source === source && e.target === target)) return;
    setEdges((prev) => [...prev, {
      source, target, confidence: 1.0, relationship_type: "direct",
      reasoning: "Manually specified by domain expert.", origin: "manual",
    }]);
  };
  const handleDelete = (e: CausalEdgeFull) => {
    setEdges((prev) => prev.filter((x) => !(x.source === e.source && x.target === e.target)));
  };
  const persist = () => {
    onSave({ ...dag, edges });
    toast({ title: "DAG updated", description: dag.name });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 self-start">
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Button>
        <div className="flex gap-2">
          <Button size="sm" onClick={persist}>Save Changes</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{dag.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(dag.dag_id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" /> {dag.name}
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {dag.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
          </Badge>
          <span>{edges.length} edges · {variables.length} variables</span>
        </div>
        {dag.description && <p className="text-sm text-muted-foreground mt-2">{dag.description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Causal DAG</CardTitle>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ROLE_COLORS).map(([role, color]) => (
                  <span key={role} className="flex items-center gap-1.5 text-[11px] text-muted-foreground capitalize">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    {role.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DAGCanvas
              treatment={dag.treatment}
              outcome={dag.outcome}
              variables={variables}
              edges={edges}
              variable_roles={dag.variable_roles}
              selectedEdgeKey={selected ? edgeKey(selected) : null}
              onEdgeClick={setSelected}
              onConnect={handleConnect}
              height="60vh"
            />
          </CardContent>
        </Card>
        <VariableRolesPanel
          treatment={dag.treatment}
          outcome={dag.outcome}
          variable_roles={dag.variable_roles}
          domain_expertises={dag.domain_expertises}
        />
      </div>

      <EdgeReasoningSheet edge={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
    </div>
  );
}
