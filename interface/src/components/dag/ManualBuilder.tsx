import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pencil, Save, ArrowLeft, Hand } from "lucide-react";
import TagInput from "./TagInput";
import DAGCanvas, { edgeKey } from "./DAGCanvas";
import VariableRolesPanel from "./VariableRolesPanel";
import EdgeReasoningSheet from "./EdgeReasoningSheet";
import type { CausalEdgeFull, SavedDAG, VariableRoles } from "@/lib/dag-store";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSaved: (dag: SavedDAG) => void;
  onCancel?: () => void;
  saveDag: (dag: Omit<SavedDAG, "dag_id" | "created_at" | "updated_at" | "adjacency_list"> & { dag_id?: string }) => SavedDAG;
}

export default function ManualBuilder({ onSaved, onCancel, saveDag }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [treatment, setTreatment] = useState("IMC_Exposure");
  const [outcome, setOutcome] = useState("");
  const [confounders, setConfounders] = useState<string[]>([]);
  const [mediators, setMediators] = useState<string[]>([]);
  const [colliders, setColliders] = useState<string[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);

  const [canvasReady, setCanvasReady] = useState(false);
  const [edges, setEdges] = useState<CausalEdgeFull[]>([]);
  const [selected, setSelected] = useState<CausalEdgeFull | null>(null);

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
    setEdges((prev) => [...prev, {
      source, target, confidence: 1.0,
      relationship_type: confounders.includes(source) ? "confounder" : mediators.includes(source) || mediators.includes(target) ? "mediator" : "direct",
      reasoning: "Manually specified by domain expert.", origin: "manual",
    }]);
  };

  const handleDelete = (e: CausalEdgeFull) => {
    setEdges((prev) => prev.filter((x) => !(x.source === e.source && x.target === e.target)));
  };

  const handleSave = () => {
    if (edges.length === 0) {
      toast({ title: "No edges defined", description: "Drag between nodes on the canvas to add at least one edge.", variant: "destructive" });
      return;
    }
    const saved = saveDag({
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
              <div className="space-y-1.5"><Label className="text-sm">Confounders</Label><TagInput values={confounders} onChange={setConfounders} placeholder="Add confounder…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Mediators</Label><TagInput values={mediators} onChange={setMediators} placeholder="Add mediator…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Colliders</Label><TagInput values={colliders} onChange={setColliders} placeholder="Add collider…" /></div>
              <div className="space-y-1.5"><Label className="text-sm">Instrumental Variables</Label><TagInput values={instruments} onChange={setInstruments} placeholder="Add instrument…" /></div>
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
                  height="55vh"
                />
              </CardContent>
            </Card>
            <VariableRolesPanel treatment={treatment} outcome={outcome} variable_roles={roles} />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setCanvasReady(false)}>Edit Variables</Button>
            <Button id="dag-save-btn" onClick={handleSave} className="gap-1.5">
              <Save className="h-4 w-4" /> Save to Library
            </Button>
          </div>
        </div>
      )}

      <EdgeReasoningSheet edge={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
    </div>
  );
}
