import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pencil, Save, ArrowLeft, Hand, Loader2 } from "lucide-react";
import TagInput from "./TagInput";
import DAGCanvas, { edgeKey } from "./DAGCanvas";
import VariableRolesPanel from "./VariableRolesPanel";
import EdgeReasoningSheet from "./EdgeReasoningSheet";
import type { CausalEdgeFull, SavedDAG, VariableRoles } from "@/lib/dag-store";
import { useToast } from "@/hooks/use-toast";
import { useHistory } from "@/hooks/useHistory";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  onSaved: (dag: SavedDAG) => void;
  onCancel?: () => void;
  saveDag: (dag: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & { dag_id?: string }) => Promise<SavedDAG>;
}

export default function ManualBuilder({ onSaved, onCancel, saveDag }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [treatment, setTreatment] = useState("IMC_Exposure");
  const [outcome, setOutcome] = useState("");

  type HistoryState = {
    edges: CausalEdgeFull[];
    confounders: string[];
    mediators: string[];
    colliders: string[];
    instruments: string[];
  };

  const { state: hState, pushState, setHistory, undo, redo, canUndo, canRedo } = useHistory<HistoryState>({
    edges: [],
    confounders: [],
    mediators: [],
    colliders: [],
    instruments: [],
  });
  const { edges, confounders, mediators, colliders, instruments } = hState;

  const [canvasReady, setCanvasReady] = useState(false);
  const [selected, setSelected] = useState<CausalEdgeFull | null>(null);
  const [nodesToDelete, setNodesToDelete] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const roles: VariableRoles = {
    confounders, mediators, colliders, instrumental_variables: instruments,
  };
  const allVars = Array.from(new Set([
    treatment, outcome, ...confounders, ...mediators, ...colliders, ...instruments,
  ].filter(Boolean)));

  const createCanvas = () => {
    if (!name.trim() || !treatment || !outcome) {
      toast({ title: "Missing fields", description: "Name, treatment, and outcome are required.", variant: "destructive" });
      return;
    }
    setCanvasReady(true);
  };

  const handleConnect = (source: string, target: string) => {
    if (source === target) return;
    if (edges.some((e) => e.source === source && e.target === target)) return;
    const newEdge: CausalEdgeFull = {
      source, target, confidence: 1.0,
      relationship_type: confounders.includes(source) ? "confounder" : mediators.includes(source) || mediators.includes(target) ? "mediator" : "direct",
      reasoning: "Manually specified by domain expert.", origin: "manual",
    };
    pushState({ ...hState, edges: [...edges, newEdge] });
  };

  const handleDelete = (e: CausalEdgeFull) => {
    pushState({ ...hState, edges: edges.filter((x) => !(x.source === e.source && x.target === e.target)) });
  };

  const handleNodesDeleteRequest = (deletedIds: string[]) => {
    setNodesToDelete(deletedIds);
  };

  const commitDeleteNodes = () => {
    if (!nodesToDelete) return;
    const idSet = new Set(nodesToDelete);
    pushState({
      edges: edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
      confounders: confounders.filter(v => !idSet.has(v)),
      mediators: mediators.filter(v => !idSet.has(v)),
      colliders: colliders.filter(v => !idSet.has(v)),
      instruments: instruments.filter(v => !idSet.has(v)),
    });
    setNodesToDelete(null);
  };

  const handleSave = async () => {
    if (edges.length === 0) {
      toast({ title: "No edges defined", description: "Drag between nodes on the canvas to add at least one edge.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDag({
        name,
        description: `Manually built DAG with ${edges.length} edges.`,
        treatment, outcome,
        variables: allVars,
        edges,
        variable_roles: roles,
        creation_mode: "manual",
        model_used: "manual",
        domain_expertises: [],
      });
      toast({ title: "DAG saved to library", description: saved.name });
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
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Button>
      </div>

      {!canvasReady ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Build a DAG Manually
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">DAG Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" placeholder="e.g. Loyalty Program v2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Treatment</Label>
                <Input value={treatment} onChange={(e) => setTreatment(e.target.value)} className="h-9 font-mono text-sm" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm">Outcome</Label>
                <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-9 font-mono text-sm" placeholder="e.g. purchase_amount" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-sm">Confounders</Label><TagInput values={confounders} onChange={(v) => setHistory({ ...hState, confounders: v })} placeholder="Add confounder…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Mediators</Label><TagInput values={mediators} onChange={(v) => setHistory({ ...hState, mediators: v })} placeholder="Add mediator…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Colliders</Label><TagInput values={colliders} onChange={(v) => setHistory({ ...hState, colliders: v })} placeholder="Add collider…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Instrumental Variables</Label><TagInput values={instruments} onChange={(v) => setHistory({ ...hState, instruments: v })} placeholder="Add instrument…" /></div>
            </div>
            <div className="flex justify-end">
              <Button id="dag-create-canvas-btn" onClick={createCanvas} className="gap-1.5">
                <Hand className="h-4 w-4" /> Create Canvas
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Alert>
            <Hand className="h-4 w-4" />
            <AlertDescription>
              Drag from one node's handle to another to define a causal edge. Click an edge to inspect or delete it.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3"><CardTitle className="text-base">{name}</CardTitle></CardHeader>
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
                  height="55vh"
                />
              </CardContent>
            </Card>
            <VariableRolesPanel treatment={treatment} outcome={outcome} variable_roles={roles} />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setCanvasReady(false)}>Edit Variables</Button>
            <Button id="dag-save-btn" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to Library
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
              This will remove the variable and all its causal relationships. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setNodesToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={commitDeleteNodes}>Delete Node</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
