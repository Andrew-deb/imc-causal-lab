import type { Node, Edge } from "@xyflow/react";

interface SelectedVariables {
  treatment: string;
  outcome: string;
  confounders: string[];
  mediators: string[];
  colliders: string[];
}

// Shared role palette used across the entire platform (DAG, badges, legends).
export const ROLE_COLORS: Record<string, string> = {
  treatment: "hsl(200, 60%, 50%)",
  outcome: "hsl(140, 50%, 45%)",
  confounder: "hsl(35, 70%, 50%)",
  mediator: "hsl(270, 50%, 60%)",
  collider: "hsl(0, 60%, 55%)",
  instrumental_variable: "hsl(190, 50%, 45%)",
};

export const ROLE_LABELS: { role: keyof typeof ROLE_COLORS | string; label: string }[] = [
  { role: "treatment", label: "Treatment" },
  { role: "outcome", label: "Outcome" },
  { role: "confounder", label: "Confounder" },
  { role: "mediator", label: "Mediator" },
  { role: "collider", label: "Collider" },
];

function nodeStyle(color: string) {
  // Tinted background + colored border + readable foreground for both themes.
  return {
    background: color.replace("hsl(", "hsla(").replace(")", ", 0.15)"),
    border: `2px solid ${color}`,
    color: "hsl(var(--foreground))",
  };
}

function getRole(variable: string, sv: SelectedVariables): string {
  if (variable === sv.treatment) return "treatment";
  if (variable === sv.outcome) return "outcome";
  if (sv.confounders.includes(variable)) return "confounder";
  if (sv.mediators.includes(variable)) return "mediator";
  if (sv.colliders.includes(variable)) return "collider";
  return "treatment";
}

/**
 * Build a proper causal DAG based on variable roles:
 * - Treatment → Outcome (direct causal path)
 * - Confounder → Treatment AND Confounder → Outcome
 * - Treatment → Mediator → Outcome
 * - Treatment → Collider AND Outcome → Collider
 */
export function buildCausalGraph(sv: SelectedVariables): { nodes: Node[]; edges: Edge[] } {
  const edges: Edge[] = [];
  let edgeIdx = 0;

  const makeEdge = (source: string, target: string, animated = false): Edge => ({
    id: `e${edgeIdx++}`,
    source,
    target,
    animated,
    label: "100%",
    labelStyle: { fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" },
    labelBgStyle: { fill: "hsl(var(--card))" },
    style: { stroke: "hsl(var(--primary))", strokeWidth: 1.8 },
    markerEnd: { type: "arrowclosed" as const, color: "hsl(var(--primary))" },
  });

  // Treatment → Outcome (direct)
  edges.push(makeEdge(sv.treatment, sv.outcome));

  // Confounders → Treatment AND Confounders → Outcome
  sv.confounders.forEach((c) => {
    edges.push(makeEdge(c, sv.treatment));
    edges.push(makeEdge(c, sv.outcome));
  });

  // Treatment → Mediator → Outcome
  sv.mediators.forEach((m) => {
    edges.push(makeEdge(sv.treatment, m));
    edges.push(makeEdge(m, sv.outcome));
  });

  // Treatment → Collider AND Outcome → Collider
  sv.colliders.forEach((c) => {
    edges.push(makeEdge(sv.treatment, c));
    edges.push(makeEdge(sv.outcome, c));
  });

  // Layout positions
  const nodeMap = new Map<string, { x: number; y: number }>();
  const centerX = 300;
  const centerY = 200;

  // Treatment on the left
  nodeMap.set(sv.treatment, { x: 50, y: centerY });
  // Outcome on the right
  nodeMap.set(sv.outcome, { x: 550, y: centerY });

  // Confounders across the top
  sv.confounders.forEach((c, i) => {
    const spacing = 180;
    const startX = centerX - ((sv.confounders.length - 1) * spacing) / 2;
    nodeMap.set(c, { x: startX + i * spacing, y: 30 });
  });

  // Mediators in the middle
  sv.mediators.forEach((m, i) => {
    const spacing = 140;
    const startX = centerX - ((sv.mediators.length - 1) * spacing) / 2;
    nodeMap.set(m, { x: startX + i * spacing, y: centerY });
  });

  // Colliders across the bottom
  sv.colliders.forEach((c, i) => {
    const spacing = 180;
    const startX = centerX - ((sv.colliders.length - 1) * spacing) / 2;
    nodeMap.set(c, { x: startX + i * spacing, y: 370 });
  });

  const nodes: Node[] = Array.from(nodeMap.entries()).map(([id, pos]) => {
    const role = getRole(id, sv);
    const color = ROLE_COLORS[role] || ROLE_COLORS.treatment;
    return {
      id,
      position: pos,
      data: { label: `${id}\n(${role})` },
      style: {
        ...nodeStyle(color),
        borderRadius: 8,
        padding: "10px 18px",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "pre-line" as const,
        textAlign: "center" as const,
        minWidth: 100,
      },
    };
  });

  return { nodes, edges };
}
