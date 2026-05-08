import { useMemo, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ROLE_COLORS } from "@/lib/causal-graph";
import type { CausalEdgeFull, VariableRoles } from "@/lib/dag-store";

const RELATIONSHIP_COLOR: Record<CausalEdgeFull["relationship_type"], string> = {
  direct: "hsl(var(--primary))",
  confounder: ROLE_COLORS.confounder,
  mediator: ROLE_COLORS.mediator,
};

export function getNodeRole(
  node: string,
  treatment: string,
  outcome: string,
  roles: VariableRoles
): string {
  if (node === treatment) return "treatment";
  if (node === outcome) return "outcome";
  if (roles.confounders.includes(node)) return "confounder";
  if (roles.mediators.includes(node)) return "mediator";
  if (roles.colliders.includes(node)) return "collider";
  if (roles.instrumental_variables.includes(node)) return "instrumental_variable";
  return "confounder";
}

export function layoutNodes(
  variables: string[],
  treatment: string,
  outcome: string,
  roles: VariableRoles
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(treatment, { x: 80, y: 240 });
  positions.set(outcome, { x: 720, y: 240 });
  const place = (arr: string[], y: number, spacing = 180) => {
    const startX = 400 - ((arr.length - 1) * spacing) / 2;
    arr.forEach((v, i) => positions.set(v, { x: startX + i * spacing, y }));
  };
  place(roles.confounders, 40);
  place(roles.mediators, 240);
  place(roles.colliders, 440);
  place(roles.instrumental_variables, 540, 160);
  let idx = 0;
  variables.forEach((v) => {
    if (!positions.has(v)) {
      positions.set(v, { x: 200 + (idx % 4) * 160, y: 600 + Math.floor(idx / 4) * 100 });
      idx += 1;
    }
  });
  return positions;
}

interface Props {
  treatment: string;
  outcome: string;
  variables: string[];
  edges: CausalEdgeFull[];
  variable_roles: VariableRoles;
  selectedEdgeKey?: string | null;
  onEdgeClick?: (edge: CausalEdgeFull) => void;
  onConnect?: (source: string, target: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function edgeKey(e: { source: string; target: string }) {
  return `${e.source}__${e.target}`;
}

export default function DAGCanvas({
  treatment,
  outcome,
  variables,
  edges,
  variable_roles,
  selectedEdgeKey,
  onEdgeClick,
  onConnect,
  readOnly,
  height = "60vh",
}: Props) {
  const initial = useMemo(() => {
    const positions = layoutNodes(variables, treatment, outcome, variable_roles);
    const nodes: Node[] = variables.map((id) => {
      const role = getNodeRole(id, treatment, outcome, variable_roles);
      const color = ROLE_COLORS[role] ?? ROLE_COLORS.confounder;
      return {
        id,
        position: positions.get(id) ?? { x: 0, y: 0 },
        data: { label: `${id}\n(${role.replace("_", " ")})` },
        draggable: !readOnly,
        style: {
          background: color.replace("hsl(", "hsla(").replace(")", ", 0.15)"),
          border: `2px solid ${color}`,
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "pre-line" as const,
          textAlign: "center" as const,
          minWidth: 110,
          color: "hsl(var(--foreground))",
        },
      };
    });
    const rfEdges: Edge[] = edges.map((e) => {
      const id = edgeKey(e);
      const isSelected = id === selectedEdgeKey;
      const stroke = RELATIONSHIP_COLOR[e.relationship_type] ?? "hsl(var(--primary))";
      const isManual = e.origin === "manual";
      return {
        id,
        source: e.source,
        target: e.target,
        animated: isSelected,
        label: isManual ? `✏️ ${(e.confidence * 100).toFixed(0)}%` : `${(e.confidence * 100).toFixed(0)}%`,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" },
        labelBgStyle: { fill: "hsl(var(--card))" },
        style: {
          stroke,
          strokeWidth: isSelected ? 3.5 : 1.8,
          strokeDasharray: isManual ? "6 4" : undefined,
          opacity: selectedEdgeKey && !isSelected ? 0.35 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      };
    });
    return { nodes, rfEdges };
  }, [variables, edges, treatment, outcome, variable_roles, selectedEdgeKey, readOnly]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initial.nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initial.rfEdges);

  // Reset nodes when graph identity changes (variables/roles/treatment/outcome).
  useEffect(() => {
    setRfNodes(initial.nodes);
  }, [variables.join(","), treatment, outcome, JSON.stringify(variable_roles)]); // eslint-disable-line

  // Refresh edges (selection or content change).
  useEffect(() => {
    setRfEdges(initial.rfEdges);
  }, [initial.rfEdges, setRfEdges]);

  const handleConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.source || !c.target || !onConnect) return;
      onConnect(c.source, c.target);
      setRfEdges((eds) => addEdge({ ...c, animated: false }, eds));
    },
    [onConnect, readOnly, setRfEdges]
  );

  return (
    <div style={{ height }} className="relative border rounded-lg overflow-hidden">
      <div className="absolute top-2 right-2 z-10 bg-card/90 backdrop-blur border rounded-md px-2.5 py-1.5 text-[10px] flex items-center gap-3 shadow-sm">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="hsl(var(--primary))" strokeWidth="2" /></svg>
          <span className="text-muted-foreground">AI</span>
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 3" /></svg>
          <span className="text-muted-foreground">✏️ Manual</span>
        </span>
      </div>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        fitView
        onEdgeClick={(_, edge) => {
          const found = edges.find((e) => edgeKey(e) === edge.id);
          if (found && onEdgeClick) onEdgeClick(found);
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
