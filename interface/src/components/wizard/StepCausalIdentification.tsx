import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Library, Sparkles, ExternalLink, ArrowLeft, Maximize2 } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { useDAGLibrary, type SavedDAG, type CausalEdgeFull } from "@/lib/dag-store";
import { api } from "@/lib/api";
import DAGCanvas, { edgeKey } from "@/components/dag/DAGCanvas";
import VariableRolesPanel from "@/components/dag/VariableRolesPanel";
import EdgeReasoningSheet from "@/components/dag/EdgeReasoningSheet";
import AIBuilder from "@/components/dag/AIBuilder";
import { ROLE_COLORS } from "@/lib/causal-graph";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = null | "existing" | "ai" | "studio";

export default function StepCausalIdentification({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { selectedDagId, setSelectedDagId, sessionId } = useSession();
  const { dags, save } = useDAGLibrary();
  const [mode, setMode] = useState<Mode>(selectedDagId ? "existing" : null);
  const [pickedId, setPickedId] = useState<string | null>(selectedDagId);

  const dag = dags.find((d) => d.dag_id === pickedId) ?? null;

  // Editable DAG state — history for undo/redo
  const [editHistory, setEditHistory] = useState<Array<{ edges: CausalEdgeFull[]; variables: string[] }>>(
    dag ? [{ edges: dag.edges, variables: dag.variables }] : []
  );
  const [histIdx, setHistIdx] = useState(0);
  const [selectedEdge, setSelectedEdge] = useState<CausalEdgeFull | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backupState, setBackupState] = useState<{
    edges: CausalEdgeFull[];
    variables: string[];
    histIdx: number;
    editHistory: Array<{ edges: CausalEdgeFull[]; variables: string[] }>;
  } | null>(null);

  const openFullscreen = () => {
    if (!currentEdit) return;
    setBackupState({
      edges: [...currentEdit.edges],
      variables: [...currentEdit.variables],
      histIdx,
      editHistory: [...editHistory],
    });
    setIsFullscreen(true);
  };

  const cancelFullscreen = () => {
    if (backupState) {
      setEditHistory(backupState.editHistory);
      setHistIdx(backupState.histIdx);
    }
    setIsFullscreen(false);
    setBackupState(null);
  };

  const commitFullscreen = () => {
    setIsFullscreen(false);
    setBackupState(null);
  };

  // Reset edit history when a new DAG is picked
  const choose = (id: string) => {
    setPickedId(id);
    setSelectedDagId(id);
    const picked = dags.find((d) => d.dag_id === id);
    if (picked) {
      setEditHistory([{ edges: picked.edges, variables: picked.variables }]);
      setHistIdx(0);
    }
    setSelectedEdge(null);
  };

  const currentEdit = editHistory[histIdx] ?? (dag ? { edges: dag.edges, variables: dag.variables } : null);

  const pushEdit = (next: { edges: CausalEdgeFull[]; variables: string[] }) => {
    const newHist = editHistory.slice(0, histIdx + 1);
    newHist.push(next);
    setEditHistory(newHist);
    setHistIdx(newHist.length - 1);
  };

  const handleConnect = (source: string, target: string) => {
    if (!currentEdit) return;
    if (source === target) return;
    if (currentEdit.edges.some((e) => e.source === source && e.target === target)) return;
    pushEdit({
      ...currentEdit,
      edges: [...currentEdit.edges, {
        source, target, confidence: 1.0, relationship_type: "direct",
        reasoning: "Manually specified by domain expert.", origin: "manual",
      }],
    });
  };

  const handleDeleteEdge = (e: CausalEdgeFull) => {
    if (!currentEdit) return;
    pushEdit({ ...currentEdit, edges: currentEdit.edges.filter((x) => !(x.source === e.source && x.target === e.target)) });
    setSelectedEdge(null);
  };

  const handleNodesDelete = (ids: string[]) => {
    if (!currentEdit) return;
    const idSet = new Set(ids);
    pushEdit({
      variables: currentEdit.variables.filter((v) => !idSet.has(v)),
      edges: currentEdit.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
    });
  };

  // Attach the selected DAG to the session before proceeding
  const handleNext = async () => {
    if (pickedId && sessionId) {
      try {
        await api.attachDagToSession(sessionId, pickedId);
      } catch (err) {
        console.error("Failed to attach DAG to session:", err);
        // Non-blocking: proceed even if attach fails
      }
    }
    onNext();
  };

  if (mode === "ai") {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Choose different option
        </Button>
        <AIBuilder saveDag={save} onSaved={async (saved: SavedDAG) => {
          setPickedId(saved.dag_id);
          setSelectedDagId(saved.dag_id);
          if (sessionId) {
            try { await api.attachDagToSession(sessionId, saved.dag_id); } catch {}
          }
          onNext();
        }} embedded sessionId={sessionId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Causal Discovery</CardTitle>
          <p className="text-sm text-muted-foreground">Select or create the DAG that defines the causal structure for this analysis.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <OptionCard
            id="dag-opt-existing"
            icon={<Library className="h-5 w-5" />}
            label="Use Existing DAG"
            sub="Pick a DAG you've already saved to your library."
            active={mode === "existing"}
            onClick={() => setMode("existing")}
          />
          <OptionCard
            id="dag-opt-ai"
            icon={<Sparkles className="h-5 w-5" />}
            label="Generate with AI"
            sub="Provide variables and let the model propose a structure."
            active={false}
            onClick={() => setMode("ai")}
          />
          <OptionCard
            id="dag-opt-studio"
            icon={<ExternalLink className="h-5 w-5" />}
            label="Open Discovery Studio"
            sub="Build a complete DAG from scratch, then return here."
            active={false}
            onClick={() => {}}
            asLink
          />
        </CardContent>
      </Card>

      {mode === "existing" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select a saved DAG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No DAGs in your library yet. Generate one with AI or{" "}
                <Link to="/discover" className="text-primary underline">open the Studio</Link>.
              </p>
            ) : (
              <Select value={pickedId ?? ""} onValueChange={choose}>
                <SelectTrigger id="dag-select" className="h-auto py-2"><SelectValue placeholder="Choose a DAG..." /></SelectTrigger>
                <SelectContent>
                  {dags.map((d) => (
                    <SelectItem key={d.dag_id} value={d.dag_id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-sm">{d.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {d.treatment} → {d.outcome} · {d.edges.length} edges
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {dag && currentEdit && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 relative">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{dag.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] mr-8">
                        {dag.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={openFullscreen} className="h-8 w-8 absolute top-2 right-2 z-10" title="Fullscreen Edit">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {Object.entries(ROLE_COLORS).slice(0, 5).map(([role, color]) => (
                        <span key={role} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                          {role}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">You can edit this DAG before proceeding. Changes are not saved to the library.</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <DAGCanvas
                      treatment={dag.treatment}
                      outcome={dag.outcome}
                      variables={Array.from(new Set([dag.treatment, dag.outcome, ...currentEdit.variables]))}
                      edges={currentEdit.edges}
                      variable_roles={dag.variable_roles}
                      selectedEdgeKey={selectedEdge ? edgeKey(selectedEdge) : null}
                      onEdgeClick={setSelectedEdge}
                      onConnect={handleConnect}
                      onNodesDeleteRequest={handleNodesDelete}
                      onUndo={() => setHistIdx(i => Math.max(0, i - 1))}
                      onRedo={() => setHistIdx(i => Math.min(editHistory.length - 1, i + 1))}
                      canUndo={histIdx > 0}
                      canRedo={histIdx < editHistory.length - 1}
                      height="40vh"
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
            )}
            {selectedEdge && (
              <EdgeReasoningSheet
                edge={selectedEdge}
                open={!!selectedEdge}
                onOpenChange={(o) => { if (!o) setSelectedEdge(null); }}
                onDelete={() => handleDeleteEdge(selectedEdge)}
              />
            )}

            <Dialog open={isFullscreen} onOpenChange={(open) => { if (!open) cancelFullscreen(); }}>
              <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] flex flex-col p-4">
                <DialogHeader>
                  <DialogTitle>DAG Editor (Fullscreen)</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 border rounded-lg overflow-hidden relative">
                  {dag && currentEdit && (
                    <DAGCanvas
                      treatment={dag.treatment}
                      outcome={dag.outcome}
                      variables={Array.from(new Set([dag.treatment, dag.outcome, ...currentEdit.variables]))}
                      edges={currentEdit.edges}
                      variable_roles={dag.variable_roles}
                      selectedEdgeKey={selectedEdge ? edgeKey(selectedEdge) : null}
                      onEdgeClick={setSelectedEdge}
                      onConnect={handleConnect}
                      onNodesDeleteRequest={handleNodesDelete}
                      onUndo={() => setHistIdx(i => Math.max(0, i - 1))}
                      onRedo={() => setHistIdx(i => Math.min(editHistory.length - 1, i + 1))}
                      canUndo={histIdx > 0}
                      canRedo={histIdx < editHistory.length - 1}
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
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button id="dag-step-next" onClick={handleNext} disabled={!pickedId}>Next</Button>
      </div>
    </div>
  );
}

function OptionCard({ id, icon, label, sub, active, onClick, asLink }: {
  id: string; icon: React.ReactNode; label: string; sub: string;
  active: boolean; onClick: () => void; asLink?: boolean;
}) {
  const cls = `text-left rounded-lg border p-4 transition-colors h-full ${
    active ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30"
  }`;
  const content = (
    <>
      <div className="text-primary mb-2">{icon}</div>
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </>
  );
  if (asLink) {
    return <Link id={id} to="/discover" target="_blank" className={cls}>{content}</Link>;
  }
  return <button id={id} type="button" onClick={onClick} className={cls}>{content}</button>;
}
