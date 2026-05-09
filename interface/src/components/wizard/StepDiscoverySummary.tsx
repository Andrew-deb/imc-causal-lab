import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_COLORS } from "@/lib/causal-graph";
import { useDAGLibrary } from "@/lib/dag-store";
import DAGCanvas from "@/components/dag/DAGCanvas";
import VariableRolesPanel from "@/components/dag/VariableRolesPanel";

export default function StepDiscoverySummary({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { selectedDagId } = useSession();
  const { dags, loading } = useDAGLibrary();

  const dag = dags.find((d) => d.dag_id === selectedDagId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!dag) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No DAG selected. Go back to the Causal Identification step and select or create a DAG.
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} disabled>Generate Causal Estimates</Button>
        </div>
      </div>
    );
  }

  const variables = Array.from(new Set([dag.treatment, dag.outcome, ...dag.variables]));

  return (
    <div className="space-y-6">
      {/* Selected Variables */}
      <Card>
        <CardHeader><CardTitle className="text-base">Selected Variables</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Treatment</span>
              <div>
                <Badge style={{
                  backgroundColor: ROLE_COLORS.treatment.replace("hsl(", "hsla(").replace(")", ", 0.18)"),
                  color: ROLE_COLORS.treatment,
                  border: `1px solid ${ROLE_COLORS.treatment.replace("hsl(", "hsla(").replace(")", ", 0.45)")}`,
                }} className="font-semibold">{dag.treatment}</Badge>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outcome</span>
              <div>
                <Badge style={{
                  backgroundColor: ROLE_COLORS.outcome.replace("hsl(", "hsla(").replace(")", ", 0.18)"),
                  color: ROLE_COLORS.outcome,
                  border: `1px solid ${ROLE_COLORS.outcome.replace("hsl(", "hsla(").replace(")", ", 0.45)")}`,
                }} className="font-semibold">{dag.outcome}</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Confounders", items: dag.variable_roles.confounders, color: ROLE_COLORS.confounder },
              { label: "Mediators", items: dag.variable_roles.mediators, color: ROLE_COLORS.mediator },
              { label: "Colliders", items: dag.variable_roles.colliders, color: ROLE_COLORS.collider },
              { label: "Instrumental Variables", items: dag.variable_roles.instrumental_variables, color: ROLE_COLORS.instrumental_variable },
            ].map(({ label, items, color }) => (
              <div key={label} className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {items.length > 0
                    ? items.map((v) => (
                        <Badge key={v} style={{
                          backgroundColor: color.replace("hsl(", "hsla(").replace(")", ", 0.18)"),
                          color: color,
                          border: `1px solid ${color.replace("hsl(", "hsla(").replace(")", ", 0.45)")}`,
                        }} className="text-xs font-semibold">{v}</Badge>
                      ))
                    : <span className="text-xs text-muted-foreground italic">None specified</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Causal DAG */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Causal DAG — {dag.name}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]">
              {dag.creation_mode === "llm_assisted" ? "AI-Generated" : "Manual"}
            </Badge>
            <span className="text-xs text-muted-foreground">{dag.edges.length} edges · {variables.length} variables</span>
          </div>
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
          <DAGCanvas
            treatment={dag.treatment}
            outcome={dag.outcome}
            variables={variables}
            edges={dag.edges}
            variable_roles={dag.variable_roles}
            readOnly
            height="400px"
          />
        </CardContent>
      </Card>

      {/* Variable Roles Panel */}
      <VariableRolesPanel
        treatment={dag.treatment}
        outcome={dag.outcome}
        variable_roles={dag.variable_roles}
        domain_expertises={dag.domain_expertises}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Generate Causal Estimates</Button>
      </div>
    </div>
  );
}
