import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Library, Sparkles, ExternalLink, ArrowLeft } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { useDAGLibrary, type SavedDAG } from "@/lib/dag-store";
import { api } from "@/lib/api";
import DAGCanvas from "@/components/dag/DAGCanvas";
import VariableRolesPanel from "@/components/dag/VariableRolesPanel";
import AIBuilder from "@/components/dag/AIBuilder";
import { ROLE_COLORS } from "@/lib/causal-graph";

type Mode = null | "existing" | "ai" | "studio";

export default function StepCausalIdentification({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { selectedDagId, setSelectedDagId, sessionId } = useSession();
  const { dags, save } = useDAGLibrary();
  const [mode, setMode] = useState<Mode>(selectedDagId ? "existing" : null);
  const [pickedId, setPickedId] = useState<string | null>(selectedDagId);

  const dag = dags.find((d) => d.dag_id === pickedId) ?? null;

  const handleAttach = (saved: SavedDAG) => {
    setPickedId(saved.dag_id);
    setSelectedDagId(saved.dag_id);
    setMode("existing");
  };

  const choose = (id: string) => {
    setPickedId(id);
    setSelectedDagId(id);
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
        <AIBuilder saveDag={save} onSaved={(d) => { handleAttach(d); onNext(); }} embedded sessionId={sessionId} />
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

            {dag && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{dag.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {dag.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {Object.entries(ROLE_COLORS).slice(0, 5).map(([role, color]) => (
                        <span key={role} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                          {role}
                        </span>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <DAGCanvas
                      treatment={dag.treatment}
                      outcome={dag.outcome}
                      variables={dag.variables}
                      edges={dag.edges}
                      variable_roles={dag.variable_roles}
                      readOnly
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
