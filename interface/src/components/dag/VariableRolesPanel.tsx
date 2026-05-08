import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { ROLE_COLORS } from "@/lib/causal-graph";
import type { VariableRoles } from "@/lib/dag-store";

interface Props {
  treatment: string;
  outcome: string;
  variable_roles: VariableRoles;
  domain_expertises?: string[];
}

const tinted = (c: string) => ({
  backgroundColor: c.replace("hsl(", "hsla(").replace(")", ", 0.18)"),
  color: c,
  border: `1px solid ${c.replace("hsl(", "hsla(").replace(")", ", 0.45)")}`,
});

export default function VariableRolesPanel({ treatment, outcome, variable_roles, domain_expertises }: Props) {
  const sections: { title: string; items: string[]; role: keyof typeof ROLE_COLORS }[] = [
    { title: "Treatment", items: [treatment], role: "treatment" },
    { title: "Outcome", items: [outcome], role: "outcome" },
    { title: "Confounders", items: variable_roles.confounders, role: "confounder" },
    { title: "Mediators", items: variable_roles.mediators, role: "mediator" },
    { title: "Colliders", items: variable_roles.colliders, role: "collider" },
    { title: "Instrumental variables", items: variable_roles.instrumental_variables, role: "instrumental_variable" },
  ];

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Variable Roles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {domain_expertises && domain_expertises.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Domain expertise
            </p>
            <div className="flex flex-wrap gap-1.5">
              {domain_expertises.map((d) => (
                <Badge key={d} variant="secondary" className="text-[11px]">{d}</Badge>
              ))}
            </div>
          </div>
        )}
        {sections.map((s) =>
          s.items.length === 0 || (s.items.length === 1 && !s.items[0]) ? null : (
            <div key={s.title}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {s.title}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.items.map((v) => (
                  <Badge
                    key={v}
                    className="text-[11px] font-mono font-semibold"
                    style={tinted(ROLE_COLORS[s.role])}
                  >
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
